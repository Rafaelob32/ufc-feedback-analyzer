import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const fixture = fileURLToPath(new URL("../fixtures/comentarios.xlsx", import.meta.url));
const result = {
  summary: [{ text: "Didática clara e infraestrutura a melhorar.", evidenceIds: [2, 4] }],
  absa: [
    { commentId: 2, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] },
    { commentId: 4, aspects: [{ aspect: "Infraestrutura", sentiment: "Negativo" }] },
    { commentId: 6, aspects: [{ aspect: "Didática", sentiment: "Positivo" }] },
  ],
};
const envelope = (value = result) => ({ done: true, response: JSON.stringify(value) });

async function setup(page, { generate, thinking = [true, false] } = {}) {
  const requests = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Intercepta toda a origem: nenhum teste envia dados ao Ollama real.
  await page.route("http://localhost:11434/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/tags") return route.fulfill({ json: { models: [{ name: "deepseek-r1:latest" }] } });
    if (path === "/api/show") return route.fulfill({ json: { capabilities: ["completion", "thinking"], thinking: { values: thinking } } });
    expect(path).toBe("/api/generate");
    requests.push(route.request().postDataJSON());
    if (generate) return generate(route);
    return route.fulfill({ json: envelope() });
  });
  await page.goto("/");
  await expect(page.getByLabel("Modelo local", { exact: true })).toHaveValue("deepseek-r1:latest");
  return { requests, errors };
}

async function upload(page) {
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByText("3 comentários identificados e carregados em memória.", { exact: true })).toBeVisible();
  await page.getByLabel("Nomes conhecidos", { exact: true }).fill("Ana Silva");
}

// Controla somente a entrega de mensagens; parsing e sanitização continuam
// executando nos Workers reais do export. Não há hooks de teste na aplicação.
async function controlWorkers(page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const control = window.processingControl = {
      jobs: [], paused: [], failSanitize: false,
      release(kind) {
        this.paused = this.paused.filter((value) => value !== kind);
        this.jobs.filter((job) => job.kind === kind).forEach((job) => job.deliver?.());
      },
    };
    window.Worker = class {
      constructor(url, options) {
        this.native = new NativeWorker(url, options);
        this.terminated = false;
        control.jobs.push(this);
        this.native.onmessage = (event) => {
          this.deliver = () => { this.onmessage?.(event); this.deliver = null; };
          if (!control.paused.includes(this.kind)) this.deliver();
        };
        this.native.onerror = (event) => this.onerror?.(event);
        this.native.onmessageerror = (event) => this.onmessageerror?.(event);
      }
      postMessage(data) {
        this.kind = data.kind;
        if (data.kind === "sanitize" && control.failSanitize) throw new Error("falha sintética");
        this.native.postMessage(data);
      }
      terminate() { this.terminated = true; this.native.terminate(); }
    };
  });
}

test("Worker de leitura mantém a tela utilizável e aplica a configuração mais recente", async ({ page }) => {
  await controlWorkers(page);
  const { requests, errors } = await setup(page);
  await page.evaluate(() => { window.processingControl.paused = ["parse"]; });
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.waitForFunction(() => window.processingControl.jobs.some((job) => job.deliver));
  await expect(page.getByText("Lendo planilha no navegador…", { exact: true })).toBeVisible();
  await page.getByLabel("Nomes conhecidos", { exact: true }).fill("Ana Silva");
  await expect(page.getByLabel("Nomes conhecidos", { exact: true })).toHaveValue("Ana Silva");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
  await page.evaluate(() => window.processingControl.release("parse"));
  const sanitized = page.getByRole("article", { name: "SANITIZED · MASCARADO" });
  await expect(sanitized).toBeVisible();
  await expect(sanitized).not.toContainText("Ana Silva");
  await expect(page.getByRole("article", { name: "RAW · ORIGINAL" })).toContainText("Ana Silva");
  expect(await page.evaluate(() => window.processingControl.jobs.every((job) => job.terminated))).toBe(true);
  expect(requests).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("higienização pendente bloqueia análise e uma edição encerra o Worker anterior", async ({ page }) => {
  await controlWorkers(page);
  const { requests, errors } = await setup(page);
  await upload(page);
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeEnabled();
  await page.evaluate(() => { window.processingControl.paused = ["sanitize"]; });
  await page.getByLabel("Nomes conhecidos", { exact: true }).fill("Ana Silva\nOutro Nome");
  await page.waitForFunction(() => window.processingControl.jobs.at(-1)?.deliver);
  await expect(page.getByText("Higienizando comentários no navegador… Aguarde antes de analisar.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
  await expect(page.getByRole("article", { name: "SANITIZED · MASCARADO" })).toHaveCount(0);
  await page.getByLabel("Nomes conhecidos", { exact: true }).fill("Nome Ausente");
  await page.waitForFunction(() => window.processingControl.jobs.at(-1)?.deliver);
  expect(await page.evaluate(() => window.processingControl.jobs.slice(0, -1).every((job) => job.terminated))).toBe(true);
  await page.evaluate(() => window.processingControl.release("sanitize"));
  await expect(page.getByRole("article", { name: "SANITIZED · MASCARADO" })).toContainText("Ana Silva");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(0);
  expect(errors).toEqual([]);
});

for (const kind of ["parse", "sanitize"]) {
  test(`remover planilha encerra Worker de ${kind} sem restaurar dados`, async ({ page }) => {
    await controlWorkers(page);
    await setup(page);
    await page.evaluate((value) => { window.processingControl.paused = [value]; }, kind);
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await page.waitForFunction((value) => window.processingControl.jobs.some((job) => job.kind === value && job.deliver), kind);
    await page.getByRole("button", { name: /^Remover / }).click();
    expect(await page.evaluate(() => window.processingControl.jobs.every((job) => job.terminated))).toBe(true);
    await page.evaluate((value) => window.processingControl.release(value), kind);
    await expect(page.getByText("3 comentários identificados e carregados em memória.", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
    await upload(page);
    await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeEnabled();
  });
}

test("falha de higienização não libera dados antigos e permite repetir", async ({ page }) => {
  await controlWorkers(page);
  const { requests } = await setup(page);
  await upload(page);
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeEnabled();
  await page.evaluate(() => { window.processingControl.failSanitize = true; });
  await page.getByLabel("Nomes conhecidos", { exact: true }).fill("Ana Silva\nOutro Nome");
  await expect(page.getByRole("region", { name: "Higienização dos comentários" }).getByRole("alert")).toContainText("Não foi possível iniciar");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.evaluate(() => { window.processingControl.failSanitize = false; });
  await page.getByRole("button", { name: "Tentar higienizar novamente" }).click();
  await expect(page.getByRole("article", { name: "RAW · ORIGINAL" })).toContainText("Ana Silva");
  await expect(page.getByRole("article", { name: "SANITIZED · MASCARADO" })).not.toContainText("Ana Silva");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(0);
});

test("navegador sem Worker informa o problema sem fallback síncrono", async ({ page }) => {
  await page.addInitScript(() => { window.Worker = undefined; });
  const { requests } = await setup(page);
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("suporte a Web Workers");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(requests).toHaveLength(0);
});

test("erro de leitura é controlado e nova importação XLS binária recupera o fluxo", async ({ page }) => {
  const { requests, errors } = await setup(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "corrompido.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from([80, 75, 3, 4]) });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível ler a planilha");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Comentário"], ["Nota 10; teste@example.test; matrícula 123456"]]), "Sintética");
  await page.locator('input[type="file"]').setInputFiles({ name: "sintetica.xls", mimeType: "application/vnd.ms-excel", buffer: XLSX.write(workbook, { type: "buffer", bookType: "xls" }) });
  await expect(page.getByText("1 comentário identificado e carregado em memória.", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "SANITIZED · MASCARADO" })).toContainText("Nota 10; [DADO SENSÍVEL]; matrícula [DADO SENSÍVEL]");
  await expect(page.getByRole("article", { name: "RAW · ORIGINAL" })).toContainText("teste@example.test");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("export estático: upload, máscara, payload, resultados, filtros e evidência RAW", async ({ page }) => {
  const { requests, errors } = await setup(page);
  await upload(page);
  const raw = page.getByRole("article", { name: "RAW · ORIGINAL" });
  const sanitized = page.getByRole("article", { name: "SANITIZED · MASCARADO" });
  await expect(raw).toContainText("ana.teste@example.test");
  await expect(sanitized).toContainText("[DADO SENSÍVEL]");
  await expect(sanitized).not.toContainText("Ana Silva");
  await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
  await expect(page.getByText("Análise concluída e validada com sucesso!", { exact: false })).toBeVisible();
  expect(requests).toHaveLength(1);
  const payload = requests[0];
  expect(payload).toMatchObject({ model: "deepseek-r1:latest", think: false, stream: false, options: { temperature: 0 } });
  expect(payload.format.type).toBe("object");
  const comments = JSON.parse(payload.prompt).comments;
  expect(comments.map(({ id }) => id)).toEqual([2, 4, 6]);
  for (const comment of comments) expect(Object.keys(comment).sort()).toEqual(["id", "text"]);
  expect(payload.prompt).not.toMatch(/Ana Silva|ana\.teste@example\.test|123456/);
  expect(comments[0].text).toContain("Nota 10, tirou 4 e faltou 2 vezes.");

  const citation = page.getByRole("button", { name: "Ver comentário original 2", exact: true }).first();
  await citation.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("ana.teste@example.test");
  await expect(dialog).toContainText("Linha 2");
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(citation).toBeFocused();
  expect(requests).toHaveLength(1);

  await page.getByRole("tab", { name: "Dashboard ABSA" }).click();
  await page.getByLabel("Aspecto", { exact: true }).selectOption("Infraestrutura");
  await expect(page.getByRole("table")).toContainText("Negativo");
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);

  const readDownload = async (buttonName) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: buttonName, exact: true }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    return { filename: download.suggestedFilename(), buffer, text: buffer.toString("utf8") };
  };

  const xlsxDownload = await readDownload("Baixar planilha detalhada (.xlsx)");
  expect(xlsxDownload.filename).toBe("avalia-resultados-detalhados.xlsx");
  const exportedWorkbook = XLSX.read(xlsxDownload.buffer, { type: "buffer" });
  expect(exportedWorkbook.SheetNames).toEqual(["Dashboard", "Sumarização", "Classificações ABSA", "Consolidado por ID"]);
  const serializedWorkbook = exportedWorkbook.SheetNames
    .map((name) => JSON.stringify(XLSX.utils.sheet_to_json(exportedWorkbook.Sheets[name], { header: 1 })))
    .join("\n");
  expect(serializedWorkbook).toContain("Didática clara e infraestrutura a melhorar.");
  expect(serializedWorkbook).not.toMatch(/Ana Silva|ana\.teste@example\.test|123456/);

  const summaryDownload = await readDownload("Baixar sumarização (.txt)");
  expect(summaryDownload.filename).toBe("avalia-sumarizacao.txt");
  expect(summaryDownload.text).toContain("Didática clara e infraestrutura a melhorar.");
  expect(summaryDownload.text).toContain("Evidências: [2], [4]");
  expect(summaryDownload.text).not.toMatch(/Ana Silva|ana\.teste@example\.test|123456/);

  const csvDownload = await readDownload("Baixar dashboard ABSA (.csv)");
  expect(csvDownload.filename).toBe("avalia-dashboard-absa.csv");
  expect(csvDownload.text).toContain("Filtro de aspecto,Infraestrutura");
  expect(csvDownload.text).toContain("4,Infraestrutura,Negativo");
  expect(csvDownload.text).not.toContain("2,Didática,Positivo");
  expect(csvDownload.text).not.toMatch(/Ana Silva|ana\.teste@example\.test|123456/);

  const jsonDownload = await readDownload("Baixar JSON (.json)");
  expect(jsonDownload.filename).toBe("avalia-resultado.json");
  expect(JSON.parse(jsonDownload.text)).toEqual(result);
  expect(jsonDownload.text).not.toMatch(/Ana Silva|ana\.teste@example\.test|123456/);

  await page.getByLabel("Sentimento", { exact: true }).selectOption("Positivo");
  await expect(page.getByText("Nenhuma classificação corresponde aos filtros.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

for (const action of ["cancelar", "alterar nomes", "trocar arquivo"]) {
  test(`resposta pendente não reaparece após ${action}`, async ({ page }) => {
    let release;
    let started;
    let delivered;
    const pending = new Promise((resolve) => { release = resolve; });
    const received = new Promise((resolve) => { started = resolve; });
    const finished = new Promise((resolve) => { delivered = resolve; });
    await setup(page, { generate: async (route) => {
      started();
      await pending;
      await route.fulfill({ json: envelope() });
      delivered();
    } });
    await upload(page);
    await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
    await received;
    if (action === "cancelar") await page.getByRole("button", { name: "Cancelar análise" }).click();
    if (action === "alterar nomes") await page.getByLabel("Nomes conhecidos", { exact: true }).fill("Ana Silva\nOutro Nome");
    if (action === "trocar arquivo") await page.locator('input[type="file"]').setInputFiles(fixture);
    release();
    await finished;
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeEnabled();
    await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toHaveCount(0);
    // Uma nova análise comprova recuperação e não apenas ausência momentânea.
    await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toBeVisible();
  });
}

test("ID inventado é rejeitado e a interface permite tentar novamente", async ({ page }) => {
  let invalid = true;
  await setup(page, { generate: (route) => route.fulfill({ json: envelope(invalid
    ? { summary: [{ text: "Inválido", evidenceIds: [999] }], absa: [] } : result) }) });
  await upload(page);
  await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
  await expect(page.getByRole("region", { name: "Analisar com o Ollama" }).getByRole("alert")).toContainText("ID que não pertence");
  await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toHaveCount(0);
  invalid = false;
  await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toBeVisible();
});

for (const excessive of ["bytes", "coleção interna"]) {
  test(`resposta com excesso de ${excessive} é descartada e permite nova análise`, async ({ page }) => {
    let invalid = true;
    await setup(page, { generate: (route) => route.fulfill({ json: invalid
      ? { done: true, response: excessive === "bytes" ? "SEGREDO".repeat(160_000)
        : JSON.stringify({ summary: Array(20_001).fill(null), absa: [] }) }
      : envelope() }) });
    await upload(page);
    await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
    const alert = page.getByRole("region", { name: "Analisar com o Ollama" }).getByRole("alert");
    await expect(alert).toContainText(/limite local|contrato JSON/);
    await expect(alert).not.toContainText("SEGREDO");
    await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "RAW · ORIGINAL" })).toContainText("Ana Silva");
    invalid = false;
    await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toBeVisible();
  });
}

test("modelo incompatível é bloqueado antes de receber comentários", async ({ page }) => {
  const { requests } = await setup(page, { thinking: ["low", "high"] });
  await upload(page);
  await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
  await expect(page.getByRole("region", { name: "Analisar com o Ollama" }).getByRole("alert")).toContainText("não declara suporte a think: false");
  expect(requests).toHaveLength(0);
});

test("remoção descarta resultados; configurações duram somente até recarregar", async ({ page }) => {
  await setup(page);
  await upload(page);
  await page.getByRole("button", { name: "Analisar com IA", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toBeVisible();
  await page.getByRole("button", { name: /^Remover / }).click();
  await expect(page.getByRole("tab", { name: "Sumário rastreável" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Nomes conhecidos", { exact: true })).toHaveValue("Ana Silva");
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, ""]);
  await page.reload();
  await expect(page.getByLabel("Nomes conhecidos", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
});

test("comparação pagina as opções e localiza IDs originais com lacunas", async ({ page }) => {
  await setup(page);
  const workbook = XLSX.utils.book_new();
  const rows = [["Comentário"], ...Array.from({ length: 220 }, (_, i) => [[`Comentário sintético ${i + 1}`], []]).flat()];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Lacunas");
  await page.locator('input[type="file"]').setInputFiles({ name: "paginada.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) });
  const select = page.getByLabel("Comentário para comparar", { exact: true });
  const raw = page.getByRole("article", { name: "RAW · ORIGINAL" });
  await expect(select.locator("option")).toHaveCount(100);
  await expect(select).toHaveValue("2");
  await page.getByRole("button", { name: "Próximos comentários" }).click();
  await expect(select).toHaveValue("202");
  await expect(raw).toContainText("Comentário sintético 101");
  await page.getByLabel("Ir para o ID original").fill("440");
  await page.getByRole("button", { name: "Localizar comentário" }).click();
  await expect(select).toHaveValue("440");
  await expect(select.locator("option")).toHaveCount(20);
  await expect(raw).toContainText("Comentário sintético 220");
  await expect(page.getByRole("button", { name: "Próximos comentários" })).toBeDisabled();
  await page.getByLabel("Ir para o ID original").fill("3");
  await page.getByRole("button", { name: "Localizar comentário" }).click();
  await expect(page.getByText("Não há comentário com esse ID nesta planilha.")).toBeVisible();
  await expect(select).toHaveValue("440");
  await page.getByRole("button", { name: "Comentários anteriores" }).click();
  await expect(select).toHaveValue("202");
  await expect(page.getByText("Não há comentário com esse ID nesta planilha.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Localizar comentário" }).click();
  await expect(page.getByText("Não há comentário com esse ID nesta planilha.")).toBeVisible();
  const replacement = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(replacement, XLSX.utils.aoa_to_sheet([["Comentário"], ...Array.from({ length: 120 }, (_, i) => [`Novo comentário ${i + 1}`])]), "Sem lacunas");
  await page.locator('input[type="file"]').setInputFiles({ name: "outra.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(replacement, { type: "buffer", bookType: "xlsx" }) });
  await expect(page.getByText("120 comentários identificados e carregados em memória.", { exact: true })).toBeVisible();
  await expect(page.getByText("Não há comentário com esse ID nesta planilha.")).toHaveCount(0);
  await page.getByRole("button", { name: "Localizar comentário" }).click();
  await expect(select).toHaveValue("3");
  await upload(page);
  await expect(select.locator("option")).toHaveCount(3);
  await expect(select).toHaveValue("2");
  await expect(page.getByRole("navigation", { name: "Páginas de comentários para comparar" })).toHaveCount(0);
});
