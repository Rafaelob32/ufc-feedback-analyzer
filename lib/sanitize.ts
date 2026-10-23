import type { RawComment, SanitizedComment } from "../types/index";

export const SENSITIVE_MARKER = "[DADO SENSÍVEL]";

export interface SanitizationOptions {
  /** Comprimentos de blocos numéricos completos; padrão: 6 a 7 dígitos. */
  readonly registrationDigits?: { readonly min: number; readonly max: number };
}

// E-mails comuns com local-part dot-atom e domínio ASCII, sem consumir pontuação final.
const emailPattern = /(?<![a-z0-9.!#$%&'*+/=?^_`{|}~-])[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Função pura: não altera RAW, nomes nem opções, e não acessa navegador, disco ou rede.
 * Reconhece padrões configurados, não todos os possíveis dados pessoais de um texto.
 */
export function sanitizeComments(
  raw: readonly RawComment[],
  knownNames: readonly string[] = [],
  options: SanitizationOptions = {},
): readonly SanitizedComment[] {
  const { min, max } = options.registrationDigits ?? { min: 6, max: 7 };
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) ||
      min < 1 || max < min || max > 32) {
    throw new RangeError("Configure matrículas com comprimentos inteiros entre 1 e 32, com mínimo menor ou igual ao máximo.");
  }

  const patterns = [
    // Consome a marca existente inteira, evitando que o dicionário a masque por partes.
    escapeRegExp(SENSITIVE_MARKER),
    emailPattern.source,
    String.raw`(?<![\p{L}\p{M}\p{N}_])\d{${min},${max}}(?![\p{L}\p{M}\p{N}_])`,
  ];

  const names = [...new Set(knownNames
    .map((name) => name.trim().replace(/\s+/gu, " "))
    .filter(Boolean))]
    // O nome completo tem prioridade sobre um nome curto sobreposto.
    .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));

  if (names.length > 0) {
    const alternatives = names.map((name) =>
      name.split(" ").map(escapeRegExp).join(String.raw`\s+`));
    // Limites Unicode evitam substituir Ana em banana, Mariana ou Anápolis.
    patterns.push(String.raw`(?<![\p{L}\p{M}\p{N}_])(?:${alternatives.join("|")})(?![\p{L}\p{M}\p{N}_])`);
  }

  const sensitivePattern = new RegExp(patterns.map((pattern) => `(?:${pattern})`).join("|"), "giu");
  return Object.freeze(raw.map((comment) => Object.freeze({
    id: comment.id,
    // Uma única passagem evita que uma substituição altere a marca de outra.
    text: comment.text.replace(sensitivePattern, SENSITIVE_MARKER),
  })));
}
