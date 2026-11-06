import assert from "node:assert/strict";
import { test } from "node:test";
import { listLocalModels, verifyLocalModel, requestOllama } from "../lib/ollamaConnection.ts";
import { MAX_OLLAMA_RESPONSE_BYTES, MAX_OLLAMA_JSON_NODES } from "../lib/jsonLimits.ts";

test("respostas excessivas são rejeitadas sem revelar conteúdo e permitem nova consulta", async (t) => {
  let response = () => new Response("SEGREDO".repeat(MAX_OLLAMA_RESPONSE_BYTES / 7 + 1));
  browser(t, async () => response());
  await assert.rejects(listLocalModels(), (error) => error.message.includes("limite local") && !error.message.includes("SEGREDO"));
  response = () => Response.json({ models: Array(MAX_OLLAMA_JSON_NODES).fill(0) });
  await assert.rejects(listLocalModels(), /complexidade JSON/);
  response = () => Response.json({ models: [{ name: "deepseek-r1:latest" }] });
  assert.deepEqual(await listLocalModels(), ["deepseek-r1:latest"]);
});

test("timeout enquanto recebe o corpo cancela a leitura parcial", async (t) => {
  let cancelled = false;
  let receiving;
  const started = new Promise((resolve) => { receiving = resolve; });
  browser(t, async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"models":')); receiving(); },
    cancel() { cancelled = true; },
  })));
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = listLocalModels();
  await started;
  t.mock.timers.tick(10_000);
  await assert.rejects(pending, /10 segundos/);
  assert.equal(cancelled, true);
});

function browser(t, fn) {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  t.after(() => { delete globalThis.window; });
  return t.mock.method(globalThis, "fetch", fn);
}

test("lista somente DeepSeek e Llama 3.1 locais e descarta duplicatas ou aliases remotos", async (t) => {
  browser(t, async (url, options) => {
    assert.equal(url, "http://localhost:11434/api/tags");
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return Response.json({ models: [
      { name: "deepseek-r1:latest" }, { name: "deepseek-r1:8b" },
      { name: "deepseek-r1:latest" }, { name: "llama3.1:latest" },
      { name: "llama3.1:cloud" }, { name: "mistral:latest" },
      { name: "deepseek-r1:cloud" }, { name: "deepseek-r1:70b", remote_host: "https://cloud.example" },
    ] });
  });
  assert.deepEqual(await listLocalModels(), ["deepseek-r1:8b", "deepseek-r1:latest", "llama3.1:latest"]);
});

test("verifica capacidades e bloqueia modelos remotos antes de enviar comentários", async (t) => {
  let body = { capabilities: ["completion", "thinking"], thinking: { values: [true, false] } };
  const fetchMock = browser(t, async (url, options) => {
    assert.equal(url, "http://localhost:11434/api/show");
    assert.deepEqual(JSON.parse(options.body), { model: "deepseek-r1:latest" });
    return Response.json(body);
  });
  await verifyLocalModel("deepseek-r1:latest");
  for (body of [{}, { capabilities: ["completion"], thinking: null }, { capabilities: ["thinking"] }, { capabilities: ["completion", "thinking"], remote_model: "cloud" }]) {
    await assert.rejects(verifyLocalModel("deepseek-r1:latest"), /precisa executar localmente/);
  }
  const count = fetchMock.mock.callCount();
  for (const name of ["https://example.com", "mistral:latest", "deepseek-r1:cloud", "llama3.1:cloud"]) await assert.rejects(verifyLocalModel(name), /modelo local compatível/);
  assert.equal(fetchMock.mock.callCount(), count);
});

test("falha com resposta inválida, HTTP ou CORS sem expor corpo ou detalhes", async (t) => {
  let response = () => Response.json({});
  browser(t, async () => response());
  await assert.rejects(listLocalModels(), /lista de modelos/);
  response = () => new Response("SEGREDO", { status: 403 });
  await assert.rejects(listLocalModels(), /HTTP 403/);
  response = () => { throw new Error("SEGREDO"); };
  await assert.rejects(listLocalModels(), (error) => error.message.includes("OLLAMA_ORIGINS") && !error.message.includes("SEGREDO"));
});

test("consulta de modelos respeita cancelamento e timeout", async (t) => {
  const fetchMock = browser(t, (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("cancelado", "AbortError")));
  }));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(listLocalModels(controller.signal), { name: "AbortError" });
  assert.equal(fetchMock.mock.callCount(), 0);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = listLocalModels();
  t.mock.timers.tick(10_000);
  await assert.rejects(pending, /10 segundos/);
});

test("consultas ao Ollama são bloqueadas fora do navegador", async () => {
  await assert.rejects(requestOllama("tags"), /navegador/);
});

test("recusa valores de thinking que não incluam false antes de enviar dados", async (t) => {
  let values;
  const fetchMock = browser(t, async () => Response.json({
    capabilities: ["completion", "thinking"], thinking: { values },
  }));
  for (values of [["low", "high"], [true], ["false"], []]) {
    await assert.rejects(verifyLocalModel("deepseek-r1:latest"), /think: false/);
  }
  assert.equal(fetchMock.mock.callCount(), 4);
});

test("aceita false explícito, inclusive modelo sem capacidade thinking", async (t) => {
  const fetchMock = browser(t, async () => Response.json({
    capabilities: ["completion"], thinking: { values: [false] },
  }));
  await verifyLocalModel("deepseek-r1:latest");
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("sem metadados usa sonda estruturada sem comentários antes da análise", async (t) => {
  const fetchMock = browser(t, async (url, options) => {
    if (url.endsWith("/show")) return Response.json({ capabilities: ["completion", "thinking"] });
    assert.equal(url, "http://localhost:11434/api/generate");
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, "deepseek-r1:latest");
    assert.equal(payload.think, false);
    assert.equal(payload.stream, false);
    assert.equal(payload.options.temperature, 0);
    assert.equal(payload.format.additionalProperties, false);
    assert.equal(payload.prompt, 'Teste de compatibilidade sem dados pessoais. Retorne somente o JSON {"ok":true}, sem raciocínio.');
    return Response.json({ done: true, response: '{"ok":true}', thinking: "" });
  });
  await verifyLocalModel("deepseek-r1:latest");
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("sonda rejeita raciocínio, saída incompleta e resposta inesperada sem expor texto", async (t) => {
  let body;
  browser(t, async (url) => url.endsWith("/show")
    ? Response.json({ capabilities: ["completion"] }) : Response.json(body));
  for (body of [
    { done: true, response: '{"ok":true}', thinking: "SEGREDO" },
    { done: true, response: '<think>SEGREDO</think>{"ok":true}' },
    { done: true, response: '{"ok":true}', done_reason: "length" },
    { done: false, response: '{"ok":true}' },
    { done: true, response: '{"ok":false}' },
    { done: true, response: '{"ok":true,"extra":"SEGREDO"}' },
    { done: true, response: "SEGREDO" },
  ]) {
    await assert.rejects(verifyLocalModel("deepseek-r1:latest"), (error) =>
      error.message.includes("Nenhum comentário foi enviado") && !error.message.includes("SEGREDO"));
  }
});

test("cancelamento interrompe a sonda de compatibilidade", async (t) => {
  const controller = new AbortController();
  browser(t, async (url, { signal }) => {
    if (url.endsWith("/show")) return Response.json({ capabilities: ["completion"] });
    return new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("cancelado", "AbortError")));
      controller.abort();
    });
  });
  await assert.rejects(verifyLocalModel("deepseek-r1:latest", controller.signal), { name: "AbortError" });
});
