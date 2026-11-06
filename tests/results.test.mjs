import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { AnalysisResultSchema } from "../lib/schema.ts";
import {
  ASPECTS, SENTIMENTS, buildDetailedResultsXlsx, classificationRows, filterClassifications, countSentiments,
  formatSummaryDownload, formatAbsaDashboardCsv, formatAnalysisJson,
} from "../lib/results.ts";

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

test("formata exportação de sumarização, dashboard CSV, JSON e planilha XLSX detalhada sem mutar a entrada", () => {
  const result = {
    summary: [
      { text: "Didática elogiada e laboratório quente.", evidenceIds: [2, 4, 2] },
      { text: "   ", evidenceIds: [6] },
    ],
    absa: [
      { commentId: 6, aspects: [{ aspect: "Avaliação", sentiment: "Positivo" }] },
      { commentId: 2, aspects: [{ aspect: "Didática", sentiment: "Positivo" }, { aspect: "Didática", sentiment: "Positivo" }] },
      { commentId: 4, aspects: [{ aspect: "Infraestrutura", sentiment: "Negativo" }] },
    ],
  };
  const before = structuredClone(result);

  const summaryText = formatSummaryDownload(result, { model: "llama3.1:latest", totalComments: 4 });
  assert.ok(summaryText.includes("Modelo: llama3.1:latest"));
  assert.ok(summaryText.includes("Comentários enviados: 4"));
  assert.ok(summaryText.includes("Comentários com classificação ABSA: 3"));
  assert.ok(summaryText.includes("1. Didática elogiada e laboratório quente.\n   Evidências: [2], [4]"));
  assert.ok(summaryText.includes("2. O modelo não forneceu texto para este ponto.\n   Evidências: [6]"));

  const emptySummary = formatSummaryDownload({ summary: [], absa: [] }, { model: "deepseek-r1:latest", totalComments: 1 });
  assert.ok(emptySummary.includes("O modelo não retornou pontos de síntese para estes comentários."));

  const fullCsv = formatAbsaDashboardCsv(result, { model: "=perigoso, \"teste\"", totalComments: 4 });
  assert.ok(fullCsv.startsWith("\uFEFFIndicador,Valor\r\n"));
  assert.ok(fullCsv.includes('Modelo,"\'=perigoso, ""teste"""\r\n'));
  assert.ok(fullCsv.includes("Comentários sem classificação retornada,1\r\n"));
  assert.ok(fullCsv.includes("Positivo,2,67%\r\nNegativo,1,33%\r\nNeutro,0,0%\r\n"));
  assert.ok(fullCsv.includes("ID do Comentário,Aspecto,Sentimento\r\n2,Didática,Positivo\r\n4,Infraestrutura,Negativo\r\n6,Avaliação,Positivo\r\n"));

  const filteredCsv = formatAbsaDashboardCsv(result, {
    model: "llama3.1:latest", totalComments: 4, aspect: "Infraestrutura", sentiment: "Negativo",
  });
  assert.ok(filteredCsv.includes("Filtro de aspecto,Infraestrutura\r\n"));
  assert.ok(filteredCsv.includes("Filtro de sentimento,Negativo\r\n"));
  assert.ok(filteredCsv.includes("Classificações exibidas,1\r\n"));
  assert.ok(filteredCsv.includes("Negativo,1,100%\r\n"));
  assert.ok(!filteredCsv.includes("2,Didática,Positivo"));

  const exportedJson = JSON.parse(formatAnalysisJson(result));
  assert.deepEqual(AnalysisResultSchema.parse(exportedJson), {
    summary: [
      { text: "Didática elogiada e laboratório quente.", evidenceIds: [2, 4] },
      { text: "   ", evidenceIds: [6] },
    ],
    absa: [
      { commentId: 2, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] },
      { commentId: 4, aspects: [{ aspect: "Infraestrutura", sentiment: "Negativo" }] },
      { commentId: 6, aspects: [{ aspect: "Avaliação", sentiment: "Positivo" }] },
    ],
  });

  const xlsxBytes = buildDetailedResultsXlsx(result, {
    model: "=llama3.1:latest",
    totalComments: 4,
    commentIds: [2, 4, 6, 8],
    aspect: "Infraestrutura",
    sentiment: "Negativo",
  });
  const workbook = XLSX.read(xlsxBytes, { type: "array" });
  assert.deepEqual(workbook.SheetNames, ["Dashboard", "Sumarização", "Classificações ABSA", "Consolidado por ID"]);

  const dashboardRows = XLSX.utils.sheet_to_json(workbook.Sheets["Dashboard"], { header: 1 });
  assert.ok(dashboardRows.some((row) => row[0] === "Modelo utilizado" && row[1] === "'=llama3.1:latest"));
  assert.ok(dashboardRows.some((row) => row[0] === "Cobertura de classificação ABSA" && row[1] === "75%"));
  assert.ok(dashboardRows.some((row) => row[0] === "Didática" && row[1] === 1 && row[2] === 0 && row[4] === 1));

  const summaryRows = XLSX.utils.sheet_to_json(workbook.Sheets["Sumarização"], { header: 1 });
  assert.deepEqual(summaryRows[1], [1, "Didática elogiada e laboratório quente.", 2, "[2], [4]", "2, 4"]);

  const absaRows = XLSX.utils.sheet_to_json(workbook.Sheets["Classificações ABSA"], { header: 1 });
  assert.deepEqual(absaRows[1], [1, 2, "Didática", "Positivo", "Não", 1, "Ponto #1"]);
  assert.deepEqual(absaRows[2], [2, 4, "Infraestrutura", "Negativo", "Sim", 1, "Ponto #1"]);

  const consolidatedRows = XLSX.utils.sheet_to_json(workbook.Sheets["Consolidado por ID"], { header: 1 });
  assert.deepEqual(consolidatedRows[1], [2, "Classificado", 1, "Positivo", "-", "-", "-", "-", "Didática (Positivo)", "Ponto #1"]);
  assert.deepEqual(consolidatedRows[4], [8, "Sem classificação", 0, "-", "-", "-", "-", "-", "-", "Não"]);

  assert.deepEqual(result, before);
});
