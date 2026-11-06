# Validação de segurança, limites de recepção e evolução — 27/10 a 06/11/2026

Datas de registro: **27/10/2026** e **06/11/2026**, America/Fortaleza. Continuação
autorizada a partir do commit `25bdccf`, na branch `main`. Os relatórios anteriores
(`docs/auditoria/`, `docs/MAINTENANCE-2026-10-23.md` e `docs/WORKER-VALIDATION-2026-10-26.md`)
permanecem preservados como evidências históricas datadas.

## 1. Segurança de dependências e limites de recepção (27/10/2026)

| Item | Resolução |
| --- | --- |
| Zod 4.6.7 e JSON Schema nativo | Atualização de `zod` para `4.6.7` e remoção de `zod-to-json-schema`. O payload utiliza `z.toJSONSchema(AnalysisResultSchema, { target: "draft-7" })`, preservando integralmente campos, enums e invariantes de `lib/schema.ts` |
| Limites de recepção (`lib/jsonLimits.ts`) | Respostas HTTP de `/api/tags`, `/api/show` e `/api/generate` limitadas a **1 MiB (1.048.576 bytes)** lidos em stream com cancelamento imediato. JSONs externos e internos limitados a **20.000 nós** e **profundidade 32** antes do Zod |
| Pareamento linear de `<think>` | Verificação linear de abertura/fechamento de tags `<think>` antes do Regex em `lib/ollama.ts`, evitando buscas repetidas em entradas malformadas ou aninhadas |
| Auditoria de pacotes (`npm audit`) | Retirada da advisoria histórica `GHSA-vfj7-8cjw-p6xm` (`braces`) pela base oficial; `npm audit` e `npm audit --omit=dev` sem avisos conhecidos na consulta de 27/10/2026 |

## 2. Modelos locais, lotes longos, exportação e simplificação de UI (03/11 a 06/11/2026)

| Item | Resolução |
| --- | --- |
| Suporte a `llama3.1` local | `lib/ollamaConnection.ts` (`isSupportedLocalModel`) passa a listar e verificar variantes locais de `deepseek-r1` e `llama3.1`, bloqueando aliases `cloud` ou modelos remotos |
| Subdivisão automática em `done_reason: "length"` | `lib/ollama.ts` instrui JSON compacto em linha única e subdivide automaticamente ao meio lotes com múltiplos comentários quando o Ollama retorna `done_reason === "length"`. Se um comentário único exceder o limite de saída, a análise inteira falha sem expor resultado parcial |
| Exportação local sob demanda (`lib/results.ts`) | `components/ResultsPanel.tsx` permite baixar em memória (`Blob`): planilha detalhada `.xlsx` com 4 abas (`Dashboard`, `Sumarização`, `Classificações ABSA` e `Consolidado por ID`), sumarização `.txt`, dashboard `.csv` (UTF-8 com BOM) e `.json` estruturado. Nenhum texto `RAW` ou `SANITIZED` entra nos arquivos exportados |
| Simplificação visual do painel de higienização | `components/SanitizationPanel.tsx` remove o seletor de padrão de matrícula da interface e expande o campo de nomes conhecidos para largura total (`w-full`). `app/page.tsx` e `lib/sanitizationSettings.ts` fixam `DEFAULT_REGISTRATION_RULE = "6-7"` (padrão institucional da UFC), preservando a regra em `lib/sanitize.ts` e nos testes |
| Proteção de `.gitignore` | Inclusão de regras explícitas contra commit acidental de planilhas locais (`*.xls`, `*.xlsx` exceto `!tests/fixtures/*.xlsx`, `*.csv`), arquivos exportados (`avalia-*`), artefatos de deploy (`.vercel/`) e chaves/credenciais |

## 3. Verificações executadas em 06/11/2026

| Comando | Resultado |
| --- | --- |
| `npm test` | **99 testes aprovados** (`0` falhas), incluindo limites de recepção JSON, variantes `llama3.1`, subdivisão de lotes por `done_reason: "length"`, geração da planilha `.xlsx` de 4 abas e regras de sanitização |
| `npm run lint` | Exit `0`, sem avisos (`--max-warnings=0`) |
| `npm run build` | Exit `0`; compilação TypeScript e exportação estática geradas em `out/` (`/` e `/_not-found`) |
| `npm run test:e2e` | **34 testes Playwright aprovados** (17 cenários em Chromium desktop e 17 em emulação mobile Pixel 7) contra o export estático `out/` |

## 4. Limitações preservadas

- Os limites de recepção (`1 MiB`, `20.000` nós, profundidade `32`) protegem contra respostas anômalas do serviço local, mas não substituem isolamento de processos nem garantem imunidade universal.
- A exportação local contém apenas sínteses, classificações e IDs numéricos de referência; a revisão humana das evidências continua indispensável antes de qualquer uso institucional.
