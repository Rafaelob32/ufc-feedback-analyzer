# Manutenção e validação — 23/10/2026

Continuação autorizada das sugestões da auditoria. Baseline de comparação:
`6841f436644b2da03e2eac4bf58f29659083f1e1`, branch `main`. Esta manutenção altera
código, testes e documentação; os relatórios de 19/20 de outubro permanecem históricos.

## Correções e relação com os achados

| Área | Resultado |
| --- | --- |
| Segurança do Next.js | Next.js e eslint-config-next 16.4.0 → 16.4.2; lockfile atualizado. Build termina com exit 0 e audit de produção com zero avisos conhecidos na consulta desta data |
| AUD-02 — Unicode | Dicionário compara NFC/NFD em ambos os sentidos, preserva RAW/IDs e copia trechos não mascarados da string original; offsets mapeados por grafema para não quebrar acentos/pares substitutos |
| AUD-03 — thinking | `thinking.values` explícito exige booleano false; valores incompatíveis ou metadados inválidos bloqueiam. Ausência de metadados aciona sonda sintética sem comentários. Erros não mostram raciocínio/corpo da resposta |
| AUD-04/AUD-10 — garantias e descarte | Contratos deixam claros os limites de Regex, IDs, Zod e temperatura zero. A UI esclarece que remover a planilha mantém nomes/configurações até recarregar/fechar |
| AUD-07 — testes de interface | Playwright adicionado somente ao desenvolvimento; 7 cenários em desktop e mobile sobre o export estático, com Ollama interceptado |
| AUD-08 — reprodução | Node/npm declarados, `.nvmrc`, modo ESM explícito; instalação limpa com lockfile validada. Há observação residual sobre opcionais WASM abaixo |
| AUD-05 — experimento | Digest e versão observados registrados abaixo; protocolo de avaliação preparado. Modelo experimental e corpus anotado ainda dependem de decisão/revisão humana |
| Instruções para IA | AGENTS atualizado com obrigação de sincronizar documentação, contratos, regressões, validação do export e restrições de privacidade |

O schema de `lib/schema.ts` e o bloco correspondente em AI_CONTRACT foram preservados.
Não foram introduzidos backend, banco, persistência de comentários, API Routes,
Server Actions ou chamadas à IA em nuvem.

## Arquivos criados ou modificados

| Arquivo | Alteração e responsabilidade |
| --- | --- |
| `lib/sanitize.ts` | Correspondência canônica Unicode com preservação dos trechos originais |
| `tests/sanitize.test.mjs` | Regressões NFC/NFD, offsets, limites e imutabilidade |
| `app/page.tsx` | Texto de descarte alinhado ao comportamento existente |
| `docs/PRIVACY.md` | Regras efetivas de mascaramento, descarte e limites |
| `lib/ollamaConnection.ts` | Verificação dos valores de thinking e sonda sintética |
| `tests/ollamaConnection.test.mjs` | Suporte, recusa, sonda, respostas inválidas e cancelamento |
| `tests/ollama.test.mjs` | Mock de modelo com metadados explícitos, preservando testes de análise |
| `docs/AI_CONTRACT.md` | Payload e política de compatibilidade; schema inalterado |
| `docs/ARCHITECTURE.md` | Fronteiras de execução e infraestrutura de testes |
| `package.json` | Next corrigido, Playwright de desenvolvimento, script E2E e runtime |
| `package-lock.json` | Resolução reproduzível das dependências escolhidas |
| `.nvmrc` — novo | Versão Node usada como referência |
| `playwright.config.mjs` — novo | Navegadores, porta isolada e servidor do export |
| `tests/e2e/workflow.spec.mjs` — novo | Sete cenários de interface, em desktop e mobile |
| `.gitignore` | Exclusão de relatórios e traces gerados pelos testes |
| `eslint.config.mjs` | Exclusão dos mesmos artefatos da análise de código |
| `AGENTS.md` | Instruções de manutenção, documentação e validação para agentes de IA |
| `PLAN.md` | Estado da manutenção e referências às evidências |
| `README.md` | Execução, testes, dependências e pendências atuais |
| `docs/NEXT_STEPS.md` | Estado de cada recomendação e decisões ainda necessárias |
| `docs/EXPERIMENT_PROTOCOL.md` — novo | Protocolo proposto para avaliação humana e reproduzível do TCC |
| `docs/MAINTENANCE-2026-10-23.md` — novo | Este registro de alterações, testes e limitações |
| `docs/VALIDATION.md` | Link para a nova validação, preservando o conteúdo histórico |
| `docs/auditoria/README.md` | Link para resolução dos achados, preservando a auditoria original |

## Verificações executadas

Ambiente: Fedora/Linux x64, Node 24.14.0, npm 11.9.0, TypeScript 5.9.3,
Next.js 16.4.2, Playwright 1.64.1, Chromium 156.0.8078.4. Desktop 1366 × 900
e emulação Pixel 7. Playwright usou seu build de fallback Ubuntu no Fedora.

| Comando/verificação | Evidência |
| --- | --- |
| Regressões antes da correção | 23 testes selecionados: 19 passaram, 4 falharam, reproduzindo Unicode e valores de thinking ignorados |
| `npm test` | 71 testes passaram, zero falhas/ignorados; inclui 8 novas regressões, com casos parametrizados adicionais |
| `npm run lint` | Exit 0, sem avisos do ESLint |
| `tsc --noEmit --incremental false` | Exit 0 |
| `npm run build` no hospedeiro | Exit 0; `/` e `/_not-found` geradas como estáticas em `out/` |
| `npm run test:e2e` | 14/14 passaram, sem retries; última execução em 8,7 s antes do fechamento documental |
| Instalação limpa em `/tmp/avalia-clean-zoyl7yez` | `npm ci`, 71 testes, lint e build aprovados com a mesma árvore de dependências escolhida; nenhum node_modules foi copiado |
| `npm audit --omit=dev --json` | Exit 0, todas as severidades zeradas |
| `npm audit --json` | Exit 1, 5 entradas altas na cadeia de lint; zero críticas |
| Sonda real do Ollama | Passou em 45.068 ms com `{ "ok": true }`, sem comentários do usuário |
| Desenvolvimento | Servidor estava parado; iniciado como unidade temporária `avalia-dev.service`; localhost:3000 respondeu HTTP 200 |

O primeiro build no sandbox falhou ao interpretar a saída do subprocesso TypeScript
(`Could not parse output from TypeScript's --showConfig`). O comando isolado tsc
passou e a execução no hospedeiro e na cópia limpa passou. Não foi desativada
checagem de tipos nem alerta de segurança para obter sucesso.

Na primeira execução E2E, 10 passaram e 4 falharam por seletores que também
encontravam o anunciador de rotas do Next. Os seletores foram limitados ao painel
de análise; a suíte completa passou. Os cenários de cancelamento foram reforçados
para aguardar a liberação da resposta atrasada antes de verificar o estado.

## O que os testes de navegador comprovam

- Importação da fixture de três comentários com IDs 2, 4 e 6, mascaramento de nome/e-mail/matrícula e preservação de nota 10, tirou 4 e faltou 2.
- Payload contém somente `id/text` SANITIZED, JSON Schema, temperatura zero e think false; RAW aparece no diálogo local sem outra requisição.
- Sumário, filtros ABSA, foco retornando à citação e ausência de transbordamento horizontal do documento nos dois tamanhos testados.
- Cancelamento, alteração do dicionário e troca de arquivo invalidam respostas pendentes; nova análise continua possível.
- ID inventado é rejeitado com recuperação; modelo com valores de thinking incompatíveis não recebe comentários.
- Remoção descarta comentários/resultados; nomes permanecem até reload; não são gravados em localStorage, sessionStorage ou cookies nos cenários executados.

São testes com respostas simuladas. Não certificam todos os aparelhos, navegadores,
acessibilidade, volumes, formatos hostis ou a qualidade semântica do modelo real.

## Snapshot real do Ollama

- Versão: `0.33.3`.
- Nome observado: `deepseek-r1:latest`.
- Digest: `6995872bfe4c521a67b32da386cd21d5c6e819b6e0d62f79f64ec83be99f5763`.
- Metadados: família `qwen3`, 8.2B, GGUF, Q4_K_M; capacidades tools/thinking/completion.
- `/api/show` não retornou `thinking`; portanto foi exercitado o fallback sintético real.
- Sonda: contexto 2048, até 64 tokens, temperatura 0, think false, stream false, saída JSON validada e sem trace de thinking retornado.

Nenhuma planilha institucional foi enviada. Este teste confirma a compatibilidade
observada para a sonda; não mede ABSA/sumarização nem comprova ausência universal de
raciocínio interno. Não foi congelado um modelo experimental: `latest` continua
mutável. O protocolo está em [EXPERIMENT_PROTOCOL](EXPERIMENT_PROTOCOL.md).

## Dependências e pendências

1. **Lint:** permanecem cinco entradas altas ligadas ao mesmo aviso em braces
   (`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`).
   O audit sugere regressão de config para 14.2.35; não foi aplicado `--force`.
   Não se demonstrou exploração do artefato estático, mas a ferramenta de
   desenvolvimento continua com uma dependência vulnerável conhecida.
2. **Suporte do ESLint:** npm ci avisou que 9.39.5 não tem mais suporte. ESLint
   10.13.0 foi avaliado e passou no lint, porém import 2.32.0, jsx-a11y 6.10.2 e
   react 7.37.5, transitivos da configuração Next, não declaram compatibilidade
   com ESLint 10. A tentativa foi revertida; não se deixou a árvore com peers inválidos.
3. **Pacotes opcionais:** npm ls na instalação limpa ainda mostra
   `@emnapi/runtime` e `@img/sharp-wasm32` como extraneous. Isso foi reproduzido
   sem copiar node_modules; não foi tratado como prova de código autoral extra.
   O workspace anterior também tinha outros opcionais WASM. Os comandos passaram,
   mas essa particularidade do instalador não é declarada resolvida.
4. **TCC:** faltam população acordada, corpus anotado/revisado, digest congelado,
   critérios de qualidade e avaliação humana. Nenhum resultado de acurácia foi inventado.
5. **Capacidade:** não foi homologado o limite máximo de 50.000 linhas/500.000
   células nem o custo de dicionários grandes e muitas opções no seletor. Exige
   ensaio gradual no hardware/navegadores alvo antes de ampliar o uso.

Referências primárias consultadas: [aviso Next SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r),
[Cache Components](https://github.com/advisories/GHSA-673q-mjm6-r5xr),
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[thinking no Ollama](https://docs.ollama.com/capabilities/thinking),
[migração ESLint 10](https://eslint.org/docs/latest/use/migrate-to-10.0.0).
