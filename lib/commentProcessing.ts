import type { ProcessingRequest, ProcessingResponse } from "./processingProtocol.ts";
import type { SanitizationSettings } from "./sanitizationSettings.ts";
import type { RawComment, SanitizedComment } from "../types/index.ts";

export const PROCESSING_TIMEOUT_MS = 60_000;
export class ProcessingError extends Error {}

/** Um Worker efêmero por operação. Sem fallback síncrono ou execução no servidor. */
function processInWorker(request: ProcessingRequest, signal: AbortSignal): Promise<ProcessingResponse> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Processamento cancelado.", "AbortError"));
      return;
    }
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      reject(new ProcessingError("O processamento local requer um navegador com suporte a Web Workers."));
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/comments.worker.ts", import.meta.url), { type: "module" });
    } catch {
      reject(new ProcessingError("Não foi possível iniciar o processamento local. Recarregue a página e tente novamente."));
      return;
    }
    let settled = false;
    const finish = (error?: Error, response?: ProcessingResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      if (error) reject(error);
      else resolve(response!);
    };
    const abort = () => finish(new DOMException("Processamento cancelado.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => finish(new ProcessingError("O processamento excedeu 60 segundos. Divida a planilha ou reduza o dicionário e tente novamente.")), PROCESSING_TIMEOUT_MS);
    worker.onmessage = ({ data }: MessageEvent<ProcessingResponse>) => {
      if (data?.kind === "error") finish(new ProcessingError(data.message));
      else if (data?.kind === request.kind && Array.isArray(data.comments)) finish(undefined, data);
      else finish(new ProcessingError("O processamento local retornou uma resposta inválida. Tente novamente."));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish(new ProcessingError("O processamento local falhou. Recarregue a página e tente novamente."));
    };
    worker.onmessageerror = () => finish(new ProcessingError("Não foi possível receber os comentários processados. Tente novamente."));
    try {
      worker.postMessage(request);
    } catch {
      finish(new ProcessingError("Não foi possível iniciar o processamento dos comentários. Tente novamente."));
    }
  });
}

// Structured clone não preserva Object.freeze. Restauramos a proteção na chegada.
function freezeComments<T extends RawComment | SanitizedComment>(comments: readonly T[]): readonly T[] {
  for (const comment of comments) Object.freeze(comment);
  return Object.freeze(comments);
}

export async function parseComments(file: File, signal: AbortSignal): Promise<readonly RawComment[]> {
  const response = await processInWorker({ kind: "parse", file }, signal);
  if (response.kind !== "parse") throw new ProcessingError("Resposta de leitura inválida.");
  return freezeComments(response.comments);
}

export async function sanitizeInWorker(raw: readonly RawComment[], settings: SanitizationSettings, signal: AbortSignal): Promise<readonly SanitizedComment[]> {
  const response = await processInWorker({ kind: "sanitize", raw, settings }, signal);
  if (response.kind !== "sanitize") throw new ProcessingError("Resposta de higienização inválida.");
  return freezeComments(response.comments);
}
