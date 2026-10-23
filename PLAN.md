# CRONOGRAMA DE IMPLEMENTAÇÃO

* **Fase 1 (Fundação):** Layout responsivo, UploadArea (.xls/.xlsx) e menu de modelos locais consultando /api/tags implementados.
* **Fase 2 (Processamento Local):** SheetJS na RAM; tabela simples e relatório SIGAA/UFC; IDs iguais às linhas físicas, sem renumeração.
* **Fase 3 (Higienização):** Regex e dicionário configuráveis; RAW imutável separado de SANITIZED; comparação visual.
* **Fase 4 (Motor de IA):** Fetch local, verificação de capacidades via /api/show, JSON Schema/Zod, temperatura zero, think false, invariantes de IDs, lotes, progresso, timeout e cancelamento.
* **Fase 5 (Interface Final):** Sumário com citações que abrem RAW; Dashboard ABSA com filtros, tabela paginada e gráfico local; estados vazios e cobertura da classificação.

## Manutenção após a auditoria

Em 23/10/2026: atualização de segurança do Next.js, correspondência canônica
Unicode no dicionário, verificação de `thinking.values` com sonda sintética para
metadados ausentes, correção das mensagens de descarte e testes E2E do export.
O contrato Zod e as funcionalidades anteriores foram preservados.

Continuação em 23/10: comparação paginada com busca por ID, reutilização do
segmentador Unicode e ensaios sintéticos de capacidade; avaliador ABSA offline
com rascunho de 20 casos para revisão humana. Consulte
[o relatório da continuação](docs/CAPACITY-AND-EVALUATION-2026-10-23.md).

Consulte [NEXT_STEPS](docs/NEXT_STEPS.md) para o estado das recomendações,
[a validação de manutenção](docs/MAINTENANCE-2026-10-23.md) para os testes atuais
e [VALIDATION](docs/VALIDATION.md) para o registro histórico anterior.
A implementação das funcionalidades não equivale a garantia de qualidade semântica
do modelo ou conformidade jurídica automática.
