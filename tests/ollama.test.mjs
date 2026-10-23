import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AnalysisResultSchema } from "../lib/schema.ts";
import { analyzeComments, OLLAMA_MODEL, OllamaError, parseAnalysisResponse, planAnalysisBatches } from "../lib/ollama.ts";
import { parseXlsxFile } from "../lib/xlsxParser.ts";
import { sanitizeComments } from "../lib/sanitize.ts";

const ids = new Set([2, 4, 6]);
const input = Object.freeze([Object.freeze({ id: 2, text: "A didática foi clara." })]);
const validResult = () => ({
  summary: [{ text: "Didática elogiada; ventilação precisa melhorar.", evidenceIds: [2, 4] }],
  absa: [
    { commentId: 2, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] },
    { commentId: 4, aspects: [{ aspect: "Infraestrutura", sentiment: "Negativo" }] },
    { commentId: 6, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] },
  ],
});

function browser(t, fetchImplementation) {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  t.after(() => { delete globalThis.window; });
  const generate = t.mock.fn(fetchImplementation);
  t.mock.method(globalThis, "fetch", (url, options) => {
    if (url.endsWith("/api/show")) return Promise.resolve(Response.json({ capabilities: ["completion", "thinking"] }));
    return generate(url, options);
  });
  return generate;
}

function abortableFetch(_url, options) {
  return new Promise((_resolve, reject) => {
    const rejectAbort = () => reject(new DOMException("cancelado", "AbortError"));
    if (options.signal.aborted) rejectAbort();
    else options.signal.addEventListener("abort", rejectAbort, { once: true });
  });
}

test("o contrato mantém aspects/sentiment, enums exatos e coleções internas não vazias", () => {
  const result = validResult();
  for (const aspect of ["Didática", "Infraestrutura", "Assiduidade", "Relacionamento", "Avaliação"]) {
    for (const sentiment of ["Positivo", "Negativo", "Neutro"]) {
      result.absa[0].aspects = [{ aspect, sentiment }];
      assert.deepEqual(AnalysisResultSchema.parse(result), result);
    }
  }
  for (const invalid of [
    { ...validResult(), summary: [{ text: "Texto", evidenceIds: [] }] },
    { ...validResult(), summary: [{ text: "Texto", evidenceIds: [2.5] }] },
    { ...validResult(), summary: [{ text: 123, evidenceIds: [2] }] },
    { ...validResult(), absa: [{ commentId: "2", aspects: [{ aspect: "Didática", sentiment: "Positivo" }] }] },
    { ...validResult(), absa: [{ commentId: 2, aspects: [] }] },
    { ...validResult(), absa: [{ commentId: 2, aspect: "Didática", polarity: "Positivo" }] },
    { ...validResult(), absa: [{ commentId: 2, aspects: [{ aspect: "Outro", sentiment: "Positivo" }] }] },
    { ...validResult(), absa: [{ commentId: 2, aspects: [{ aspect: "Didática", sentiment: "Misto" }] }] },
    { summary: [] },
  ]) {
    assert.equal(AnalysisResultSchema.safeParse(invalid).success, false);
  }
  // O schema fornecido permite arrays externos vazios e descarta campos extras.
  assert.deepEqual(AnalysisResultSchema.parse({ summary: [], absa: [], thinking: "oculto" }), { summary: [], absa: [] });
});

test("a conversão produz um JSON Schema completo, incluindo os aspectos aninhados", () => {
  const schema = zodToJsonSchema(AnalysisResultSchema);
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["summary", "absa"]);
  const summary = schema.properties.summary.items;
  assert.equal(summary.properties.evidenceIds.minItems, 1);
  assert.equal(summary.properties.evidenceIds.items.type, "integer");
  const absa = schema.properties.absa.items;
  assert.deepEqual(absa.required, ["commentId", "aspects"]);
  assert.equal(absa.properties.aspects.minItems, 1);
  assert.deepEqual(absa.properties.aspects.items.properties.aspect.enum,
    ["Didática", "Infraestrutura", "Assiduidade", "Relacionamento", "Avaliação"]);
  assert.deepEqual(absa.properties.aspects.items.properties.sentiment.enum, ["Positivo", "Negativo", "Neutro"]);
});

test("remove blocos think multilinha e repetidos antes de interpretar o JSON", () => {
  const text = ` <think>raciocínio\nprivado</think><THINK>outro bloco</THINK>\n${JSON.stringify(validResult())} `;
  assert.deepEqual(parseAnalysisResponse(text, ids), validResult());
  const withResidue = validResult();
  withResidue.summary[0].text = "<think>oculto</think>Texto final";
  assert.equal(parseAnalysisResponse(JSON.stringify(withResidue), ids).summary[0].text, "Texto final");
});

test("rejeita JSON malformado, fences, schema inválido e raciocínio incompleto sem expor conteúdo", () => {
  for (const text of ["SEGREDO", "", '{"summary":', "```json\n{}\n```", "{}", "<think>SEGREDO", "SEGREDO</think>{}"]) {
    assert.throws(() => parseAnalysisResponse(text, ids), (error) =>
      error instanceof OllamaError && !error.message.includes("SEGREDO"));
  }
});

test("rejeita IDs inventados em qualquer evidência ou classificação", () => {
  const wrongEvidence = validResult();
  wrongEvidence.summary.push({ text: "Invenção", evidenceIds: [2, 999] });
  const wrongComment = validResult();
  wrongComment.absa[2].commentId = 999;
  for (const result of [wrongEvidence, wrongComment]) {
    assert.throws(() => parseAnalysisResponse(JSON.stringify(result), ids), /ID que não pertence/);
  }
  assert.deepEqual(parseAnalysisResponse(JSON.stringify(validResult()), ids), validResult());
});

test("a planilha passa por sanitização e somente id/text mascarados entram no Fetch local", async (t) => {
  let sent;
  const fetchMock = browser(t, async (url, options) => {
    assert.equal(url, "http://localhost:11434/api/generate");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    sent = JSON.parse(options.body);
    return Response.json({
      done: true,
      response: `<think>não armazenar</think>${JSON.stringify({ ...validResult(), thinking: "não armazenar" })}`,
      thinking: "também não armazenar",
      context: [123, 456],
    });
  });
  const bytes = await readFile(new URL("./fixtures/comentarios.xlsx", import.meta.url));
  const raw = await parseXlsxFile(new File([bytes], "comentarios.xlsx"));
  const before = structuredClone(raw);
  const sanitized = sanitizeComments(raw, ["Ana Silva"]);
  const result = await analyzeComments(sanitized);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(sent.model, OLLAMA_MODEL);
  assert.equal(sent.think, false);
  assert.equal(sent.stream, false);
  assert.deepEqual(sent.options, { temperature: 0, num_ctx: 8192, num_predict: 2048 });
  assert.deepEqual(sent.format, zodToJsonSchema(AnalysisResultSchema));
  assert.deepEqual(JSON.parse(sent.prompt), { comments: sanitized });
  const serialized = JSON.stringify(sent);
  for (const original of ["Ana Silva", "ana.teste@example.test", "123456", "sheetName", "rowIndex", "comentarios.xlsx"]) {
    assert.ok(!serialized.includes(original), original);
  }
  assert.ok(serialized.includes("[DADO SENSÍVEL]"));
  assert.deepEqual(raw, before);
  assert.deepEqual(result, validResult());
  assert.ok(!JSON.stringify(result).includes("armazenar"));
});

test("rejeita coleção RAW, vazia, duplicada ou com IDs inválidos antes de enviar", async (t) => {
  const fetchMock = browser(t, () => { throw new Error("não deve chamar"); });
  for (const invalid of [
    [],
    [{ id: 2, text: "Original", rowIndex: 2, sheetName: "Avaliações" }],
    [...input, ...input],
    [{ id: -1, text: "Texto" }],
    [{ id: 2.1, text: "Texto" }],
    [{ id: "2", text: "Texto" }],
  ]) {
    await assert.rejects(analyzeComments(invalid), OllamaError);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("a chamada é bloqueada fora do navegador", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", () => { throw new Error("não deve chamar"); });
  await assert.rejects(analyzeComments(input), /navegador/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("falhas HTTP não expõem o corpo de erro do Ollama", async (t) => {
  let status = 404;
  browser(t, async () => new Response("SEGREDO", { status }));
  await assert.rejects(analyzeComments(input), /modelo .* não está disponível/);
  for (status of [403, 500, 503]) {
    await assert.rejects(analyzeComments(input), (error) =>
      error instanceof OllamaError && error.message.includes(`HTTP ${status}`) && !error.message.includes("SEGREDO"));
  }
});

test("envelopes inválidos ou incompletos não produzem sucesso", async (t) => {
  let body;
  browser(t, async () => Response.json(body));
  for (body of [null, {}, { error: "SEGREDO" }, { response: "{}", done: false }, { response: 12, done: true }]) {
    await assert.rejects(analyzeComments(input), /resposta JSON completa/);
  }
});

test("resposta HTTP com corpo não JSON é rejeitada", async (t) => {
  browser(t, async () => new Response("<html>SEGREDO</html>"));
  await assert.rejects(analyzeComments(input), /resposta JSON completa/);
});

test("erros de conexão orientam a conferir o serviço e CORS sem vazar detalhes", async (t) => {
  browser(t, async () => { throw new TypeError("SEGREDO"); });
  await assert.rejects(analyzeComments(input), (error) =>
    error instanceof OllamaError && error.message.includes("OLLAMA_ORIGINS") && !error.message.includes("SEGREDO"));
});

test("cancelamento aborta o Fetch pendente e não retorna resultado", async (t) => {
  const fetchMock = browser(t, abortableFetch);
  const controller = new AbortController();
  const promise = analyzeComments(input, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(promise, { name: "AbortError" });
  assert.equal(fetchMock.mock.calls[0].arguments[1].signal.aborted, true);
  await assert.rejects(analyzeComments(input, controller.signal), { name: "AbortError" });
});

test("o limite de espera aborta o Fetch e informa a falha", async (t) => {
  browser(t, abortableFetch);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const promise = analyzeComments(input);
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(300_000);
  await assert.rejects(promise, /limite de 5 minutos/);
});

test("remove tags think codificadas no JSON e rejeita blocos codificados incompletos", () => {
  const result = validResult();
  result.summary[0].text = "<think>SEGREDO\noculto</think>Texto final";
  const encoded = JSON.stringify(result).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");
  assert.equal(parseAnalysisResponse(encoded, ids).summary[0].text, "Texto final");
  result.summary[0].text = "<think>SEGREDO";
  assert.throws(() => parseAnalysisResponse(JSON.stringify(result).replaceAll("<", "\\u003c"), ids), /incompleto/);
});

test("lotes preservam texto e IDs sem exceder os limites de entrada", () => {
  const comments = Array.from({ length: 30 }, (_, n) => ({ id: n * 2 + 2, text: n % 2 ? "Texto curto" : "Á".repeat(800) }));
  const batches = planAnalysisBatches(comments);
  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat(), comments);
  for (const batch of batches) {
    assert.ok(batch.length <= 8);
    assert.ok(JSON.stringify({ comments: batch }).length <= 3000);
  }
  assert.throws(() => planAnalysisBatches([{ id: 2, text: "\n".repeat(2000) }]), /Nenhum texto foi truncado/);
});

test("analisa vários lotes e valida IDs contra o lote, não somente contra o arquivo", async (t) => {
  let wrongId = false;
  const sent = [];
  browser(t, async (_url, options) => {
    const batch = JSON.parse(JSON.parse(options.body).prompt).comments;
    sent.push(batch);
    return Response.json({ done: true, response: JSON.stringify({
      summary: [{ text: "Síntese", evidenceIds: [wrongId ? 99 : batch[0].id] }],
      absa: batch.map(({ id }) => ({ commentId: id, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] })),
    }) });
  });
  const comments = Array.from({ length: 9 }, (_, index) => ({ id: index === 8 ? 99 : index + 2, text: "Didática clara." }));
  const progress = [];
  const result = await analyzeComments(comments, undefined, { onProgress: (...value) => progress.push(value) });
  assert.deepEqual(sent.flat(), comments);
  assert.deepEqual(progress, [[0, 2], [1, 2], [2, 2]]);
  assert.equal(result.absa.length, 9);
  wrongId = true;
  await assert.rejects(analyzeComments(comments), /ID que não pertence/);
});

test("não aceita saída truncada e não envia nada se houver comentário grande demais", async (t) => {
  const fetchMock = browser(t, async () => Response.json({ done: true, done_reason: "length", response: '{"summary":[],"absa":[]}' }));
  await assert.rejects(analyzeComments(input), /limite de saída/);
  const count = fetchMock.mock.callCount();
  await assert.rejects(analyzeComments([{ id: 2, text: "a".repeat(3000) }]), /limite de 3.000/);
  assert.equal(fetchMock.mock.callCount(), count);
});

test("cancelar após um lote impede o envio do lote seguinte", async (t) => {
  const controller = new AbortController();
  const fetchMock = browser(t, async () => Response.json({ done: true, response: '{"summary":[],"absa":[]}' }));
  const comments = Array.from({ length: 9 }, (_, id) => ({ id: id + 1, text: "Texto." }));
  await assert.rejects(analyzeComments(comments, controller.signal, {
    onProgress(completed) { if (completed === 1) controller.abort(); },
  }), { name: "AbortError" });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("cancelamento no fechamento do último lote também impede retorno de resultado", async (t) => {
  const controller = new AbortController();
  browser(t, async () => Response.json({ done: true, response: '{"summary":[],"absa":[]}' }));
  await assert.rejects(analyzeComments(input, controller.signal, {
    onProgress(completed, total) { if (completed === total) controller.abort(); },
  }), { name: "AbortError" });
});
