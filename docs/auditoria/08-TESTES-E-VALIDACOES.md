# 08 — Testes e validações

[Índice](README.md) · [Requisitos](04-RASTREABILIDADE-DOS-REQUISITOS.md) · [Achados](09-NAO-CONFORMIDADES.md)

Execuções desta auditoria: 20/10/2026. Diretório de trabalho: raiz da aplicação. Nenhum teste de aplicação foi criado ou modificado. Sondagens investigativas foram executadas por stdin, sem salvar código de produto ou dados reais.

## Registro atual de comandos e resultados

| ID | Comando/procedimento executado | Resultado |
| --- | --- | --- |
| V01 | `rg --files --hidden` com exclusões de gerados; leitura integral dos arquivos relevantes; `npm ls --depth=0`; `npm ls braces micromatch fast-glob` | 38 arquivos de baseline; dependências resolvidas; seis extras; cadeia vulnerável localizada |
| V02 | `npm test` | Exit 0: **63 passaram**, 0 falhas, 0 cancelados, 0 ignorados, 0 todo |
| V03 | `npm run lint` | Exit 0, sem erros/warnings do ESLint |
| V04 | `./node_modules/.bin/tsc --noEmit --incremental false` | Exit 0, sem diagnóstico |
| V05 | Busca `rg` por Fetch, storage, cookies, Server Actions, HTML perigoso, eval, logs, env, TODO e URLs; inspeção de imports locais | Um Fetch autoral, origem Ollama; nenhuma API de persistência/execução HTML encontrada; nenhum ciclo local identificado |
| V06a | `npm run build`, ambiente restrito | **Exit 1:** `Could not parse output from TypeScript's --showConfig` |
| V06b | Mesmo `npm run build`, repetido fora do isolamento da ferramenta, sem alteração de código | **Exit 0:** Next 16.4.0/webpack, TypeScript concluído, `/` e `/_not-found` estáticas, `out/` produzido |
| V07 | Python `ThreadingHTTPServer` sobre `out/`, porta efêmera em 127.0.0.1, requisições por `urllib.request`, encerramento no finally | HTML HTTP 200 e **oito assets JS/CSS HTTP 200**; sem servidor Next nesse teste |
| V08a | `npm audit --json` | Exit 1: cinco entradas altas na mesma cadeia; zero críticas/médias/baixas |
| V08b | `npm audit --omit=dev --json` | Exit 0: zero avisos de vulnerabilidade reportados |
| V08c | `npm outdated --json` | Exit 1 normal para pacotes desatualizados; versões documentadas em 07 |
| V09 | HTTP GET localhost:3000; Ollama GET version/tags; POST show apenas com modelo; OPTIONS generate com Origin localhost:3000 | Frontend 200; Ollama 0.33.3; tag/digest/metadados registrados; CORS 204 e origem permitida |
| V10 | Nova aba independente no navegador integrado em localhost:3000; inspeção DOM/AX, console e medidas | Tela Avalia carregou; modelo local listado; analisar desabilitado sem arquivo; idioma pt-BR; largura/scrollWidth 1265/1265; console sem warn/error capturado. Aba fechada ao terminar |
| V11 | `node --test --test-isolation=none --experimental-test-coverage tests/*.test.mjs` | Exit 0, 63 testes passaram; cobertura reportada abaixo |
| V12 | P01–P06, scripts Node com imports reais e Fetch simulado quando indicado | Achados/restrições reproduzidos; resultados abaixo |
| V13 | `git status --short`, `git rev-parse HEAD`, `git log -5 --oneline` | Exit 128: não há repositório Git disponível |
| V14 | Manifesto SHA-256 antes/depois; validação dos Markdown, links locais, nomes de arquivos e referências de achados | Baseline intacta; exatamente 11 novos Markdown no diretório da auditoria |

V06a não foi escondido ou classificado como sucesso. A diferença de ambiente e o sucesso de V04/V06b são compatíveis com limitação de captura de subprocessos da ferramenta; a causa interna exata não foi isolada. Não foi necessária correção de aplicação para o build passar.

O total dos arquivos JS/CSS exportados foi **1.433.795 bytes sem compressão**, incluindo chunks não necessariamente carregados de início. Não é medição de tráfego inicial, desempenho de rede ou tempo de interação.

## Logs locais e trechos essenciais

Foram produzidos logs temporários `/tmp/avalia-audit-test.log`, `avalia-audit-lint.log`, `avalia-audit-tsc.log`, `avalia-audit-build.log`, `avalia-audit-build-escalated.log`, `avalia-audit-coverage.log` e respostas npm `avalia-audit-full.json`, `avalia-audit-prod.json`, `avalia-audit-outdated.json`. Arquivos temporários não são garantia de retenção; os resultados relevantes estão transcritos neste conjunto documental. Não se copiou conteúdo de comentários reais para logs ou relatórios.

```text
npm test
tests 63
pass 63
fail 0
cancelled 0
skipped 0
todo 0

build fora do isolamento
Compiled successfully
Finished TypeScript
Route (app)
○ /
○ /_not-found
```

Node emitiu `MODULE_TYPELESS_PACKAGE_JSON` ao importar TypeScript nos testes/sondagens. É warning do runtime, distinto do lint limpo. Não comprometeu os 63 resultados, mas integra a pendência de configuração.

## Suíte disponível e evidência por área

| Arquivo | Casos | Verificações principais / linhas |
| --- | ---: | --- |
| `tests/xlsxParser.test.mjs` | 10 | Texto/linhas/duplicatas `:8`; freeze `:26`; vazios/cabeçalho `:37,43`; fórmulas `:53`; browser guard `:65`; File real sintético `:69`; erros/limites `:85,99,106` |
| `tests/sigaaParser.test.mjs` | 13 | Estrutura e 11 respostas sintéticas `:43`; blocos, rótulos e lacunas `:57–123`; tipos inválidos `:125`; integração SAN `:149`; XLS/XLSX e primeira aba `:159` |
| `tests/sanitize.test.mjs` | 14 | E-mail/números `:11–38`; nomes e regex literal `:41–66`; RAW/freeze `:69–97`; determinismo/HTML literal `:99–111`; parser→SAN `:114` |
| `tests/ollama.test.mjs` | 20 | Schema/conversão `:40,65`; thinking `:81,216`; IDs `:96,237`; payload sem RAW `:107`; entrada `:146`; HTTP/JSON/CORS `:167–194`; aborto/timeout `:196–214,266–282`; lotes/truncamento `:225–264` |
| `tests/ollamaConnection.test.mjs` | 5 | Descoberta `:11`; capacidades/remotos `:26`; HTTP/CORS `:42`; aborto/timeout `:52`; browser guard `:66` |
| `tests/results.test.mjs` | 1 | Tuplas únicas, sentimentos distintos, filtros, contagens, vazio e entrada preservada `:5–23` |

Alguns testes têm várias asserções e combinações; “63” é a contagem de casos, não número de cenários exaustivos. O termo “planilha real” no nome de alguns testes significa arquivo binário de fixture, **não dados reais de participantes**.

### Cobertura V11

| Arquivo importado | Linhas | Branches | Funções |
| --- | ---: | ---: | ---: |
| `lib/importLimits.ts` | 100,00% | 100,00% | 100,00% |
| `lib/ollama.ts` | 100,00% | 100,00% | 100,00% |
| `lib/ollamaConnection.ts` | 100,00% | 98,21% | 100,00% |
| `lib/results.ts` | 100,00% | 100,00% | 100,00% |
| `lib/sanitize.ts` | 100,00% | 94,44% | 100,00% |
| `lib/schema.ts` | 100,00% | 100,00% | 100,00% |
| `lib/sigaaParser.ts` | 100,00% | 98,33% | 100,00% |
| `lib/xlsxParser.ts` | 100,00% | 94,74% | 100,00% |
| **Agregado informado pelo Node** | **100,00%** | **97,67%** | **100,00%** |

São métricas do mecanismo experimental do Node sobre os módulos carregados. **`app/page.tsx` e os componentes não aparecem nesse relatório.** Não declarar 100% da aplicação, nem inferir completude de entradas a partir de linhas percorridas. P01 revela defeito mesmo com 100% de linhas do sanitizador reportadas.

## Sondagens investigativas reproduzíveis

Executar os blocos na raiz, com Node 24, em processo de teste. Dados abaixo são sintéticos, sem associação a pessoa ou avaliação real. Não alteram código da aplicação.

### P01 — Equivalência Unicode do dicionário

```bash
node --input-type=module <<'JS'
import { sanitizeComments } from './lib/sanitize.ts';
const synthetic = 'Jos\u00e9';
for (const form of ['NFC', 'NFD']) {
  const text = synthetic.normalize(form);
  const raw = [{id:2, text, rowIndex:2, sheetName:'Teste'}];
  const result = sanitizeComments(raw, [synthetic]);
  console.log(form, result[0].text === '[DADO SENSÍVEL]');
}
JS
```

Observado: `NFC true`, `NFD false`. Ambas as representações são canonicamente equivalentes; a função só modifica espaços/case para correspondência, sem normalizar formas Unicode. `AUD-02`.

### P02/P03 — Validação estrutural não valida utilidade/factualidade

```bash
node --input-type=module <<'JS'
import { parseAnalysisResponse } from './lib/ollama.ts';
const ids = new Set([2]);
console.log(parseAnalysisResponse('{"summary":[],"absa":[]}', ids));
console.log(parseAnalysisResponse(JSON.stringify({
  summary:[{text:'Conclusão sem suporte no comentário.', evidenceIds:[2]}],
  absa:[{commentId:2, aspects:[{aspect:'Infraestrutura',sentiment:'Negativo'}]}]
}), ids));
JS
```

Observado: ambos aceitos. O validador recebe IDs, não texto original/critério semântico; não poderia verificar suporte textual por essa assinatura. Isso demonstra um limite, **não um erro de implementação do schema**, que é exatamente o exigido. Não se simulou inferência para medir acurácia.

### P04/P05 — Metadados thinking e proveniência da entrada

```bash
node --input-type=module <<'JS'
import { verifyLocalModel } from './lib/ollamaConnection.ts';
import { analyzeComments } from './lib/ollama.ts';
globalThis.window = {};
let generated = 0;
globalThis.fetch = async (url) => url.endsWith('/show')
  ? Response.json({
      capabilities:['completion','thinking'],
      thinking:{values:[true], default:true}
    })
  : (generated++, Response.json({
      done:true, response:'{"summary":[],"absa":[]}'
    }));
await verifyLocalModel('deepseek-r1:latest');
console.log('P04: modelo aceito');
await analyzeComments([{id:2,text:'texto sem prova de higienização'}]);
console.log('P05: chamadas simuladas de generate', generated);
JS
```

Observado: modelo aceito; uma chamada simulada de generate. **Nenhuma rede real** nesse processo. P04 confirma ignorar `thinking.values`. P05 mostra que o shape não prova passagem pelo sanitizador; o chamador da página continua correto. Não contar P05 como vazamento comprovado.

### P06 — Extensão não autentica formato

```bash
node --input-type=module <<'JS'
import { parseXlsxFile } from './lib/xlsxParser.ts';
globalThis.window = {};
const result = await parseXlsxFile(new File([
  'Comentarios\nTexto sintetico'
], 'renomeado.xlsx'));
console.log(result.length);
JS
```

Observado: `1`. Também passou CSV ASCII com duas colunas renomeado. Tentativa inicial com cabeçalho UTF-8 acentuado foi rejeitada pela interpretação do conteúdo; não se generaliza aceitação a qualquer texto. O requisito explícito inicial era validação de extensão; endurecer assinatura é melhoria opcional (`AUD-11`).

## Evidência histórica H01 — não reexecutada agora

`docs/VALIDATION.md:39–87` registra testes de 19/20 de outubro: inferência real Node e navegador, fixture com três comentários, relatório sintético com 30 classificações, paginação, filtros, citações/Escape/foco, cancelamento e descarte. Registra também área de celular 390×844 via iframe, sem overflow externo.

`docs/VALIDATION.md:96–102` relata uma classificação Infraestrutura/Negativo atribuída ao ID 2 sem suporte no texto. É um **relato anterior**, não nova medição independente de acurácia. Capturas temporárias citadas naquele documento não constituem suite reproduzível.

Nesta auditoria, V09 verificou apenas disponibilidade/metadados/CORS e V10 estado inicial no navegador. Não foram enviados comentários reais ou sintéticos ao endpoint generate real novamente.

## Verificações não executadas e razão

| Verificação | Razão/limite |
| --- | --- |
| `npm ci`/instalação limpa | Não necessária para ler o projeto; alteraria instalação preexistente e não há autorização específica para instalar nesta tarefa |
| Atualizações e `npm audit fix` | Proibidas pela missão documental; sugestão de downgrade não validada |
| E2E automatizado completo | Não existe runner/suite configurada; não se instalou framework nem criou testes de aplicação |
| Inferência real e benchmark semântico | Operação custosa, sem corpus anotado/critério de aceitação definido; história disponível foi identificada como tal |
| Novo teste mobile, Safari/Firefox, leitor de tela | Ausência de matriz/ambientes e limite de escopo; inspeção atual foi desktop |
| ZIP bomb, fuzzing, exaustão de memória, pentest | Não executados para não comprometer estação/dados; risco documentado sem prova de exploração |
| Backend/banco/API própria | Componentes inexistentes e proibidos; não aplicável, não “passou” |
| Política de logs/armazenamento do Ollama e sistema operacional | Fora da árvore da aplicação; não auditada |
| Histórico/diff de commits | Repositório indisponível, V13 |

## Lacunas priorizadas

1. **Prioridade alta:** regressões NFC/NFD; metadata `thinking.values`; fixture adversarial com nomes não previstos e revisão de cobertura; validação independente do modelo e corpus anotado.
2. **Prioridade média:** E2E mínimo de upload→SAN→Fetch simulado→resultado→RAW; troca de arquivo/configuração enquanto lê/analisa; sucesso vazio; erro por lote; cancelamento e foco de diálogo.
3. **Prioridade média:** capacidade de planilhas/dicionários e tempo de UI em hardware alvo; resposta grande; muitas opções de prévia; teste de primeira aba no limite.
4. **Prioridade baixa:** compatibilidade de browsers acordados, contraste/leitor de tela, formalização de formato de arquivo e teste da semântica escolhida para Remover.

## Identificação reproduzível do estado

O manifesto foi construído antes dos testes com os 38 arquivos listados em 02. Diretórios `node_modules`, `.next`, `out`, `.git` e `auditoria` foram excluídos. Nenhum outro arquivo entrou na baseline. A tabela abaixo conserva cada hash; o manifesto temporário é `/tmp/avalia-audit-baseline.json`.

Algoritmo para reproduzir o hash agregado, desde que o conjunto de arquivos permaneça igual:

```python
from pathlib import Path
import hashlib, json
root = Path(".")
excluded = {"node_modules", ".next", "out", ".git", "auditoria"}
files = sorted(
    p for p in root.rglob("*")
    if p.is_file() and not any(x in excluded for x in p.relative_to(root).parts)
)
manifest = {
    str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in files
}
encoded = json.dumps(manifest, sort_keys=True, ensure_ascii=False, indent=2).encode()
print(hashlib.sha256(encoded).hexdigest())
```

Resultado inicial/final: `7a7538983ddd68e7cec761564ec623d1ea39692f5e80b3448c50efbd47b08d81`. É snapshot de conteúdo, sem autoria/data/versionamento de Git.

| Arquivo | SHA-256 |
| --- | --- |
| `.gitignore` | `7a15af2d5a1a4fc268b8f61a418ead3cd78d1b620727c452397f5258e98e4689` |
| `AGENTS.md` | `831f2273b293a71ed33ce469e13aa8db728b15847f72ce9417e1f95570276d53` |
| `PLAN.md` | `d685d120803b2565a4515a8da1bf24c05e15b486f418685a47635a2fb97ab327` |
| `README.md` | `0ab8a496a04e2144ba25063e73fded395868dd4f3abc32a21aac759dac0a1ad7` |
| `app/globals.css` | `92deb8a8895531ff0efbb760a2783d0338cf0df496afeacc1ec2fee255172bd4` |
| `app/layout.tsx` | `0b2053486f94e29eb88e652e3e41d90324e6a5b443161e943bb9cde8b40a565d` |
| `app/page.tsx` | `85fb7b57bbd6551d42b7935e8157af35a4c093ce4932523acc2b42a10dc42425` |
| `components/AnalysisPanel.tsx` | `ef75e809c191b9aa2c0402ba0047df73aac144faa3a55d4d1c81556573ac6853` |
| `components/ResultsPanel.tsx` | `93a2cc400a0a21534b9708a426a3333093a8cec197160388c973e27d73f05a0e` |
| `components/SanitizationPanel.tsx` | `70e4f90bf3c422bb50dd7d43c2a0b40e8f16cad832530c21b18d38fea160d51d` |
| `components/UploadArea.tsx` | `cee3323a22f496d7b72a5b6fbe295e8846e93043246f258aaf661b336816326b` |
| `docs/AI_CONTRACT.md` | `9fa11b7b4c7332310185d8edc01ae7976e9874c6fddbc11e4edb81adbf523a38` |
| `docs/ARCHITECTURE.md` | `3be0747bd0d46c395656dcb419a508b467fe388f4757d928a39dce73d7a9dc25` |
| `docs/PRIVACY.md` | `126b59fc0d7ba52ca809839485dc1879201779407ab799a0b1c8326b2cb2072e` |
| `docs/VALIDATION.md` | `e0029afbdbc95e0f3cb37f1c2cc4f8621ce0b2c165f0dab1ee052dc8d199584c` |
| `eslint.config.mjs` | `7e45d7fe768d6016deeb572ad760f9d3addd2e2dcf9604556bbb11035d391a28` |
| `lib/importLimits.ts` | `478a78d0f834179bcad0fe23b66656103c6207ebe27978ab69d93e7a9ad45c29` |
| `lib/ollama.ts` | `ae980b754205639d3c6cf05ca8932a077fbb0cac10ef8f6aaa37b9a160410275` |
| `lib/ollamaConnection.ts` | `a2af990d57690dbac96dfc7c47c4f9dd05349062583f59738928eb94fe3ebd53` |
| `lib/results.ts` | `d43a1f65b812bcee9f4d1dc3c6103455c9905733dd1b1392105f98a5906b0c51` |
| `lib/sanitize.ts` | `f12be2bc2b08e234165ba5134fb9d4fe9260e3e063195d6c750238eb5cce1042` |
| `lib/schema.ts` | `6d4bf783f18b1903b9466b532496ac9be2bf94aea69e7fbc97b23edbfa8972f1` |
| `lib/sigaaParser.ts` | `345dc5fe0c0594cdedae93bcb13c04db2c672a24411260ba1c60c15759809817` |
| `lib/xlsxParser.ts` | `5bc2655a49c95388203978c4988f3fbf8c10e29c4ef5e251ee13d70b821e2e89` |
| `next-env.d.ts` | `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b` |
| `next.config.ts` | `fa6df9b15040a726963cf34cc715c5b58360e0be212af59f70b14dc39749ef01` |
| `package-lock.json` | `724a63eaaa68bbc6bbc23226b66a9cf9c5bea408f3e20346699aefb709bda543` |
| `package.json` | `edb254838afb89468c29e7f8c96ef036449ad79d6fcf84d775d8f285269a7180` |
| `postcss.config.mjs` | `dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde` |
| `tests/fixtures/comentarios.xlsx` | `893f3b4f98ba7e61a7ff23939327a98ffd560462e3cb900edcd63ae88ccc091c` |
| `tests/ollama.test.mjs` | `3914c2a0a61eb21edb4f417ff89800957f10defd5f5cbb5df8cd75b31471e7a4` |
| `tests/ollamaConnection.test.mjs` | `120bc0788efba46b75b12d490ed71da7c291f9679a13a03fca21b6ec351b8975` |
| `tests/results.test.mjs` | `8e3422689076ba67ad1aadf7b32abf369af99da58481114eacf1b3c57eb9ec5a` |
| `tests/sanitize.test.mjs` | `9d3ec4147ab2ed0e938a59a2f17a51220710c956c5af3f6784ebb873871556a2` |
| `tests/sigaaParser.test.mjs` | `447c13286e7a4d4252877f84d6cdfe1a678eb693c32f9e4a1a509b6d01a19dde` |
| `tests/xlsxParser.test.mjs` | `987deb78395df48acdf6fcef133d2d53152246aab49dde3faec0bea7d605203e` |
| `tsconfig.json` | `1f750e74c5333d76f181d9e7c18f448b0292535409ab1076a3040326f4d90890` |
| `types/index.ts` | `7e47af23b6304623a31765694ba42dbef25d401f6456ac784efebb092b6ac546` |
