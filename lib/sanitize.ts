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

/** Compara em NFC; copia os trechos não mascarados da string original. */
function maskCanonicalMatches(text: string, pattern: RegExp, getSegmenter: () => Intl.Segmenter): string {
  const normalized = text.normalize("NFC");
  if (normalized === text) return text.replace(pattern, SENSITIVE_MARKER);
  const matches = [...normalized.matchAll(pattern)];
  if (!matches.length) return text;

  // Grafemas mantêm acentos combinantes e pares substitutos juntos. Um match
  // parcial de grafema mascara o grafema inteiro, sem produzir Unicode quebrado.
  let normalizedOffset = 0;
  const segments = [...getSegmenter().segment(text)]
    .map(({ segment, index }) => {
      const start = normalizedOffset;
      normalizedOffset += segment.normalize("NFC").length;
      return { start, end: normalizedOffset, originalStart: index, originalEnd: index + segment.length };
    });
  let segmentIndex = 0;
  let cursor = 0;
  let result = "";
  for (const match of matches) {
    while (segments[segmentIndex].end <= match.index) segmentIndex += 1;
    const start = segments[segmentIndex].originalStart;
    while (segments[segmentIndex].end < match.index + match[0].length) segmentIndex += 1;
    const end = segments[segmentIndex].originalEnd;
    if (end <= cursor) continue;
    result += text.slice(cursor, Math.max(cursor, start)) + SENSITIVE_MARKER;
    cursor = end;
  }
  return result + text.slice(cursor);
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
    .map((name) => name.normalize("NFC").trim().replace(/\s+/gu, " "))
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
  // Reutiliza apenas quando necessário, sem cache ou estado persistente.
  let segmenter: Intl.Segmenter | undefined;
  const getSegmenter = () => segmenter ??= new Intl.Segmenter("pt", { granularity: "grapheme" });
  return Object.freeze(raw.map((comment) => Object.freeze({
    id: comment.id,
    // Uma única passagem evita que uma substituição altere a marca de outra.
    text: maskCanonicalMatches(comment.text, sensitivePattern, getSegmenter),
  })));
}
