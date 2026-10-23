import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { evaluateAbsa } from "./lib/evaluateAbsa.mjs";

const [referencePath, resultPath, ...extra] = process.argv.slice(2);
if (!referencePath || !resultPath || extra.length) {
  console.error("Uso: npm run evaluate:absa -- referencia-revisada.json resultado.json");
  process.exitCode = 1;
} else {
  try {
    const [referenceBytes, resultBytes] = await Promise.all([readFile(referencePath), readFile(resultPath)]);
    const metrics = evaluateAbsa(JSON.parse(referenceBytes.toString("utf8")), JSON.parse(resultBytes.toString("utf8")));
    const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      referenceSha256: hash(referenceBytes), resultSha256: hash(resultBytes),
      metrics,
      limitations: "Métricas ABSA contra referência humana declarada. Não avaliam factualidade do sumário, privacidade nem representatividade do corpus.",
    }, null, 2));
  } catch (error) {
    // Não imprime comentários, JSON inválido, caminhos ou erros de schema com dados.
    const controlled = error instanceof Error && ["A referência", "A resposta"].some((prefix) => error.message.startsWith(prefix));
    console.error(controlled ? error.message : "Não foi possível avaliar: confira arquivos JSON, schema e referência revisada.");
    process.exitCode = 1;
  }
}
