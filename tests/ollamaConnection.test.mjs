import assert from "node:assert/strict";
import { test } from "node:test";
import { listLocalModels, verifyLocalModel, requestOllama } from "../lib/ollamaConnection.ts";

function browser(t, fn) {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  t.after(() => { delete globalThis.window; });
  return t.mock.method(globalThis, "fetch", fn);
}

test("lista somente DeepSeek locais e descarta duplicatas ou aliases remotos", async (t) => {
  browser(t, async (url, options) => {
    assert.equal(url, "http://localhost:11434/api/tags");
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return Response.json({ models: [
      { name: "deepseek-r1:latest" }, { name: "deepseek-r1:8b" },
      { name: "deepseek-r1:latest" }, { name: "llama3.1:latest" },
      { name: "deepseek-r1:cloud" }, { name: "deepseek-r1:70b", remote_host: "https://cloud.example" },
    ] });
  });
  assert.deepEqual(await listLocalModels(), ["deepseek-r1:8b", "deepseek-r1:latest"]);
});

test("verifica capacidades e bloqueia modelos remotos antes de enviar comentários", async (t) => {
  let body = { capabilities: ["completion", "thinking"] };
  const fetchMock = browser(t, async (url, options) => {
    assert.equal(url, "http://localhost:11434/api/show");
    assert.deepEqual(JSON.parse(options.body), { model: "deepseek-r1:latest" });
    return Response.json(body);
  });
  await verifyLocalModel("deepseek-r1:latest");
  for (body of [{}, { capabilities: ["completion"] }, { capabilities: ["thinking"] }, { capabilities: ["completion", "thinking"], remote_model: "cloud" }]) {
    await assert.rejects(verifyLocalModel("deepseek-r1:latest"), /precisa executar localmente/);
  }
  const count = fetchMock.mock.callCount();
  for (const name of ["https://example.com", "llama3.1", "deepseek-r1:cloud"]) await assert.rejects(verifyLocalModel(name), /DeepSeek-R1 local/);
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
