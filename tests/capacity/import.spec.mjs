import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import os from "node:os";

// Dados gerados no teste; não lê relatórios institucionais nem faz inferência.
const sizes = process.env.CAPACITY_MAX === "50000" ? [100, 1_000, 10_000, 49_999] : [100, 1_000, 10_000];
for (const count of sizes) {
  test(`${count} comentários sintéticos`, async ({ page, browser }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://localhost:11434/**", (route) => route.fulfill({ json: { models: [] } }));
    await page.goto("/");
    await page.addScriptTag({ content: `
      window.capacityTasks = [];
      new PerformanceObserver(list => window.capacityTasks.push(...list.getEntries().map(e => e.duration)))
        .observe({type: 'longtask'});
    ` });
    const text = "Jose\u0301 Sintético: teste@example.test; matrícula 123456. Nota 10, boa didática.";
    const workbook = XLSX.utils.book_new();
    const rows = [["Comentário"], ...Array.from({ length: count }, (_, i) => [text + " Item " + (i + 1)])];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sintética");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
    const started = performance.now();
    await page.locator('input[type="file"]').setInputFiles({ name: "capacidade.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
    await expect(page.getByText(`${count} comentários identificados e carregados em memória.`, { exact: true })).toBeVisible();
    const importedMs = performance.now() - started;
    const dictionary = ["José Sintético", ...Array.from({ length: 99 }, (_, i) => "Nome Fictício " + i)].join("\n");
    const editing = performance.now();
    await page.getByLabel("Nomes conhecidos", { exact: true }).fill(dictionary);
    await expect(page.getByRole("article", { name: "SANITIZED · MASCARADO" })).not.toContainText("Jose\u0301 Sintético");
    await expect(page.getByRole("article", { name: "RAW · ORIGINAL" })).toContainText("Jose\u0301 Sintético");
    const editMs = performance.now() - editing;
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const metrics = await page.evaluate(() => ({
      optionCount: document.querySelectorAll("#preview-comment option").length,
      domNodes: document.querySelectorAll("*").length,
      longTasks: window.capacityTasks.length,
      longestTaskMs: Math.max(0, ...window.capacityTasks),
      observedHeapBytes: performance.memory?.usedJSHeapSize ?? null,
    }));
    expect(metrics.optionCount).toBe(Math.min(count, 100));
    expect(errors).toEqual([]);
    const report = {
      comments: count, names: 100, fileBytes: buffer.length,
      importedMs: Math.round(importedMs), editMs: Math.round(editMs), ...metrics,
      environment: { cpu: os.cpus()[0].model, logicalCpus: os.cpus().length,
        ramBytes: os.totalmem(), os: os.release(), node: process.version, chromium: browser.version() },
    };
    console.log("CAPACITY " + JSON.stringify(report));
    await testInfo.attach("capacity.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
    await page.getByRole("button", { name: /^Remover / }).click();
    await expect(page.getByRole("button", { name: "Analisar com IA", exact: true })).toBeDisabled();
  });
}
