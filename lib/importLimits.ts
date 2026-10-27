import { SpreadsheetError } from "./spreadsheetError.ts";
/** Limites explícitos da PoC para conter consumo de memória e varreduras excessivas. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_SHEET_ROWS = 50_000;
export const MAX_SHEET_COLUMNS = 256;
export const MAX_SHEET_CELLS = 500_000;

export function validateFileSize(size: number) {
  if (size === 0) throw new SpreadsheetError("O arquivo está vazio. Selecione uma planilha com dados.");
  if (size > MAX_FILE_BYTES) throw new SpreadsheetError("A planilha excede o limite de 10 MB. Divida o relatório antes de importar.");
}
