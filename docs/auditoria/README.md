# Auditoria técnica — Avalia / PoC UFC

Data: **20/10/2026**, America/Fortaleza. Escopo: aplicação local existente, seus contratos, dependências, testes e artefato estático. Trabalho exclusivamente documental e investigativo; nenhuma correção de produto foi aplicada.

**Atualização posterior, 23/10/2026:** o versionamento Git foi iniciado a pedido do responsável, preservando o código auditado em uma baseline. Uma nova consulta de dependências encontrou aviso crítico em Next.js e o build terminou com alerta de segurança. Consulte o [plano e a verificação atualizados](../NEXT_STEPS.md). Os resultados, contagens de achados e a ausência de Git descritos nos documentos abaixo correspondem à auditoria de 20/10; não foram reescritos retroativamente.

**Resolução posterior na mesma data:** atualização do Next.js, correções Unicode/thinking,
contratos de privacidade e testes de navegador estão registrados em
[MAINTENANCE-2026-10-23](../MAINTENANCE-2026-10-23.md). O relatório distingue achados
resolvidos, mitigados e pendências, sem modificar as evidências históricas abaixo.

**Continuação de 23/10:** [capacidade e preparação da avaliação ABSA](../CAPACITY-AND-EVALUATION-2026-10-23.md)
registra as medições sintéticas, a paginação da comparação e o avaliador offline.

**Parecer: aprovada com ressalvas para demonstração controlada da PoC com dados sintéticos.** Este parecer não aprova uso institucional com dados pessoais, decisões automatizadas sobre pessoas ou alegações de conformidade integral com a LGPD. Consulte os critérios do [parecer final](10-PARECER-TECNICO-FINAL.md).

## Índice e ordem de leitura

| Documento | Responsabilidade |
| --- | --- |
| [01 — Visão geral e arquitetura](01-VISAO-GERAL-E-ARQUITETURA.md) | Escopo, fronteiras de confiança, decisões e alternativas |
| [02 — Estrutura e fluxos](02-ESTRUTURA-E-FLUXOS.md) | Inventário dos arquivos, estados, execução e descarte |
| [03 — Inventário de funcionalidades](03-INVENTARIO-DE-FUNCIONALIDADES.md) | Comportamento, entradas, saídas, erros, testes e limitações por função |
| [04 — Rastreabilidade dos requisitos](04-RASTREABILIDADE-DOS-REQUISITOS.md) | Requisito → implementação → evidência → teste → resultado |
| [05 — Auditoria de código](05-AUDITORIA-DE-CODIGO.md) | Qualidade, concorrência, desempenho e decisões questionáveis |
| [06 — Auditoria de segurança](06-AUDITORIA-DE-SEGURANCA.md) | Ameaças, controles, privacidade e limites da análise |
| [07 — Dependências e configurações](07-DEPENDENCIAS-E-CONFIGURACOES.md) | Versões, uso, atualizações disponíveis e reprodução |
| [08 — Testes e validações](08-TESTES-E-VALIDACOES.md) | Comandos efetivamente executados, sondagens e lacunas |
| [09 — Não conformidades](09-NAO-CONFORMIDADES.md) | Registro completo dos achados, reprodução e reteste |
| [10 — Parecer técnico final](10-PARECER-TECNICO-FINAL.md) | Conclusões, prioridades, critérios e decisões humanas |

Leitura executiva: 10 → 09 → 08. Leitura de engenharia: 01 → 02 → 03 → 04, seguida dos demais. Os identificadores `Rxx`, `Fxx`, `Vxx`, `Pxx` e `AUD-xx` conectam requisitos, funcionalidades, verificações, sondagens e achados.

## Estado auditado e limites de evidência

- Diretório de aplicação: `poc-avaliacao-ufc`, pacote `0.1.0`.
- **Commit: indisponível.** `git status --short` retornou código 128: a pasta e seus ancestrais acessíveis não constituem repositório Git. O comando encadeado `git log -5 --oneline` não chegou a executar. Não há evidência para reconstruir autoria, alterações preexistentes ou evolução histórica.
- Antes das verificações, foi criado um manifesto SHA-256 dos **38 arquivos preexistentes** relevantes. O inventário e algoritmo de reprodução estão no documento 08.
- SHA-256 do manifesto JSON: `7a7538983ddd68e7cec761564ec623d1ea39692f5e80b3448c50efbd47b08d81`. **Este valor não é hash de commit.**
- A comparação ao final confirmou que esses 38 arquivos permaneceram idênticos. Os únicos documentos novos são estes 11 Markdown. `.next/` e `out/` foram regenerados pelo build e não integram o manifesto.
- Não houve instalação, atualização, remoção de dependências, alteração dos contratos ou envio do relatório real ao modelo nesta auditoria.

Fontes normativas disponíveis: [AGENTS.md](../../AGENTS.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [PRIVACY.md](../PRIVACY.md), [AI_CONTRACT.md](../AI_CONTRACT.md) e [PLAN.md](../../PLAN.md). O plano atual já descreve funcionalidades implementadas; não é uma baseline histórica independente. Não foi possível confirmar as referências bibliográficas no formato `[cite: n]` desses documentos.

[VALIDATION.md](../VALIDATION.md) é um **registro histórico** de desenvolvimento. Seus testes de inferência, upload e responsividade são identificados como históricos, não contabilizados como novas execuções desta auditoria. A inspeção atual inclui fonte, 63 testes, lint, TypeScript, build, sondagens negativas, metadados do Ollama e abertura da interface.

## Classificação dos achados

| Severidade | Quantidade |
| --- | ---: |
| Crítica | 0 |
| Alta | 1 |
| Média | 7 |
| Baixa | 3 |
| **Total** | **11** |

São **8 fatos confirmados**, **1 suspeita fundamentada** e **2 melhorias opcionais**. O total inclui lacunas documentais e operacionais; não significa 11 vulnerabilidades exploráveis. As cinco entradas altas do npm representam **uma cadeia de dependência**, registrada uma única vez como `AUD-01`.

Severidade considera impacto no escopo da PoC; prioridade de correção pode diferir. “Completa” no inventário significa atendida nos cenários explicitamente examinados, nunca ausência universal de defeitos.

## Convenções de leitura

Os caminhos no corpo dos documentos são relativos à raiz da aplicação; `arquivo:linha` indica a localização no estado auditado. Links para fonte apontam para o arquivo, com as linhas descritas no texto. Não se incluíram comentários reais, nomes de participantes, credenciais, tokens ou conteúdo de logs do serviço.

Justificativas históricas só são atribuídas quando estão documentadas. Nos demais casos, as vantagens e alternativas são avaliação do auditor. Sugestões de correção não autorizam modificar o contrato Zod aprovado.
