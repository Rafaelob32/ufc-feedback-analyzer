import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { evaluateAbsa, ReferenceSchema } from "../scripts/lib/evaluateAbsa.mjs";

const positive = { aspect: "Didática", sentiment: "Positivo" };
const negative = { aspect: "Infraestrutura", sentiment: "Negativo" };
const neutral = { aspect: "Avaliação", sentiment: "Neutro" };
// Metadados fictícios apenas para testar a matemática, não são uma revisão de corpus.
const reference = () => ({ version: 1, status: "human-reviewed", provenance: "unit-test-only",
  review: { reviewer: "unit-test-fixture", date: "2026-10-23" }, comments: [
    { id: 2, text: "A", expectedAspects: [positive, negative], notes: "" },
    { id: 4, text: "B", expectedAspects: [positive], notes: "" },
    { id: 6, text: "C", expectedAspects: [], notes: "" },
  ] });
const result = () => ({ summary: [], absa: [
  { commentId: 2, aspects: [positive] }, { commentId: 4, aspects: [positive, neutral] },
] });

test("ABSA calcula conjuntos multilabel, erros, macro e acerto exato por comentário", () => {
  const actual = evaluateAbsa(reference(), result());
  assert.deepEqual(actual.micro, { tp: 2, fp: 1, fn: 1, precision: 2 / 3, recall: 2 / 3, f1: 2 / 3 });
  assert.equal(actual.exactMatchRate, 1 / 3);
  assert.equal(actual.macroF1, 1 / 3);
  assert.equal(actual.classifiedComments, 2);
  assert.equal(actual.classificationCoverage, 2 / 3);
  assert.equal(actual.perLabel.length, 15);
  assert.equal(actual.perLabel.find((item) => item.aspect === "Infraestrutura" && item.sentiment === "Negativo").recall, 0);
});

test("repetições da IA não inflam métricas nem alteram os objetos", () => {
  const input = result();
  const before = structuredClone(input);
  input.absa.push(structuredClone(input.absa[0]));
  input.absa[0].aspects.push(positive);
  const referenceInput = reference();
  const referenceBefore = structuredClone(referenceInput);
  assert.deepEqual(evaluateAbsa(referenceInput, input), evaluateAbsa(referenceInput, before));
  assert.deepEqual(referenceInput, referenceBefore);
  assert.equal(input.absa.length, 3);
});

test("saída vazia não vira acurácia perfeita; denominadores ausentes são null", () => {
  const output = evaluateAbsa(reference(), { summary: [], absa: [] });
  assert.equal(output.micro.precision, null);
  assert.equal(output.micro.recall, 0);
  assert.equal(output.micro.f1, 0);
  assert.equal(output.exactMatchRate, 1 / 3);
  const emptyReference = reference();
  emptyReference.comments.forEach((comment) => { comment.expectedAspects = []; });
  const empty = evaluateAbsa(emptyReference, { summary: [], absa: [] });
  assert.equal(empty.micro.f1, null);
  assert.equal(empty.macroF1, null);
  assert.equal(empty.exactMatchRate, 1);
});

test("rejeita referência não revisada, IDs repetidos, pares duplicados e IDs inventados", () => {
  for (const input of [{ ...reference(), status: "draft" }, { ...reference(), review: null }]) {
    assert.throws(() => evaluateAbsa(input, result()), /revisão humana/);
  }
  const duplicateId = reference();
  duplicateId.comments[1].id = 2;
  assert.throws(() => evaluateAbsa(duplicateId, result()), /IDs duplicados/);
  const duplicatePair = reference();
  duplicatePair.comments[0].expectedAspects.push(positive);
  assert.throws(() => evaluateAbsa(duplicatePair, result()), /classificações duplicadas/);
  for (const output of [
    { summary: [], absa: [{ commentId: 999, aspects: [positive] }] },
    { summary: [{ text: "Não comprovado", evidenceIds: [999] }], absa: [] },
  ]) assert.throws(() => evaluateAbsa(reference(), output), /ID fora da referência/);
});

test("rascunho sintético cobre os enums, é válido e permanece bloqueado para pontuação", async () => {
  const draft = JSON.parse(await readFile(new URL("./fixtures/absa-draft.json", import.meta.url), "utf8"));
  ReferenceSchema.parse(draft);
  assert.equal(draft.status, "draft");
  assert.equal(draft.review, null);
  assert.equal(new Set(draft.comments.flatMap(({ expectedAspects }) => expectedAspects.map((item) => JSON.stringify(item)))).size, 15);
  assert.throws(() => evaluateAbsa(draft, { summary: [], absa: [] }), /revisão humana/);
});
