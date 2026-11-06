# CRONOGRAMA DE IMPLEMENTAÇÃO

* **Fase 1 (Fundação):** Layout responsivo, UploadArea (.xls/.xlsx) e menu de modelos locais consultando /api/tags implementados.
* **Fase 2 (Processamento Local):** SheetJS na RAM; tabela simples e relatório SIGAA/UFC; IDs iguais às linhas físicas, sem renumeração.
* **Fase 3 (Higienização):** Regex e dicionário configuráveis; RAW imutável separado de SANITIZED; comparação visual.
* **Fase 4 (Motor de IA):** Fetch local, verificação de capacidades via /api/show, JSON Schema/Zod, temperatura zero, think false, invariantes de IDs, lotes, progresso, timeout e cancelamento.
* **Fase 5 (Interface Final):** Sumário com citações que abrem RAW; Dashboard ABSA com filtros, tabela paginada e gráfico local; exportação local sob demanda em planilha detalhada (`.xlsx` com 4 abas), sumarização (`.txt`), dashboard ABSA (`.csv`) e resultado estruturado (`.json`); estados vazios e cobertura da classificação.

## Manutenção após a auditoria

Em 23/10/2026: atualização de segurança do Next.js, correspondência canônica
Unicode no dicionário, verificação de `thinking.values` com sonda sintética para
metadados ausentes, correção das mensagens de descarte e testes E2E do export.
O contrato Zod e as funcionalidades anteriores foram preservados.

Continuação em 23/10: comparação paginada com busca por ID, reutilização do
segmentador Unicode e ensaios sintéticos de capacidade; avaliador ABSA offline
com rascunho de 20 casos para revisão humana. Consulte
[o relatório da continuação](docs/CAPACITY-AND-EVALUATION-2026-10-23.md).

Continuação em 26/10: parsing e sanitização transferidos para Workers dedicados
do navegador, sem novas dependências, com timeout, cancelamento, recuperação de
falhas e bloqueio da análise durante higienização. A exportação estática e os
IDs físicos foram preservados. Evidências e limites estão em
[WORKER-VALIDATION-2026-10-26](docs/WORKER-VALIDATION-2026-10-26.md).

Em 27/10: reavaliação da cadeia de lint e correção do novo alerta de Zod com
atualização para 4.6.7, geração nativa de JSON Schema e limites de tamanho e
complexidade antes de validar as respostas do Ollama. Campos e enums do contrato
foram preservados. Consulte [a validação de segurança](docs/SECURITY-VALIDATION-2026-10-27.md).

Em 03/11/2026: habilitação de variantes locais do `llama3.1` ao lado do `deepseek-r1`,
instrução de saída JSON compacta com subdivisão automática de lotes quando um lote
com múltiplos comentários atinge `done_reason: "length"`, simplificação visual do
painel de higienização (fixando o padrão de matrículas da UFC de 6 a 7 dígitos na
interface com campo de nomes em largura total) e botões de download local
para a planilha detalhada em Excel (`.xlsx` com 4 abas: `Dashboard`, `Sumarização`,
`Classificações ABSA` e `Consolidado por ID`), além de sumarização (`.txt`),
dashboard ABSA (`.csv` UTF-8 com BOM) e JSON estruturado (`.json`), sem expor
textos RAW ou SANITIZED.

Consulte [NEXT_STEPS](docs/NEXT_STEPS.md) para o estado das recomendações,
[a validação de segurança](docs/SECURITY-VALIDATION-2026-10-27.md) para os testes atuais
e [VALIDATION](docs/VALIDATION.md) para o registro histórico anterior.
A implementação das funcionalidades não equivale a garantia de qualidade semântica
do modelo ou conformidade jurídica automática.
