# 07 — Dependências e configurações

[Índice](README.md) · [Testes](08-TESTES-E-VALIDACOES.md) · [Achados](09-NAO-CONFORMIDADES.md)

Consulta npm realizada em 20/10/2026. Nenhum pacote foi instalado/atualizado/removido. Versões abaixo vêm de `npm ls --depth=0`, lockfile e `npm outdated --json`, não de memória ou suposição.

## Todas as dependências diretas

| Pacote | Declarada → instalada | Uso e necessidade | Versão publicada destacada pelo outdated |
| --- | --- | --- | --- |
| next | `^16.4.0` → 16.4.0 | App Router, build/export e tipos; requisito da base | wanted/latest 16.4.2 |
| react | `^19.3.0` → 19.3.0 | Componentes, effects, estado | wanted/latest 19.3.1 |
| react-dom | `^19.3.0` → 19.3.0 | Renderização/hidratação utilizada por Next | wanted/latest 19.3.1 |
| xlsx | tarball fixo → 0.20.3 | XLS/XLSX em `lib/xlsxParser.ts:1`, `sigaaParser.ts:1` e fixtures | Não comparável automaticamente pela consulta npm de semver |
| zod | `3.25` → 3.25.76 | Contrato, entrada e envelopes runtime | latest 4.6.7; wanted continua 3.25.76 |
| zod-to-json-schema | `3.25` → 3.25.2 | `ollama.ts:2,79`, structured outputs exigidos | Não listado como desatualizado nessa consulta |
| @tailwindcss/postcss | `^4.3.3` → 4.3.3 | Plugin em `postcss.config.mjs:3` | Não listado |
| @types/node | `^24.19.2` → 24.19.2 | Tipos de ferramentas/build | latest 26.6.5; wanted 24.19.2 |
| @types/react | `^19.3.0` → 19.3.0 | TSX/hooks/props | Não listado |
| @types/react-dom | `^19.3.0` → 19.3.0 | Tipos DOM React/ecossistema | Não listado |
| eslint | `^9.39.5` → 9.39.5 | CLI de lint | latest 10.13.0; wanted 9.39.5 |
| eslint-config-next | `^16.4.0` → 16.4.0 | Regras Next/TS, `eslint.config.mjs:2–3` | wanted/latest 16.4.2 |
| postcss | `^8.5.30` → 8.5.30 | Transformação CSS com Tailwind/Next | wanted/latest 8.5.31 |
| tailwindcss | `^4.3.3` → 4.3.3 | `app/globals.css:1`, classes no JSX | Não listado |
| typescript | `^5.9.3` → 5.9.3 | Análise de tipos/build | latest 7.0.2; wanted 5.9.3 |

“Não listado” não significa que uma auditoria independente demonstrou ser a versão mais segura possível. Uma versão major mais nova não constitui, isoladamente, defeito. `@types/node` acompanha o Node 24 observado; atualizar para 26 sem mudar runtime não é objetivo.

Zod 3.25.76 satisfaz o peer `^3.25.28 || ^4` do conversor instalado. Testes validam o JSON Schema aninhado gerado. A implementação não deve migrar para Zod 4 automaticamente: compatibilidade semver anunciada não prova preservação exata do contrato/conversão.

O tarball SheetJS está fixado no lockfile com integridade; sua origem corresponde à distribuição documentada pelo fornecedor. O registro npm antigo não é referência suficiente para decidir downgrade de SheetJS. Isso não elimina risco de cadeia de suprimentos nem torna `npm audit` exaustivo. [Instalação oficial SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

## Árvore instalada e reprodutibilidade

`npm ls --depth=0` saiu com código 0, mas listou seis pacotes `extraneous`:

- `@emnapi/core@1.10.0`
- `@emnapi/runtime@1.11.3`
- `@emnapi/wasi-threads@1.2.1`
- `@img/sharp-wasm32@0.35.5`
- `@napi-rs/wasm-runtime@1.2.5`
- `@tybys/wasm-util@0.10.4`

Não foram removidos: são estado preexistente e a tarefa proíbe correções. Os nomes sugerem suporte WASM, mas sua origem histórica não é verificável. Não foi comprovado uso em bundle ou vulnerabilidade nesses extras.

O lockfile versão 3 registra resoluções/integridades. Sem reinstalação limpa, os testes atuais demonstram a instalação existente, não uma reprodução completa por `npm ci`. Falta pin executável do Node/npm (`engines`, `.nvmrc` ou equivalente, `packageManager`); README pede Node 24. O comando de testes depende do suporte de Node à execução de TypeScript e de `--test-isolation=none`.

## Vulnerabilidades

`npm audit --json` terminou em 1 e reportou cinco entradas altas: eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces. `npm audit --omit=dev --json` terminou em 0, sem avisos nessa consulta.

No lockfile, `braces` começa em `package-lock.json:2630`; eslint-config-next em `:3307`. O aviso GHSA-vfj7-8cjw-p6xm/CVE-2026-93687 descreve esgotamento de pilha com padrões profundamente aninhados, afeta versões até 3.0.3 e não lista versão corrigida. [Advisoria consultada](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

A sugestão npm indica downgrade de eslint-config-next para 14.2.35 com mudança major. Não foi aplicada nem recomendada cegamente; pode romper alinhamento com Next 16.4. Atualizar Next/config para 16.4.2 não foi testado e não foi comprovado como solução desse aviso. O risco concreto de execução da cadeia de lint depende de entrada controlada pelo atacante; nenhum caminho foi demonstrado a partir da UI.

## Configurações e scripts

| Arquivo/script | Observação |
| --- | --- |
| `npm run dev` | `next dev`; servidor necessário durante desenvolvimento, não em produção exportada |
| `npm run build` | `next build --webpack`; exporta `out/`; motivo histórico de optar por webpack não é verificável no Git |
| `npm run lint` | `eslint . --max-warnings=0`; passou. Gerados excluídos |
| `npm test` | `node --test --test-isolation=none tests/*.test.mjs`; testes compartilham processo e usam restauração de mocks |
| Type checking | Não há script próprio; executado binário local `tsc --noEmit --incremental false`; build também valida |
| `next.config.ts` | export, Strict Mode, devIndicators false; agentRules false tem justificativa explícita de preservar AGENTS |
| `tsconfig.json` | strict/noEmit; ES2017, libs dom/esnext, imports `.ts`, alias `@/*`, bundler; skipLibCheck não revisa tipos internos de dependências |
| `postcss.config.mjs` | Um plugin: Tailwind. Sem plugin remoto de CSS/fontes |
| `eslint.config.mjs` | Presets Next vitals + TS; exclusões de `.next`, `out` e next-env |
| `package.json` | private true, sem `type` explícito; Node emitiu MODULE_TYPELESS_PACKAGE_JSON, reinterpretação ESM |
| `.gitignore` | Ignora `.env*`, mas nenhum arquivo secreto de aplicação foi encontrado no inventário |

Não há variável de ambiente de aplicação configurável para modelo/endereço; ambos partem de constantes locais. `OLLAMA_ORIGINS` é variável do **serviço Ollama**, descrita no README, não segredo nem configuração lida pelo frontend. A execução não usa chave de API.

## Identificação do modelo e compatibilidade

V09 encontrou Ollama 0.33.3 e tag `deepseek-r1:latest` com digest:

```text
6995872bfe4c521a67b32da386cd21d5c6e819b6e0d62f79f64ec83be99f5763
```

`show` declarou família qwen3, 8.2B, Q4_K_M, capabilities tools/thinking/completion, sem campos remotos e sem objeto top-level `thinking`. A família declarada **não permite concluir isoladamente** que os pesos não são DeepSeek: nomes/derivações podem diferir. Também não autentica procedência. O produto guarda a tag, não digest/versão nos resultados (`AUD-05`).

A documentação atual do Ollama distingue capability de valores aceitos: quando presente, `thinking.values` informa os controles; ausência de metadados não comprova suporte a false. O código ignora esse objeto e P04 reproduz aprovação de modelo simulado que só admite true. [Controle de thinking do Ollama](https://docs.ollama.com/capabilities/thinking).

## Reprodução recomendada, não executada como instalação

Em uma cópia isolada e após autorização para instalar, usar Node 24 e npm compatível, `npm ci`, depois testes/lint/tipos/build. Registrar digest e versão do modelo antes de inferir. Nesta auditoria, não executar `npm ci`, `npm audit fix`, `npm update` ou downgrade preservou a instalação do usuário.

Nenhuma dependência direta demonstrou remoção necessária. As atualizações de patch disponíveis devem ser avaliadas em tarefa de manutenção separada com retestes, sem alterar o contrato da IA.
