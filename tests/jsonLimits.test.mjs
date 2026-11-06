import assert from "node:assert/strict";
import test from "node:test";
import { assertJsonBudget, parseBoundedJson, readBoundedJson, JsonLimitError, MAX_OLLAMA_RESPONSE_BYTES, MAX_OLLAMA_JSON_NODES, MAX_JSON_DEPTH } from "../lib/jsonLimits.ts";
import { parseAnalysisResponse } from "../lib/ollama.ts";

test("limite mede bytes UTF-8 e aceita exatamente o tamanho permitido", () => {
  assert.equal(parseBoundedJson('"á"', 4), "á");
  assert.throws(() => parseBoundedJson('"á"', 3), JsonLimitError);
  const exact = '"' + "a".repeat(MAX_OLLAMA_RESPONSE_BYTES - 2) + '"';
  assert.equal(parseBoundedJson(exact).length, MAX_OLLAMA_RESPONSE_BYTES - 2);
  assert.throws(() => parseBoundedJson(exact + " "), JsonLimitError);
});

test("limita largura e profundidade antes do Zod, sem modificar dados", () => {
  const data = Object.freeze({ nested: Object.freeze([1, 2, null]) });
  assertJsonBudget(data, 5);
  assert.throws(() => assertJsonBudget(data, 4), JsonLimitError);
  assert.deepEqual(data, { nested: [1, 2, null] });
  assert.throws(() => parseBoundedJson(JSON.stringify(Array(MAX_OLLAMA_JSON_NODES).fill(0))), JsonLimitError);
  assert.throws(() => parseBoundedJson(JSON.stringify({ a: Array(10_000).fill(0), b: Array(10_000).fill(0) })), JsonLimitError);
  const depth = (n) => '['.repeat(n) + '0' + ']'.repeat(n);
  assert.doesNotThrow(() => parseBoundedJson(depth(MAX_JSON_DEPTH)));
  assert.throws(() => parseBoundedJson(depth(MAX_JSON_DEPTH + 1)), JsonLimitError);
});

test("stream mantém UTF-8 dividido entre fragmentos e dispensa Content-Length", async () => {
  const text = JSON.stringify({ text: "Avaliação 😀" });
  const bytes = new TextEncoder().encode(text);
  let index = 0;
  const response = new Response(new ReadableStream({
    pull(controller) {
      if (index < bytes.length) controller.enqueue(bytes.subarray(index, ++index));
      else controller.close();
    },
  }));
  assert.deepEqual(await readBoundedJson(response, new AbortController().signal), JSON.parse(text));
  assert.equal(response.body.locked, false);
});

test("corpo excessivo sem header ou com tamanho falso é cancelado e rejeitado", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    let cancelled = 0;
    let calls = 0;
    const response = new Response(new ReadableStream({
      pull(controller) {
        calls += 1;
        controller.enqueue(new Uint8Array(MAX_OLLAMA_RESPONSE_BYTES / 2 + 1));
      },
      cancel() { cancelled += 1; },
    }), { headers });
    await assert.rejects(readBoundedJson(response, new AbortController().signal), JsonLimitError);
    assert.equal(cancelled, 1);
    assert.ok(calls <= 3); // Dois lidos; o stream pode antecipar um fragmento.
    assert.equal(response.body.locked, false);
  }
});

test("header excessivo e cancelamento prévio não precisam ler o corpo", async () => {
  for (const abort of [false, true]) {
    let cancelled = false;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
      headers: { "content-length": String(MAX_OLLAMA_RESPONSE_BYTES + 1) },
    });
    const controller = new AbortController();
    if (abort) controller.abort();
    await assert.rejects(readBoundedJson(response, controller.signal), abort ? { name: "AbortError" } : JsonLimitError);
    assert.equal(cancelled, true);
    assert.equal(response.body.locked, false);
  }
});

test("cancelar durante leitura pendente encerra stream e libera o reader", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"text":')); },
    cancel() { cancelled = true; },
  }));
  const controller = new AbortController();
  const reading = readBoundedJson(response, controller.signal);
  controller.abort();
  await assert.rejects(reading, { name: "AbortError" });
  assert.equal(cancelled, true);
  assert.equal(response.body.locked, false);
});

test("corpos ausentes, JSON incompleto e UTF-8 inválido não produzem sucesso", async () => {
  for (const response of [new Response(null), new Response('{"text":'), new Response(new Uint8Array([0xff]))]) {
    await assert.rejects(readBoundedJson(response, new AbortController().signal));
  }
});

test("JSON interno de análise é limitado mesmo dentro de envelope pequeno", () => {
  const oversized = JSON.stringify({ summary: Array(MAX_OLLAMA_JSON_NODES).fill(0), absa: [] });
  assert.ok(oversized.length < MAX_OLLAMA_RESPONSE_BYTES);
  for (const input of [oversized, '{"summary":[],"absa":[],"extra":' + '['.repeat(33) + '0' + ']'.repeat(33) + '}', "SEGREDO".repeat(MAX_OLLAMA_RESPONSE_BYTES)]) {
    assert.throws(() => parseAnalysisResponse(input, new Set([2])), (error) => !error.message.includes("SEGREDO"));
  }
  assert.deepEqual(parseAnalysisResponse('{"summary":[],"absa":[]}', new Set([2])), { summary: [], absa: [] });
});
