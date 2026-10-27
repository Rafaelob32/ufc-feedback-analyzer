import test from "node:test";
import assert from "node:assert/strict";
import { parseComments, sanitizeInWorker, ProcessingError, PROCESSING_TIMEOUT_MS } from "../lib/commentProcessing.ts";

const file = new File(["synthetic"], "dados.xlsx");
const raw = Object.freeze([Object.freeze({ id: 4, rowIndex: 4, sheetName: "Aba", text: "Ana: ana@example.test, nota 10" })]);
const settings = { namesText: "Ana", registrationRule: "6-7" };

function browser(t, { failCreation = false, failPost = false } = {}) {
  const workers = [];
  class MockWorker {
    constructor(url, options) {
      if (failCreation) throw new Error("SEGREDO");
      this.url = url;
      this.options = options;
      this.terminations = 0;
      workers.push(this);
    }
    postMessage(data) {
      if (failPost) throw new Error("SEGREDO");
      this.request = structuredClone(data);
    }
    terminate() { this.terminations += 1; }
    reply(data) { this.onmessage({ data: structuredClone(data) }); }
  }
  const descriptors = ["window", "Worker"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: MockWorker });
  t.after(() => {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return workers;
}

test("processamento recusa servidor e sinal já cancelado sem criar Worker", async (t) => {
  await assert.rejects(parseComments(file, new AbortController().signal), /navegador/);
  const workers = browser(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(parseComments(file, controller.signal), { name: "AbortError" });
  assert.equal(workers.length, 0);
});

test("RAW recebido por clone volta congelado, com IDs e texto preservados", async (t) => {
  const workers = browser(t);
  const controller = new AbortController();
  const pending = parseComments(file, controller.signal);
  const worker = workers[0];
  assert.equal(worker.request.kind, "parse");
  assert.equal(worker.request.file.name, "dados.xlsx");
  worker.reply({ kind: "parse", comments: raw });
  const result = await pending;
  assert.deepEqual(result, raw);
  assert.notStrictEqual(result, raw);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result[0]));
  assert.throws(() => { result[0].id = 9; }, TypeError);
  assert.equal(worker.terminations, 1);
  assert.equal(worker.onmessage, null);
  controller.abort();
  assert.equal(worker.terminations, 1);
});

test("SANITIZED permanece separado, sem metadados RAW, e Worker é encerrado", async (t) => {
  const workers = browser(t);
  const pending = sanitizeInWorker(raw, settings, new AbortController().signal);
  const worker = workers[0];
  assert.deepEqual(worker.request, { kind: "sanitize", raw, settings });
  worker.request.raw[0].text = "cópia independente";
  const masked = [{ id: 4, text: "[DADO SENSÍVEL]: [DADO SENSÍVEL], nota 10" }];
  worker.reply({ kind: "sanitize", comments: masked });
  const result = await pending;
  assert.deepEqual(result, masked);
  assert.ok(Object.isFrozen(result[0]));
  assert.ok(Object.isFrozen(result));
  assert.equal(raw[0].text, "Ana: ana@example.test, nota 10");
  assert.equal(worker.terminations, 1);
});

test("cancelamento encerra Worker e ignora mensagem já enfileirada", async (t) => {
  const workers = browser(t);
  const controller = new AbortController();
  const pending = parseComments(file, controller.signal);
  const lateReply = workers[0].onmessage;
  controller.abort();
  lateReply({ data: { kind: "parse", comments: raw } });
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(workers[0].terminations, 1);
});

test("timeout de 60 segundos encerra Worker e permite uma nova operação", async (t) => {
  const workers = browser(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = parseComments(file, new AbortController().signal);
  const rejected = assert.rejects(pending, /excedeu 60 segundos/);
  t.mock.timers.tick(PROCESSING_TIMEOUT_MS);
  await rejected;
  assert.equal(workers[0].terminations, 1);
  const retry = parseComments(file, new AbortController().signal);
  workers[1].reply({ kind: "parse", comments: raw });
  assert.deepEqual(await retry, raw);
});

test("erros de execução/transporte encerram Worker sem expor diagnósticos", async (t) => {
  const workers = browser(t);
  for (const event of ["onerror", "onmessageerror"]) {
    const pending = parseComments(file, new AbortController().signal);
    const worker = workers.at(-1);
    worker[event]({ message: "SEGREDO", preventDefault() {} });
    await assert.rejects(pending, (error) => error instanceof ProcessingError && !error.message.includes("SEGREDO"));
    assert.equal(worker.terminations, 1);
  }
});

test("protocolo inválido falha sem aceitar a coleção de outra operação", async (t) => {
  const workers = browser(t);
  for (const reply of [null, { kind: "sanitize", comments: [] }, { kind: "parse", comments: "SEGREDO" }]) {
    const pending = parseComments(file, new AbortController().signal);
    const worker = workers.at(-1);
    worker.reply(reply);
    await assert.rejects(pending, /resposta inválida/);
    assert.equal(worker.terminations, 1);
  }
});

for (const option of ["failCreation", "failPost"]) {
  test(`falha ${option} é controlada e não expõe entrada`, async (t) => {
    const workers = browser(t, { [option]: true });
    await assert.rejects(parseComments(file, new AbortController().signal), (error) =>
      error instanceof ProcessingError && !error.message.includes("SEGREDO"));
    if (workers.length) assert.equal(workers[0].terminations, 1);
  });
}

test("mensagem controlada de formato da planilha chega à interface", async (t) => {
  const workers = browser(t);
  const pending = parseComments(file, new AbortController().signal);
  workers[0].reply({ kind: "error", message: "A primeira aba da planilha está vazia." });
  await assert.rejects(pending, /primeira aba/);
  assert.equal(workers[0].terminations, 1);
});
