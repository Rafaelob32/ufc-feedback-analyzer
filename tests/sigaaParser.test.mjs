import assert from "node:assert/strict";
import { test } from "node:test";
import { utils, write } from "xlsx";
import { extractRawComments, parseXlsxFile } from "../lib/xlsxParser.ts";
import { sanitizeComments } from "../lib/sanitize.ts";

const textCell = (v) => ({ t: "s", v });
const expectedRows = [24, 25, 39, 40, 41, 42, 43, 44, 45, 46, 47];

// Somente dados fictícios: reproduz a estrutura do relatório, não seu conteúdo.
function report() {
  const values = {
    A2: "Universidade Federal do Ceará",
    A3: "Sistema Integrado de Gestão de Atividades Acadêmicas",
    A4: "Comissão Própria de Avaliação",
    A6: "CONTEÚDO DAS QUESTÕES ABERTAS (DESCRITIVAS) DA AVALIAÇÃO INSTITUCIONAL",
    A7: "Unidade: ", B7: "Unidade de teste",
    A8: "Período: ", B8: "2026.1",
    A10: "Questionário Docente", B11: "Dimensão: ", C11: "Autoavaliação docente",
    B12: "Questão: ", C12: "Enunciado de teste que não é uma resposta.",
    A14: "Questionário Discente", B15: "Dimensão: ", C15: "Avaliação do ensino",
    B16: "Conteúdo: ", C16: "Outro enunciado, também fora dos comentários.",
    A18: "Docente: ", B18: "Nome fictício do docente",
    B19: "Disciplina: ", C19: "TEST01 - Disciplina A - Turma 01",
    B20: "Comentário do Docente: ", C21: "(Nenhum comentário registrado) ",
    B23: "Comentário dos Discente da Turma: ",
    B24: "1", C24: "  Aula clara. Ana Teste: ana@example.test; 123456. Nota 10.\nSegunda linha.  ",
    B25: "2", C25: "A sala de teste precisa de iluminação.",
    B27: "Disciplina: ", C27: "TEST02 - Disciplina B - Turma 01",
    B28: "Comentário do Docente: ", C29: "(Nenhum comentário registrado) ",
    B31: "Comentário dos Discente da Turma: ", C32: "(Nenhum comentário registrado) ",
    B34: "Disciplina: ", C34: "TEST03 - Disciplina C - Turma 01",
    B35: "Comentário do Docente: ", C36: "(Nenhum comentário registrado) ",
    B38: "Comentário dos Discente da Turma: ",
  };
  for (let row = 39; row <= 47; row += 1) {
    values[`B${row}`] = String(row - 38);
    values[`C${row}`] = `Comentário fictício ${row - 38}.`;
  }
  return { "!ref": "A1:C47", ...Object.fromEntries(Object.entries(values).map(([address, value]) => [address, textCell(value)])) };
}

test("SIGAA importa 11 respostas, ignorando metadados e os quatro avisos de ausência", () => {
  const sheet = report();
  const before = structuredClone(sheet);
  const comments = extractRawComments(sheet, "Sheet0");
  assert.deepEqual(comments.map(({ id }) => id), expectedRows);
  assert.deepEqual(comments, expectedRows.map((row) => ({
    id: row, rowIndex: row, sheetName: "Sheet0", text: sheet[`C${row}`].v,
  })));
  assert.deepEqual(sheet, before);
  assert.ok(Object.isFrozen(comments));
  for (const comment of comments) assert.ok(Object.isFrozen(comment));
  assert.throws(() => { comments[0].id = 1; }, TypeError);
});

test("SIGAA preserva duplicatas, numeração reiniciada por turma e números comuns", () => {
  const sheet = report();
  sheet.B39 = { t: "n", v: 1 };
  sheet.C39 = textCell(sheet.C24.v);
  const comments = extractRawComments(sheet, "Sheet0");
  assert.equal(comments[0].id, 24);
  assert.equal(comments[2].id, 39);
  assert.equal(comments[0].text, comments[2].text);
  assert.match(comments[0].text, /Nota 10\./);
});

test("SIGAA também importa respostas docentes e preserva comentários entre linhas vazias", () => {
  const sheet = report();
  sheet.C21 = textCell("  Resposta docente fictícia.  ");
  delete sheet.B40;
  delete sheet.C40;
  const comments = extractRawComments(sheet, "Sheet0");
  assert.deepEqual(comments.map(({ id }) => id), [21, ...expectedRows.filter((id) => id !== 40)]);
  assert.equal(comments[0].text, sheet.C21.v);
});

test("SIGAA normaliza apenas os rótulos, inclusive o plural correto de discentes", () => {
  const sheet = report();
  sheet.B23 = textCell("  COMENTÁRIOS DOS DISCENTES DA TURMA :  ");
  sheet.B38 = textCell("Comentarios dos Discentes da Turma:");
  sheet.C21 = textCell("  (NENHUM COMENTÁRIO REGISTRADO)\n");
  assert.deepEqual(extractRawComments(sheet, "Dados").map(({ id }) => id), expectedRows);
});

test("SIGAA usa a posição física mesmo com linhas adicionadas antes do relatório", () => {
  const sheet = report();
  const shifted = { "!ref": "A11:C57" };
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    const coordinate = utils.decode_cell(address);
    shifted[utils.encode_cell({ ...coordinate, r: coordinate.r + 10 })] = cell;
  }
  assert.deepEqual(extractRawComments(shifted, "Dados").map(({ id }) => id), expectedRows.map((id) => id + 10));
});

test("SIGAA não confunde palavras de cabeçalho dentro de uma resposta com estrutura", () => {
  const sheet = report();
  sheet.C24 = textCell("Disciplina: Comentário do Docente: <script>texto literal</script>");
  sheet.C25 = textCell("(Nenhum comentário registrado) não descreve minha experiência.");
  const comments = extractRawComments(sheet, "Sheet0");
  assert.equal(comments[0].text, sheet.C24.v);
  assert.equal(comments[1].text, sheet.C25.v);
});

test("SIGAA encerra blocos ao mudar disciplina, docente ou rótulo de metadados", () => {
  const sheet = report();
  sheet.B26 = textCell("Conteúdo:");
  sheet.C26 = textCell("Isto é um enunciado.");
  sheet.C33 = textCell("Fora do bloco após a identificação.");
  sheet.A33 = textCell("Docente:");
  sheet.B33 = textCell("Outro nome fictício");
  assert.deepEqual(extractRawComments(sheet, "Sheet0").map(({ id }) => id), expectedRows);
});

test("SIGAA informa blocos sem disciplina e relatórios sem seções reconhecíveis", () => {
  const orphan = report();
  delete orphan.B19;
  assert.throws(() => extractRawComments(orphan, "Sheet0"), /não possui uma disciplina/);
  const noSections = report();
  for (const row of [20, 23, 28, 31, 35, 38]) delete noSections[`B${row}`];
  assert.throws(() => extractRawComments(noSections, "Sheet0"), /não foram encontrados blocos/);
});

test("SIGAA rejeita fórmulas, erros e números na coluna de respostas", () => {
  for (const cell of [{ t: "n", v: 10 }, { t: "e", v: 7 }, { t: "s", v: "Resultado", f: '"Resultado"' }]) {
    const sheet = report();
    sheet.C24 = cell;
    assert.throws(() => extractRawComments(sheet, "Sheet0"), /célula C24.*texto/);
  }
});

test("SIGAA retorna coleção vazia quando todos os blocos estão sem respostas", () => {
  const sheet = report();
  for (const row of expectedRows) delete sheet[`C${row}`];
  assert.deepEqual(extractRawComments(sheet, "Sheet0"), []);
});

test("o formato tabular continua preservando textos iguais aos rótulos do SIGAA", () => {
  const sheet = {
    "!ref": "A1:A4", A1: textCell("Comentários"),
    A2: textCell("Universidade Federal do Ceará"),
    A3: textCell("CONTEÚDO DAS QUESTÕES ABERTAS"),
    A4: textCell("(Nenhum comentário registrado)"),
  };
  assert.deepEqual(extractRawComments(sheet, "Dados").map(({ text }) => text), [sheet.A2.v, sheet.A3.v, sheet.A4.v]);
});

test("SANITIZED recebe somente as respostas mascaradas do relatório, sem alterar RAW", () => {
  const raw = extractRawComments(report(), "Sheet0");
  const before = structuredClone(raw);
  const sanitized = sanitizeComments(raw, ["Ana Teste"]);
  assert.deepEqual(raw, before);
  assert.deepEqual(sanitized.map(({ id }) => id), expectedRows);
  assert.equal(sanitized[0].text, "  Aula clara. [DADO SENSÍVEL]: [DADO SENSÍVEL]; [DADO SENSÍVEL]. Nota 10.\nSegunda linha.  ");
  for (const comment of sanitized) assert.deepEqual(Object.keys(comment).sort(), ["id", "text"]);
});

test("lê o relatório sintético em XLS binário e XLSX sem acessar outras abas", async (t) => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  t.after(() => { delete globalThis.window; });
  for (const [bookType, extension] of [["biff8", "xls"], ["xlsx", "xlsx"]]) {
    const sheet = report();
    const bytes = write({ SheetNames: ["Sheet0", "Ignorada"], Sheets: {
      Sheet0: sheet,
      Ignorada: { "!ref": "A1:A2", A1: textCell("Comentários"), A2: textCell("Não importar") },
    } }, { bookType, type: "array" });
    const result = await parseXlsxFile(new File([bytes], `relatorio.${extension}`));
    assert.deepEqual(result, extractRawComments(sheet, "Sheet0"));
  }
});
