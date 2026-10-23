import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

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
