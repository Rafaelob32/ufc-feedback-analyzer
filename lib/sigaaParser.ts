import { SpreadsheetError } from "./spreadsheetError.ts";
import { utils, type WorkSheet } from "xlsx";
import type { RawComment } from "../types/index";

/** Normaliza somente rótulos do relatório, nunca o texto dos comentários. */
function normalizeLabel(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
      .trim().replace(/\s+/gu, " ").replace(/:$/u, "").trim()
    : "";
}

/**
 * Relatório de questões abertas do SIGAA/UFC: A contém identificação,
 * B contém rótulos/numeração local e C contém respostas ou metadados.
 * Retorna null quando a aba não possui a assinatura deste formato.
 */
export function extractSigaaComments(
  sheet: WorkSheet,
  sheetName: string,
): readonly RawComment[] | null {
  if (!sheet["!ref"]) return null;
  const range = utils.decode_range(sheet["!ref"]);
  const labelAt = (address: string) => {
    const cell = sheet[address];
    return cell?.t === "s" && !cell.f ? normalizeLabel(cell.v) : "";
  };

  let hasInstitution = false;
  let hasReportTitle = false;
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const label = labelAt(`A${row + 1}`);
    if (label === "universidade federal do ceara") hasInstitution = true;
    if (label.startsWith("conteudo das questoes abertas")) hasReportTitle = true;
  }
  if (!hasInstitution || !hasReportTitle) return null;

  const comments: RawComment[] = [];
  let hasDiscipline = false;
  let inComments = false;
  let foundCommentSection = false;

  function appendComment(rowIndex: number) {
    const address = `C${rowIndex}`;
    const cell = sheet[address];
    const value: unknown = cell?.v;
    const empty = value === undefined || value === null ||
      (typeof value === "string" && value.trim().length === 0);
    if (!cell?.f && empty) return;
    if (cell?.f || typeof value !== "string" || cell.t === "e") {
      throw new SpreadsheetError(`A célula ${address} de comentários do SIGAA deve conter texto, sem fórmulas ou erros.`);
    }
    if (normalizeLabel(value) === "(nenhum comentario registrado)") return;
    comments.push(Object.freeze({ id: rowIndex, text: value, rowIndex, sheetName }));
  }

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const rowIndex = row + 1;
    const identification = sheet[`A${rowIndex}`];
    // Uma nova identificação encerra o bloco anterior, inclusive ao mudar docente.
    if (identification?.f || normalizeLabel(identification?.v)) {
      hasDiscipline = false;
      inComments = false;
      continue;
    }

    const label = labelAt(`B${rowIndex}`);
    if (label === "disciplina") {
      hasDiscipline = true;
      inComments = false;
      continue;
    }
    const isCommentSection = /^comentarios? do docente$/u.test(label) ||
      /^comentarios? dos discentes? da turma$/u.test(label);
    if (isCommentSection) {
      if (!hasDiscipline) {
        throw new SpreadsheetError(`O bloco de comentários do SIGAA na linha ${rowIndex} não possui uma disciplina anterior.`);
      }
      inComments = true;
      foundCommentSection = true;
      // Também aceita resposta ao lado do rótulo, além das linhas seguintes.
      appendComment(rowIndex);
      continue;
    }

    const numberCell = sheet[`B${rowIndex}`];
    const value: unknown = numberCell?.v;
    const empty = value === undefined || value === null ||
      (typeof value === "string" && value.trim().length === 0);
    const isNumber = typeof value === "number"
      ? Number.isSafeInteger(value) && value > 0
      : typeof value === "string" && /^[1-9]\d*$/u.test(value.trim());
    if (numberCell?.f || (!empty && !isNumber)) {
      // Dimensão, questão, conteúdo e outros rótulos não são respostas.
      inComments = false;
      continue;
    }
    if (inComments) appendComment(rowIndex);
  }

  if (!foundCommentSection) {
    throw new SpreadsheetError("O relatório SIGAA foi identificado, mas não foram encontrados blocos de comentários após as disciplinas.");
  }
  return Object.freeze(comments);
}
