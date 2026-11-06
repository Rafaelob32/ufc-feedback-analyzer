/** Limites de recursos, independentes do schema de negócio aprovado. */
export const MAX_OLLAMA_RESPONSE_BYTES = 1024 * 1024;
export const MAX_OLLAMA_JSON_NODES = 20_000;
export const MAX_JSON_DEPTH = 32;

export class JsonLimitError extends Error {
  constructor() { super("O JSON excede os limites locais de tamanho ou complexidade."); }
}

/** Apenas valores provenientes de JSON.parse; sem recursão nem lista de erros. */
export function assertJsonBudget(value: unknown, maxNodes = MAX_OLLAMA_JSON_NODES): void {
  const pending = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const item = pending.pop()!;
    visited += 1;
    if (visited > maxNodes || item.depth > MAX_JSON_DEPTH) throw new JsonLimitError();
    if (item.value === null || typeof item.value !== "object") continue;
    // Verifica a largura antes de copiar/visitar todos os filhos de um array.
    if (Array.isArray(item.value) && item.value.length > maxNodes - visited - pending.length) throw new JsonLimitError();
    const children = Array.isArray(item.value) ? item.value : Object.values(item.value);
    if (children.length > maxNodes - visited - pending.length) throw new JsonLimitError();
    for (const child of children) pending.push({ value: child, depth: item.depth + 1 });
  }
}

export function parseBoundedJson(text: string, maxBytes = MAX_OLLAMA_RESPONSE_BYTES, maxNodes = MAX_OLLAMA_JSON_NODES): unknown {
  // O teste barato evita uma cópia UTF-8 de uma string já claramente excessiva.
  if (text.length > maxBytes || new TextEncoder().encode(text).byteLength > maxBytes) throw new JsonLimitError();
  const value: unknown = JSON.parse(text);
  assertJsonBudget(value, maxNodes);
  return value;
}

/** Conta bytes efetivamente lidos, mesmo sem Content-Length ou com header falso. */
export async function readBoundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new SyntaxError("Resposta JSON ausente.");
  const cancel = () => { void reader.cancel().catch(() => {}); };
  let bytes = 0;
  let completed = false;
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    const declared = Number(response.headers.get("content-length"));
    if (declared > MAX_OLLAMA_RESPONSE_BYTES) throw new JsonLimitError();
    // Buffer limitado também para streams com muitos fragmentos de um byte.
    const buffer = new Uint8Array(MAX_OLLAMA_RESPONSE_BYTES);
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) { completed = true; break; }
      if (bytes + value.byteLength > MAX_OLLAMA_RESPONSE_BYTES) throw new JsonLimitError();
      buffer.set(value, bytes);
      bytes += value.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes));
    const value: unknown = JSON.parse(text);
    assertJsonBudget(value);
    return value;
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!completed) cancel();
    reader.releaseLock();
  }
}
