import { z } from "zod";

export const OLLAMA_MODEL = "deepseek-r1:latest";
const OLLAMA_ORIGIN = "http://localhost:11434";
export class OllamaError extends Error {}

// A PoC usa exclusivamente variantes locais do DeepSeek-R1, nunca aliases cloud.
export function isLocalDeepSeek(name: string) {
  return /^deepseek-r1(?::[a-z0-9._-]+)?$/i.test(name) && !/cloud/i.test(name);
}

export async function requestOllama(
  path: "tags" | "show" | "generate", signal?: AbortSignal, body?: unknown,
): Promise<unknown> {
  if (typeof window === "undefined") throw new OllamaError("A conexão com o Ollama deve ser executada no navegador.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, path === "generate" ? 300_000 : 10_000);
  try {
    signal?.throwIfAborted();
    const response = await fetch(OLLAMA_ORIGIN + "/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal, credentials: "omit", cache: "no-store", redirect: "error",
    });
    if (!response.ok) {
      if (response.status === 404 && path !== "tags") throw new OllamaError("O modelo selecionado não está disponível no Ollama local.");
      throw new OllamaError("O Ollama retornou HTTP " + response.status + ". Verifique o serviço local e tente novamente.");
    }
    try {
      return await response.json();
    } catch {
      throw new OllamaError("O Ollama não retornou uma resposta JSON completa. Tente novamente.");
    }
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Operação cancelada.", "AbortError");
    if (controller.signal.aborted) throw new OllamaError(path === "generate"
      ? "O modelo excedeu o limite de 5 minutos por lote. Verifique o Ollama e tente novamente."
      : "O Ollama não respondeu em 10 segundos. Verifique o serviço local.");
    if (error instanceof OllamaError) throw error;
    throw new OllamaError("Não foi possível acessar o Ollama local. Verifique se ele está ativo e se OLLAMA_ORIGINS permite a origem desta página.");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

const ModelsSchema = z.object({ models: z.array(z.object({
  name: z.string(), remote_host: z.string().optional(), remote_model: z.string().optional(),
})) });

export async function listLocalModels(signal?: AbortSignal): Promise<string[]> {
  const parsed = ModelsSchema.safeParse(await requestOllama("tags", signal));
  if (!parsed.success) throw new OllamaError("A lista de modelos do Ollama é inválida.");
  return [...new Set(parsed.data.models.filter((model) =>
    isLocalDeepSeek(model.name) && !model.remote_host && !model.remote_model,
  ).map(({ name }) => name))].sort();
}

export async function verifyLocalModel(model: string, signal?: AbortSignal): Promise<void> {
  if (!isLocalDeepSeek(model)) throw new OllamaError("Selecione um modelo DeepSeek-R1 local.");
  const parsed = z.object({
    capabilities: z.array(z.string()),
    remote_host: z.string().optional(), remote_model: z.string().optional(),
    thinking: z.object({ values: z.array(z.union([z.boolean(), z.string()])) }).optional(),
  }).safeParse(await requestOllama("show", signal, { model }));
  if (!parsed.success || parsed.data.remote_host || parsed.data.remote_model ||
      !parsed.data.capabilities.includes("completion")) {
    throw new OllamaError("O modelo precisa executar localmente e informar capacidades válidas de geração e thinking. Confira a instalação do DeepSeek-R1.");
  }
  if (parsed.data.thinking) {
    if (!parsed.data.thinking.values.includes(false)) {
      throw new OllamaError("O modelo não declara suporte a think: false. Selecione uma variante local compatível.");
    }
    return;
  }
  // Versões sem metadados explícitos precisam passar por uma sonda sintética.
  // Nenhum comentário, nome configurado ou ID do usuário entra nesta requisição.
  const probe = z.object({
    done: z.literal(true), response: z.string(), thinking: z.string().optional(),
    done_reason: z.string().optional(),
  }).safeParse(await requestOllama("generate", signal, {
    model, stream: false, think: false,
    options: { temperature: 0.0, num_ctx: 2048, num_predict: 64 },
    format: { type: "object", properties: { ok: { type: "boolean", const: true } }, required: ["ok"], additionalProperties: false },
    prompt: 'Teste de compatibilidade sem dados pessoais. Retorne somente o JSON {"ok":true}, sem raciocínio.',
  }));
  let compatible = false;
  if (probe.success && !probe.data.thinking?.trim() && probe.data.done_reason !== "length" &&
      !/<\/?think\b/i.test(probe.data.response)) {
    try {
      compatible = z.object({ ok: z.literal(true) }).strict().safeParse(JSON.parse(probe.data.response)).success;
    } catch { /* A falha expõe apenas uma mensagem controlada, nunca a resposta. */ }
  }
  if (!compatible) {
    throw new OllamaError("Não foi possível confirmar think: false no teste sintético. Nenhum comentário foi enviado. Verifique o modelo e a versão do Ollama.");
  }
}
