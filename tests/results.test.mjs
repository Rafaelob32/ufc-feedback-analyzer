import assert from "node:assert/strict";
import { test } from "node:test";
import { ASPECTS, SENTIMENTS, classificationRows, filterClassifications, countSentiments } from "../lib/results.ts";

test("ABSA conta pares únicos por ID preservando sentimentos distintos e a entrada", () => {
  const result = { summary: [], absa: [
    { commentId: 6, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] },
    { commentId: 2, aspects: [{ aspect: "Infraestrutura", sentiment: "Negativo" }, { aspect: "Infraestrutura", sentiment: "Positivo" }] },
    { commentId: 6, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] },
  ] };
  const before = structuredClone(result);
  const rows = classificationRows(result);
  assert.deepEqual(rows.map(({ commentId }) => commentId), [2, 2, 6]);
  assert.deepEqual(countSentiments(rows).map(({ count }) => count), [2, 1, 0]);
  assert.deepEqual(result, before);
  assert.equal(ASPECTS.length, 5);
  assert.equal(SENTIMENTS.length, 3);
  assert.equal(filterClassifications(rows, "Infraestrutura", "Positivo").length, 1);
  assert.equal(filterClassifications(rows, "", "Negativo").length, 1);
  assert.equal(filterClassifications(rows, "Assiduidade", "").length, 0);
  assert.deepEqual(classificationRows({ summary: [], absa: [] }), []);
  assert.deepEqual(countSentiments([]).map(({ count }) => count), [0, 0, 0]);
});
