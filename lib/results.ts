import * as XLSX from "xlsx";
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

export interface ExportMetadata {
  model: string;
  totalComments: number;
  commentIds?: readonly number[];
  aspect?: Aspect | "";
  sentiment?: Sentiment | "";
}

function safeSpreadsheetText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string | number): string {
  const safe = safeSpreadsheetText(String(value));
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Formata a sumarização rastreável em texto simples, contendo apenas sínteses e IDs (sem comentários RAW/SANITIZED). */
export function formatSummaryDownload(result: AnalysisResult, { model, totalComments }: ExportMetadata): string {
  const rows = classificationRows(result);
  const classified = new Set(rows.map(({ commentId }) => commentId)).size;
  const lines = [
    "AVALIA · SUMARIZAÇÃO RASTREÁVEL",
    `Modelo: ${model}`,
    `Comentários enviados: ${totalComments}`,
    `Comentários com classificação ABSA: ${classified}`,
    `Pontos de síntese: ${result.summary.length}`,
    "",
  ];
  if (result.summary.length === 0) {
    lines.push("O modelo não retornou pontos de síntese para estes comentários.");
  } else {
    result.summary.forEach((item, index) => {
      const ids = [...new Set(item.evidenceIds)].map((id) => `[${id}]`).join(", ");
      const text = item.text.trim() || "O modelo não forneceu texto para este ponto.";
      lines.push(`${index + 1}. ${text}`);
      lines.push(`   Evidências: ${ids}`);
      lines.push("");
    });
  }
  lines.push("Nota: este arquivo contém apenas a síntese gerada pela IA e os IDs de referência (sem textos RAW ou SANITIZED). As interpretações exigem revisão humana.");
  return lines.join("\n") + "\n";
}

/** Formata o dashboard e as classificações ABSA em CSV (UTF-8 com BOM), respeitando filtros ativos e deduplicação. */
export function formatAbsaDashboardCsv(result: AnalysisResult, {
  model, totalComments, aspect = "", sentiment = "",
}: ExportMetadata): string {
  const allRows = classificationRows(result);
  const filtered = filterClassifications(allRows, aspect, sentiment);
  const counts = countSentiments(filtered);
  const classified = new Set(allRows.map(({ commentId }) => commentId)).size;
  const unclassified = Math.max(0, totalComments - classified);
  const csvRows: (string | number)[][] = [
    ["Indicador", "Valor"],
    ["Modelo", model],
    ["Comentários enviados", totalComments],
    ["Comentários com classificação ABSA", classified],
    ["Comentários sem classificação retornada", unclassified],
    ["Filtro de aspecto", aspect || "Todos os aspectos"],
    ["Filtro de sentimento", sentiment || "Todos os sentimentos"],
    ["Classificações exibidas", filtered.length],
    [],
    ["Sentimento", "Quantidade", "Percentual"],
    ...counts.map(({ sentiment: label, count }) => [
      label,
      count,
      `${filtered.length ? Math.round((count / filtered.length) * 100) : 0}%`,
    ]),
    [],
    ["ID do Comentário", "Aspecto", "Sentimento"],
    ...filtered.map((row) => [row.commentId, row.aspect, row.sentiment]),
  ];
  return "\uFEFF" + csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}

/** Exporta o resultado estruturado no contrato AnalysisResult (compatível com evaluate:absa), com IDs e pares deduplicados. */
export function formatAnalysisJson(result: AnalysisResult): string {
  const rows = classificationRows(result);
  const absaByComment = new Map<number, { aspect: Aspect; sentiment: Sentiment }[]>();
  for (const row of rows) {
    const list = absaByComment.get(row.commentId) ?? [];
    list.push({ aspect: row.aspect, sentiment: row.sentiment });
    absaByComment.set(row.commentId, list);
  }
  const normalized: AnalysisResult = AnalysisResultSchema.parse({
    summary: result.summary.map((item) => ({
      text: item.text,
      evidenceIds: [...new Set(item.evidenceIds)],
    })),
    absa: [...absaByComment.entries()].map(([commentId, aspects]) => ({ commentId, aspects })),
  });
  return JSON.stringify(normalized, null, 2) + "\n";
}

/**
 * Gera uma planilha Excel (.xlsx) detalhada em 4 abas:
 * 1. Dashboard (indicadores gerais, distribuição por sentimento, matriz Aspecto x Sentimento e recorte filtrado)
 * 2. Sumarização (pontos de síntese, contagem e lista de IDs de evidência)
 * 3. Classificações ABSA (todas as classificações com status no filtro ativo e cruzamento com o sumário)
 * 4. Consolidado por ID (uma linha por ID de comentário com colunas para os 5 aspectos e citações no sumário)
 * Não recebe nem inclui textos RAW ou SANITIZED.
 */
export function buildDetailedResultsXlsx(result: AnalysisResult, {
  model, totalComments, commentIds = [], aspect = "", sentiment = "",
}: ExportMetadata): Uint8Array {
  const allRows = classificationRows(result);
  const filtered = filterClassifications(allRows, aspect, sentiment);
  const filteredKeys = new Set(filtered.map((r) => JSON.stringify([r.commentId, r.aspect, r.sentiment])));
  const allCounts = countSentiments(allRows);
  const filteredCounts = countSentiments(filtered);
  const classified = new Set(allRows.map(({ commentId }) => commentId)).size;
  const unclassified = Math.max(0, totalComments - classified);
  const coveragePct = totalComments ? `${Math.round((classified / totalComments) * 100)}%` : "0%";

  const summaryPointsByComment = new Map<number, number[]>();
  result.summary.forEach((item, index) => {
    for (const id of new Set(item.evidenceIds)) {
      const list = summaryPointsByComment.get(id) ?? [];
      list.push(index + 1);
      summaryPointsByComment.set(id, list);
    }
  });

  const classificationsByComment = new Map<number, Classification[]>();
  for (const row of allRows) {
    const list = classificationsByComment.get(row.commentId) ?? [];
    list.push(row);
    classificationsByComment.set(row.commentId, list);
  }

  const dashboardAoA: (string | number)[][] = [
    ["AVALIA · RELATÓRIO DETALHADO DA ANÁLISE LOCAL"],
    [],
    ["1. INDICADORES GERAIS DA EXECUÇÃO", "Valor"],
    ["Modelo utilizado", safeSpreadsheetText(model)],
    ["Comentários enviados", totalComments],
    ["Comentários com classificação ABSA", classified],
    ["Comentários sem classificação retornada", unclassified],
    ["Cobertura de classificação ABSA", coveragePct],
    ["Pontos gerados na sumarização", result.summary.length],
    ["Total de classificações ABSA (pares únicos)", allRows.length],
    ["Filtro de aspecto na interface", aspect || "Todos os aspectos"],
    ["Filtro de sentimento na interface", sentiment || "Todos os sentimentos"],
    ["Classificações no filtro ativo", filtered.length],
    [],
    ["2. DISTRIBUIÇÃO GERAL POR SENTIMENTO", "Quantidade", "Percentual"],
    ...allCounts.map(({ sentiment: label, count }) => [
      label,
      count,
      `${allRows.length ? Math.round((count / allRows.length) * 100) : 0}%`,
    ]),
    ["Total Geral", allRows.length, allRows.length ? "100%" : "0%"],
    [],
    ["3. MATRIZ CRUZADA: ASPECTO × SENTIMENTO (GERAL)", "Positivo", "Negativo", "Neutro", "Total do Aspecto", "Participação (%)"],
    ...ASPECTS.map((asp) => {
      const pos = allRows.filter((r) => r.aspect === asp && r.sentiment === "Positivo").length;
      const neg = allRows.filter((r) => r.aspect === asp && r.sentiment === "Negativo").length;
      const neu = allRows.filter((r) => r.aspect === asp && r.sentiment === "Neutro").length;
      const tot = pos + neg + neu;
      return [asp, pos, neg, neu, tot, `${allRows.length ? Math.round((tot / allRows.length) * 100) : 0}%`];
    }),
    [],
    ["4. DISTRIBUIÇÃO NO FILTRO ATIVO", "Quantidade", "Percentual"],
    ...filteredCounts.map(({ sentiment: label, count }) => [
      label,
      count,
      `${filtered.length ? Math.round((count / filtered.length) * 100) : 0}%`,
    ]),
  ];

  const summaryAoA: (string | number)[][] = [
    ["Ponto #", "Síntese Gerada pela IA", "Qtd. Evidências", "IDs de Evidência", "Linhas de Referência"],
    ...(result.summary.length === 0
      ? [["-", "O modelo não retornou pontos de síntese para estes comentários.", 0, "-", "-"]]
      : result.summary.map((item, index) => {
          const uniqueIds = [...new Set(item.evidenceIds)];
          const text = safeSpreadsheetText(item.text.trim() || "O modelo não forneceu texto para este ponto.");
          return [
            index + 1,
            text,
            uniqueIds.length,
            uniqueIds.map((id) => `[${id}]`).join(", "),
            uniqueIds.join(", "),
          ];
        })),
  ];

  const absaAoA: (string | number)[][] = [
    ["Ordem", "ID do Comentário (Linha)", "Aspecto", "Sentimento", "Incluído no Filtro Ativo", "Qtd. Aspectos no Comentário", "Citado na Sumarização"],
    ...(allRows.length === 0
      ? [["-", "-", "Nenhuma classificação ABSA retornada", "-", "-", 0, "-"]]
      : allRows.map((row, index) => {
          const inFilter = filteredKeys.has(JSON.stringify([row.commentId, row.aspect, row.sentiment])) ? "Sim" : "Não";
          const commentTotal = classificationsByComment.get(row.commentId)?.length ?? 0;
          const points = summaryPointsByComment.get(row.commentId);
          const citedText = points?.length ? points.map((p) => `Ponto #${p}`).join(", ") : "Não";
          return [index + 1, row.commentId, row.aspect, row.sentiment, inFilter, commentTotal, citedText];
        })),
  ];

  const allKnownIds = [...new Set([
    ...commentIds,
    ...allRows.map(({ commentId }) => commentId),
    ...result.summary.flatMap(({ evidenceIds }) => evidenceIds),
  ])].sort((a, b) => a - b);

  const consolidatedAoA: (string | number)[][] = [
    ["ID do Comentário (Linha)", "Status ABSA", "Qtd. Classificações", ...ASPECTS, "Resumo de Classificações", "Citado na Sumarização"],
    ...(allKnownIds.length === 0
      ? [["-", "Sem comentários", 0, ...ASPECTS.map(() => "-"), "-", "-"]]
      : allKnownIds.map((id) => {
          const cRows = classificationsByComment.get(id) ?? [];
          const status = cRows.length > 0 ? "Classificado" : "Sem classificação";
          const perAspect = ASPECTS.map((asp) => cRows.filter((r) => r.aspect === asp).map((r) => r.sentiment).join(" / ") || "-");
          const summaryStr = cRows.map((r) => `${r.aspect} (${r.sentiment})`).join("; ") || "-";
          const points = summaryPointsByComment.get(id);
          const citedText = points?.length ? points.map((p) => `Ponto #${p}`).join(", ") : "Não";
          return [id, status, cRows.length, ...perAspect, summaryStr, citedText];
        })),
  ];

  const workbook = XLSX.utils.book_new();

  const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardAoA);
  dashboardSheet["!cols"] = [{ wch: 44 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, dashboardSheet, "Dashboard");

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoA);
  summarySheet["!cols"] = [{ wch: 10 }, { wch: 72 }, { wch: 16 }, { wch: 28 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Sumarização");

  const absaSheet = XLSX.utils.aoa_to_sheet(absaAoA);
  absaSheet["!cols"] = [{ wch: 10 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 26 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, absaSheet, "Classificações ABSA");

  const consolidatedSheet = XLSX.utils.aoa_to_sheet(consolidatedAoA);
  consolidatedSheet["!cols"] = [
    { wch: 24 }, { wch: 18 }, { wch: 20 },
    ...ASPECTS.map(() => ({ wch: 18 })),
    { wch: 48 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(workbook, consolidatedSheet, "Consolidado por ID");

  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
