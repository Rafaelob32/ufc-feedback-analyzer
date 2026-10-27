import { parseXlsxFile } from "../lib/xlsxParser.ts";
import { sanitizeComments } from "../lib/sanitize.ts";
import { registrationRules } from "../lib/sanitizationSettings.ts";
import { SpreadsheetError } from "../lib/spreadsheetError.ts";
import type { ProcessingRequest, ProcessingResponse } from "../lib/processingProtocol.ts";

// Dedicated Worker: não importa React, não faz Fetch e não mantém cache.
// A tipagem local evita misturar os globais DOM e WebWorker no projeto Next.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ProcessingRequest>) => void) | null;
  postMessage: (response: ProcessingResponse) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    if (data.kind === "parse") {
      scope.postMessage({ kind: "parse", comments: await parseXlsxFile(data.file) });
    } else if (data.kind === "sanitize") {
      const comments = sanitizeComments(data.raw, data.settings.namesText.split(/\r?\n/u), {
        registrationDigits: registrationRules[data.settings.registrationRule],
      });
      scope.postMessage({ kind: "sanitize", comments });
    }
  } catch (error) {
    // O parser oferece erros de formato/limite sem conteúdo das células.
    // Erros inesperados de sanitização nunca incluem o texto de entrada.
    scope.postMessage({ kind: "error", message: error instanceof SpreadsheetError
      ? error.message
      : data.kind === "parse"
        ? "Não foi possível ler a planilha. Verifique o formato e tente novamente."
        : "Não foi possível higienizar os comentários. Revise a configuração e tente novamente." });
  }
};
