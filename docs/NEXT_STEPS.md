# Próximos passos — Avalia / PoC UFC

Plano registrado em **23/10/2026**, a pedido do responsável pelo projeto, com base na [auditoria de 20/10/2026](auditoria/README.md).

Este documento organiza recomendações e critérios de aceite. O registro inicial
abaixo é histórico. As correções implementadas nesta data e suas evidências estão
em [MAINTENANCE-2026-10-23](MAINTENANCE-2026-10-23.md).

## Estado após a manutenção de 23/10/2026

| Item | Estado |
| --- | --- |
| 0 — Next.js | Corrigido: Next.js/config 16.4.2, build estático aprovado e audit de produção sem avisos conhecidos |
| 1 — Unicode | Corrigido com regressões NFC/NFD, preservando RAW, IDs e trechos não mascarados |
| 2 — thinking | Verificação explícita de valores e sonda sintética para metadados ausentes; sonda real passou no modelo instalado |
| 3 — Privacidade/descarte | UI e contratos alinhados: remover preserva configurações; IDs/Zod não provam acurácia ou conformidade jurídica |
| 4 — Lint | Reavaliado; cinco entradas altas da mesma cadeia permanecem. ESLint 9 sem suporte; tentativa com 10 revelou plugins incompatíveis e foi revertida |
| 5 — E2E | Suíte Playwright criada para export estático, fluxo, cancelamento, alterações, rejeição de IDs e descarte; resultados no relatório de manutenção |
| 6 — TCC | Metadados locais registrados e protocolo preparado; anotação humana, população e critérios de aceite ainda pendentes |
| 7 — Ambiente/capacidade | Runtime declarado; npm ci, testes, lint e build passaram em cópia limpa. Limites de volume e hardware continuam exigindo ensaio específico |

Próxima prioridade funcional: avaliação semântica e capacidade com critérios acordados,
seguindo [EXPERIMENT_PROTOCOL](EXPERIMENT_PROTOCOL.md). Nenhum teste técnico substitui
a anotação e revisão do orientador. Acompanhar também a correção de `braces`.

## Histórico: versionamento e verificação antes da manutenção

O repositório foi iniciado na pasta da aplicação, na branch `main`, mediante solicitação de commit. A baseline `6d37b09c9c38db6ef57e650e6635e2d5a593a27e` registra exatamente os 38 arquivos do snapshot auditado, sem alterações funcionais. A documentação da auditoria e este plano são registrados separadamente. Isso inicia a rastreabilidade daqui em diante; não recupera histórico anterior (`AUD-09`).

| Verificação executada antes do commit | Resultado atual |
| --- | --- |
| `npm test` | Exit 0; 63 testes passaram, zero falhas/ignorados |
| `npm run lint` | Exit 0; sem diagnósticos do ESLint |
| `npm run build` | Compilação, TypeScript e geração das rotas estáticas concluídos; **exit 1 ao final por alerta de segurança do Next.js**, portanto não classificado como build aprovado |
| `npm audit --json` | Exit 1; uma entrada crítica em `next` e cinco altas na cadeia de lint |
| `npm audit --omit=dev --json` | Exit 1; uma entrada crítica em `next` |
| Revisão do índice Git | Lista explícita de arquivos, verificação de whitespace, exclusão de gerados/ambiente e conferência dos hashes da baseline |

O resultado de segurança mudou em relação à consulta de 20/10/2026. A auditoria anterior permanece um registro datado, não uma avaliação atual de dependências. O Next.js 16.4.0 instalado passou a ser apontado pela base consultada; o build reportou `SecurityFatalError`. Não foi repetido apenas para suprimir o aviso e não houve atualização de pacotes.

Avisos consultados em 23/10/2026:

- [Otimização de imagens SVG — GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw): aviso crítico associado a processamento de imagens no servidor.
- [Server Actions — GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r): aviso alto de indisponibilidade condicionado ao uso de Server Actions.
- [Cache Components — GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr): aviso crítico envolvendo funções `use cache` com typed arrays.

Os três avisos indicam correção na linha 16 a partir de 16.4.1. A versão compatível a adotar deve ser reavaliada no momento da atualização e testada, incluindo alinhamento do `eslint-config-next`. A busca no código autoral não encontrou `next/image`, Server Actions, `use cache` ou configuração de imagens SVG. A exportação estática não executa esses handlers de servidor: **não foi demonstrada exploração desta aplicação**, mas isso não elimina a pendência na dependência e no ambiente de desenvolvimento.

## Ordem de trabalho recomendada

| Ordem | Trabalho | Evidência de origem | Critérios de aceite |
| --- | --- | --- | --- |
| 0 | Atualizar Next.js para versão compatível corrigida e revalidar | Novo alerta de segurança de 23/10/2026, descrito acima | Versão escolhida com base nos avisos atuais; dependências compatíveis; testes, lint e build estático aprovados; audit de produção reexecutado; sem alteração de arquitetura |
| 1 | Corrigir correspondência Unicode do dicionário | AUD-02 | Nomes canonicamente equivalentes em NFC/NFD são mascarados nos dois sentidos; IDs e RAW permanecem intactos; novos testes cobrem acentos, caixa, nomes compostos e palavras semelhantes |
| 2 | Confirmar suporte efetivo a `think: false` | AUD-03 | Verificação considera valores aceitos pelo modelo, quando disponíveis; comportamento para metadados ausentes é definido; testes cobrem suporte, recusa e erro sem expor thinking |
| 3 | Alinhar mensagens e garantias de privacidade | AUD-04, AUD-10 | UI e documentação distinguem mascaramento, rastreabilidade e acurácia; remoção esclarece se preserva nomes/configuração; nenhuma promessa de anonimização ou conformidade jurídica automática |
| 4 | Reavaliar a dependência transitiva vulnerável de lint | AUD-01 | Auditoria de dependências atualizada; solução compatível avaliada com testes, lint e build; risco residual documentado se não houver correção; nenhum downgrade ou `--force` sem análise |
| 5 | Automatizar o fluxo essencial da interface | AUD-07 | Teste de importar → higienizar → analisar com resposta simulada → consultar resultados → abrir RAW pela citação; cobertura de cancelamento, troca de arquivo/configuração e erro de análise |
| 6 | Preparar avaliação reproduzível para o TCC | AUD-04, AUD-05 | Modelo/digest, versão do Ollama e parâmetros registrados; conjunto sintético anotado manualmente; critérios de qualidade definidos antes de medir; resultados incluem erros e limitações |
| 7 | Validar capacidade e ambiente de execução | AUD-06, AUD-08 | Instalação limpa verificada em cópia autorizada; runtime documentado; carga medida no hardware alvo; limites de leitura, nomes e renderização justificados por resultados |

Esta tabela preserva a ordem original da auditoria; consulte o estado atualizado acima.

## Decisões a alinhar antes das alterações correspondentes

- **Modelo experimental:** escolher e congelar o digest para o experimento. O comportamento para ausência de metadados foi implementado e está em AI_CONTRACT; o digest observado está no relatório de manutenção.
- **População analisada:** confirmar se docentes e discentes devem permanecer no mesmo conjunto e se haverá necessidade de separar disciplinas.
- **Qualidade:** definir como avaliar sínteses e ABSA, incluindo erros aceitáveis, revisão humana e resultados vazios. O contrato Zod atual permite listas externas vazias.
- **Descarte:** mantido o comportamento existente, agora documentado: remover preserva configurações; recarregar/fechar descarta tudo do estado da página.
- **Ambiente:** definir navegadores, volume de dados e hardware suportados. Não assumir que limites numéricos atuais foram comprovados por teste de carga.

## Restrições que continuam valendo

- Aplicação client-side com exportação estática, sem backend próprio, banco, API Routes, Server Actions ou persistência dos comentários.
- RAW preservado em memória e separado de SANITIZED; somente SANITIZED pode entrar na requisição de análise.
- Fetch para Ollama local, temperatura zero, saída estruturada e validação dos IDs retornados.
- Schema de [AI_CONTRACT.md](AI_CONTRACT.md) preservado; qualquer mudança contratual exige decisão explícita.
- Nenhuma dependência nova sem justificar necessidade. Não introduzir SDK, store global ou biblioteca de gráficos sem requisito demonstrado.
- Usar dados sintéticos em testes e documentação; não versionar relatórios institucionais, credenciais ou arquivos de ambiente.

## Validação das futuras correções

Na raiz da aplicação:

```bash
npm test
npm run lint
./node_modules/.bin/tsc --noEmit --incremental false
npm run build
npm run test:e2e
npm audit
npm audit --omit=dev
```

Além desses comandos, executar a regressão específica do item alterado e conferir o artefato estático quando a mudança afetar build ou integração. Testes com Fetch simulado não substituem o teste real do modelo escolhido. Registrar comandos, resultados, ambiente e limitações; não registrar sucesso para verificações não executadas.

## Organização dos commits futuros

- Manter cada correção e seus testes no mesmo commit, com propósito único e mensagem descritiva, por exemplo `fix(privacy): handle canonically equivalent names`.
- Separar atualização de dependências, correção funcional e documentação quando forem mudanças independentes.
- Revisar `git diff --cached` e `git diff --cached --check` antes de commitar; usar seleção explícita de arquivos.
- Preservar auditorias anteriores como registros datados. Acrescentar evidências de resolução dos achados em vez de reescrever resultados históricos.
- Publicação remota não está incluída neste plano de commit local.

O [parecer técnico](auditoria/10-PARECER-TECNICO-FINAL.md) e o [registro de achados](auditoria/09-NAO-CONFORMIDADES.md) detalham os limites e os critérios para ampliar o uso além de demonstrações sintéticas.
