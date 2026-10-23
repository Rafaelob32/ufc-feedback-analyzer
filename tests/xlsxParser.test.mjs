import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { extractRawComments, parseXlsxFile } from "../lib/xlsxParser.ts";

const textCell = (v) => ({ t: "s", v });

test("preserva texto, duplicatas e linhas físicas, mesmo com cabeçalho deslocado", () => {
  const original = "  Comentário bruto: pessoa@example.test\nSegunda linha.  ";
  const sheet = {
    "!ref": "B3:C8",
    B3: textCell("Resposta"), C3: textCell("  COMENTÁRIOS  "),
    C4: textCell(original), C5: textCell(" \t "),
    C7: textCell(original), C8: textCell("Outro comentário."),
  };
  const comments = extractRawComments(sheet, "Avaliações");
  assert.deepEqual(comments, [
    { id: 4, text: original, rowIndex: 4, sheetName: "Avaliações" },
    { id: 7, text: original, rowIndex: 7, sheetName: "Avaliações" },
    { id: 8, text: "Outro comentário.", rowIndex: 8, sheetName: "Avaliações" },
  ]);
  assert.equal(sheet.C4.v, original);
  assert.deepEqual(extractRawComments(sheet, "Avaliações"), comments);
});

test("protege IDs e RAW contra alteração em tempo de execução", () => {
  const comments = extractRawComments({
    "!ref": "A1:A2", A1: textCell("Comentario"), A2: textCell("Original"),
  }, "Dados");
  assert.ok(Object.isFrozen(comments));
  assert.ok(Object.isFrozen(comments[0]));
  assert.throws(() => { comments[0].id = 99; }, TypeError);
  assert.throws(() => { comments[0].text = "Alterado"; }, TypeError);
  assert.throws(() => comments.push(comments[0]), TypeError);
});

test("retorna zero comentários quando a coluna só tem células vazias", () => {
  assert.deepEqual(extractRawComments({
    "!ref": "A1:A3", A1: textCell("Comentários"), A3: textCell("   "),
  }, "Dados"), []);
});

test("informa aba vazia, cabeçalho ausente ou ambíguo", () => {
  assert.throws(() => extractRawComments({}, "Dados"), /vazia/);
  assert.throws(() => extractRawComments({
    "!ref": "A1:A2", A1: textCell("Nome"), A2: textCell("Comentários"),
  }, "Dados"), /primeira linha preenchida/);
  assert.throws(() => extractRawComments({
    "!ref": "A1:B1", A1: textCell("Comentário"), B1: textCell("Comentarios"),
  }, "Dados"), /mais de uma coluna/);
});

test("não converte números, erros nem fórmulas em comentários", () => {
  for (const cell of [
    { t: "n", v: 0 }, { t: "e", v: 7 }, { t: "b", v: false },
    { t: "s", v: "Resultado", f: '"Resultado"' },
    { t: "s", f: '""' },
  ]) {
    assert.throws(() => extractRawComments({
      "!ref": "A1:A2", A1: textCell("Comentário"), A2: cell,
    }, "Dados"), /célula A2.*texto/);
  }
});

test("a leitura de File é bloqueada fora do navegador", async () => {
  await assert.rejects(parseXlsxFile(new File([], "dados.xlsx")), /navegador/);
});

test("lê a planilha sintética real: três comentários, IDs 2, 4 e 6", async () => {
  // Somente o teste simula a presença do navegador; o app usa o File nativo.
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  try {
    const bytes = await readFile(new URL("./fixtures/comentarios.xlsx", import.meta.url));
    const comments = await parseXlsxFile(new File([bytes], "comentarios.xlsx"));
    assert.deepEqual(comments, [
      { id: 2, text: "  A didática foi clara. Ana Silva: ana.teste@example.test; matrícula 123456. Nota 10, tirou 4 e faltou 2 vezes.  ", rowIndex: 2, sheetName: "Avaliações" },
      { id: 4, text: "A sala precisa de ventilação.\nA iluminação está boa.", rowIndex: 4, sheetName: "Avaliações" },
      { id: 6, text: "Gostei das atividades práticas.", rowIndex: 6, sheetName: "Avaliações" },
    ]);
  } finally {
    delete globalThis.window;
  }
});

test("informa arquivo vazio, extensão inválida ou falha de leitura", async () => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  try {
    await assert.rejects(parseXlsxFile(new File([], "vazio.xlsx")), /arquivo está vazio/);
    await assert.rejects(parseXlsxFile(new File(["texto"], "dados.csv")), /Formato não aceito/);
    const unreadable = new File(["bytes"], "ilegivel.xlsx");
    unreadable.arrayBuffer = async () => { throw new Error("Falha simulada"); };
    await assert.rejects(parseXlsxFile(unreadable), /Não foi possível ler/);
    await assert.rejects(parseXlsxFile(new File([new Uint8Array([80, 75, 3, 4])], "corrompido.xlsx")), /Não foi possível ler/);
  } finally {
    delete globalThis.window;
  }
});

test("recusa dimensões excessivas ou truncadas sem varrer a planilha", () => {
  for (const ref of ["A1:A50001", "A1:ZZ1", "A1:Z50000"]) {
    assert.throws(() => extractRawComments({ "!ref": ref, A1: { t: "s", v: "Comentários" } }, "Aba"), /limites de leitura/);
  }
  assert.throws(() => extractRawComments({ "!ref": "A1:A20", "!fullref": "A1:A999999", A1: { t: "s", v: "Comentários" } }, "Aba"), /limites de leitura/);
});

test("recusa arquivo acima de 10 MB antes de ler seus bytes", async (t) => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  t.after(() => { delete globalThis.window; });
  let read = false;
  await assert.rejects(parseXlsxFile({ name: "grande.xlsx", size: 10 * 1024 * 1024 + 1, arrayBuffer() { read = true; } }), /10 MB/);
  assert.equal(read, false);
});
