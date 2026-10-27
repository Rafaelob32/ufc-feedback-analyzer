import { SpreadsheetError } from "./spreadsheetError.ts";
import { read, utils, type WorkSheet } from "xlsx";
import { extractSigaaComments } from "./sigaaParser.ts";
import { MAX_SHEET_ROWS, MAX_SHEET_COLUMNS, MAX_SHEET_CELLS, validateFileSize } from "./importLimits.ts";
import type { RawComment } from "../types/index";

const commentHeaders = new Set([
  "comentário", "comentários", "comentario", "comentarios",
]);

function isEmpty(value: unknown) {
  return value === undefined || value === null ||
    (typeof value === "string" && value.trim().length === 0);
}

/** Extração pura, separada da leitura do File para verificar a fidelidade dos dados. */
export function extractRawComments(
  sheet: WorkSheet,
  sheetName: string,
): readonly RawComment[] {
  if (!sheet["!ref"]) throw new SpreadsheetError("A primeira aba da planilha está vazia.");

  const range = utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
  const rows = range.e.r - range.s.r + 1;
  const columns = range.e.c - range.s.c + 1;
  if (![range.s.r, range.s.c, range.e.r, range.e.c].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      rows < 1 || columns < 1 || range.e.r >= MAX_SHEET_ROWS || range.e.c >= MAX_SHEET_COLUMNS || rows * columns > MAX_SHEET_CELLS) {
    throw new SpreadsheetError("A primeira aba excede os limites de leitura: 50.000 linhas, 256 colunas e 500.000 posições de células. Divida o relatório antes de importar.");
  }
  let headerRow = -1;
  const commentColumns: number[] = [];

  // Localiza a primeira linha preenchida, preservando as coordenadas do Excel.
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    let hasContent = false;
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[utils.encode_cell({ r: row, c: column })];
      const value: unknown = cell?.v;
      if (!isEmpty(value) || cell?.f) hasContent = true;
      // A normalização se aplica apenas ao cabeçalho, nunca ao comentário.
      if (typeof value === "string" && !cell?.f &&
          commentHeaders.has(value.trim().toLocaleLowerCase("pt-BR"))) {
        commentColumns.push(column);
      }
    }
    if (hasContent) {
      headerRow = row;
      break;
    }
  }

  if (headerRow === -1) throw new SpreadsheetError("A primeira aba da planilha está vazia.");
  if (commentColumns.length === 0) {
    const sigaaComments = extractSigaaComments(sheet, sheetName);
    if (sigaaComments !== null) return sigaaComments;
    throw new SpreadsheetError('Formato não reconhecido. Use o relatório de questões abertas do SIGAA/UFC ou uma tabela com “Comentário” ou “Comentários” na primeira linha preenchida da primeira aba.');
  }
  if (commentColumns.length > 1) {
    throw new SpreadsheetError("Há mais de uma coluna de comentários. Mantenha apenas uma na primeira aba.");
  }

  const rawComments: RawComment[] = [];
  for (let row = headerRow + 1; row <= range.e.r; row += 1) {
    const address = utils.encode_cell({ r: row, c: commentColumns[0] });
    const cell = sheet[address];
    const value: unknown = cell?.v;
    if (!cell?.f && isEmpty(value)) continue;
    // Não converte números, erros ou resultados de fórmulas em texto bruto.
    if (cell?.f || typeof value !== "string" || cell.t === "e") {
      throw new SpreadsheetError(`A célula ${address} da coluna de comentários deve conter texto, sem fórmulas ou erros.`);
    }

    const rowIndex = row + 1;
    rawComments.push(Object.freeze({
      id: rowIndex,
      text: value,
      rowIndex,
      sheetName,
    }));
  }

  // IDs, textos e coleção ficam protegidos também em tempo de execução.
  return Object.freeze(rawComments);
}

/** Lê somente um arquivo selecionado no navegador; nunca usa filesystem ou rede. */
export async function parseXlsxFile(file: File): Promise<readonly RawComment[]> {
  // Workers dedicados não têm window; Node não expõe self/importScripts.
  const inWorker = typeof self !== "undefined" && "importScripts" in self;
  if (typeof window === "undefined" && !inWorker) {
    throw new SpreadsheetError("A leitura de planilhas só está disponível no navegador.");
  }
  if (!/\.(xls|xlsx)$/i.test(file.name)) {
    throw new SpreadsheetError("Formato não aceito. Selecione uma planilha .xls ou .xlsx.");
  }
  validateFileSize(file.size);

  let workbook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = read(buffer, {
      type: "array",
      sheets: 0,
      sheetRows: MAX_SHEET_ROWS + 1,
      cellHTML: false,
      cellText: false,
      cellFormula: true,
    });
  } catch {
    throw new SpreadsheetError("Não foi possível ler a planilha. Verifique se o arquivo está íntegro e sem senha.");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new SpreadsheetError("Não foi encontrada uma aba legível na planilha.");
  return extractRawComments(sheet, sheetName);
}
