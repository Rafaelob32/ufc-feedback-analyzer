import { AnalysisResultSchema, type AnalysisResult } from "./schema.ts";

const aspectSchema = AnalysisResultSchema.shape.absa.element.shape.aspects.element;
export const ASPECTS = aspectSchema.shape.aspect.options;
export const SENTIMENTS = aspectSchema.shape.sentiment.options;
export type Aspect = (typeof ASPECTS)[number];
export type Sentiment = (typeof SENTIMENTS)[number];
export interface Classification { commentId: number; aspect: Aspect; sentiment: Sentiment }

/** Uma evidência não é contada duas vezes se o modelo repetir a mesma classificação. */
export function classificationRows(result: AnalysisResult): Classification[] {
  const seen = new Set<string>();
  return result.absa.flatMap(({ commentId, aspects }) => aspects.flatMap(({ aspect, sentiment }) => {
    const key = JSON.stringify([commentId, aspect, sentiment]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ commentId, aspect, sentiment }];
  })).sort((a, b) => a.commentId - b.commentId || ASPECTS.indexOf(a.aspect) - ASPECTS.indexOf(b.aspect));
}

export function filterClassifications(rows: readonly Classification[], aspect: Aspect | "", sentiment: Sentiment | "") {
  return rows.filter((row) => (!aspect || row.aspect === aspect) && (!sentiment || row.sentiment === sentiment));
}

export function countSentiments(rows: readonly Classification[]) {
  return SENTIMENTS.map((sentiment) => ({
    sentiment, count: rows.filter((row) => row.sentiment === sentiment).length,
  }));
}
