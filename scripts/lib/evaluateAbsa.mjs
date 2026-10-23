import { z } from "zod";
import { AnalysisResultSchema } from "../../lib/schema.ts";

const AspectSchema = AnalysisResultSchema.shape.absa.element.shape.aspects.element;
export const ReferenceSchema = z.object({
  version: z.literal(1),
  status: z.enum(["draft", "human-reviewed"]),
  provenance: z.string().min(1),
  review: z.object({ reviewer: z.string().trim().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullable(),
  comments: z.array(z.object({
    id: z.number().int().positive().safe(), text: z.string().min(1),
    expectedAspects: z.array(AspectSchema), notes: z.string(),
  }).strict()).min(1),
}).strict();

const pairKey = ({ aspect, sentiment }) => JSON.stringify([aspect, sentiment]);
const tripleKey = (id, item) => JSON.stringify([id, item.aspect, item.sentiment]);
const divide = (numerator, denominator) => denominator ? numerator / denominator : null;
function scores(tp, fp, fn) {
  return { tp, fp, fn, precision: divide(tp, tp + fp), recall: divide(tp, tp + fn), f1: divide(2 * tp, 2 * tp + fp + fn) };
}

/** Ferramenta de desenvolvimento: não é importada pelo frontend nem acessa rede. */
export function evaluateAbsa(referenceInput, resultInput) {
  const reference = ReferenceSchema.parse(referenceInput);
  if (reference.status !== "human-reviewed" || !reference.review) {
    throw new Error("A referência precisa de revisão humana registrada antes de calcular métricas. O rascunho sintético não é um gabarito validado.");
  }
  const ids = new Set(reference.comments.map(({ id }) => id));
  if (ids.size !== reference.comments.length) throw new Error("A referência contém IDs duplicados.");
  for (const comment of reference.comments) {
    if (new Set(comment.expectedAspects.map(pairKey)).size !== comment.expectedAspects.length) {
      throw new Error("A referência contém classificações duplicadas.");
    }
  }
  const result = AnalysisResultSchema.parse(resultInput);
  const returnedIds = [...result.absa.map(({ commentId }) => commentId), ...result.summary.flatMap(({ evidenceIds }) => evidenceIds)];
  if (returnedIds.some((id) => !ids.has(id))) throw new Error("A resposta contém um ID fora da referência.");

  const expected = new Set(reference.comments.flatMap(({ id, expectedAspects }) => expectedAspects.map((item) => tripleKey(id, item))));
  const predicted = new Set(result.absa.flatMap(({ commentId, aspects }) => aspects.map((item) => tripleKey(commentId, item))));
  let tp = 0;
  for (const key of predicted) if (expected.has(key)) tp += 1;
  const perLabel = [];
  for (const aspect of AspectSchema.shape.aspect.options) {
    for (const sentiment of AspectSchema.shape.sentiment.options) {
      let hits = 0;
      let expectedCount = 0;
      let predictedCount = 0;
      for (const id of ids) {
        const key = tripleKey(id, { aspect, sentiment });
        const truth = expected.has(key);
        const prediction = predicted.has(key);
        if (truth) expectedCount += 1;
        if (prediction) predictedCount += 1;
        if (truth && prediction) hits += 1;
      }
      perLabel.push({ aspect, sentiment, support: expectedCount, ...scores(hits, predictedCount - hits, expectedCount - hits) });
    }
  }
  const incorrectIds = new Set();
  for (const key of expected) if (!predicted.has(key)) incorrectIds.add(JSON.parse(key)[0]);
  for (const key of predicted) if (!expected.has(key)) incorrectIds.add(JSON.parse(key)[0]);
  const definedF1 = perLabel.map(({ f1 }) => f1).filter((value) => value !== null);
  return {
    comments: ids.size,
    classifiedComments: new Set(result.absa.map(({ commentId }) => commentId)).size,
    classificationCoverage: new Set(result.absa.map(({ commentId }) => commentId)).size / ids.size,
    exactMatchRate: (ids.size - incorrectIds.size) / ids.size,
    micro: scores(tp, predicted.size - tp, expected.size - tp),
    macroF1: definedF1.length ? definedF1.reduce((sum, f1) => sum + f1, 0) / definedF1.length : null,
    perLabel,
    summaryItemsRequiringHumanReview: result.summary.length,
  };
}
