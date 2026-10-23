# CRONOGRAMA DE IMPLEMENTAÇÃO

* **Fase 1 (Fundação):** Layout responsivo, UploadArea (.xls/.xlsx) e menu de modelos locais consultando /api/tags implementados.
* **Fase 2 (Processamento Local):** SheetJS na RAM; tabela simples e relatório SIGAA/UFC; IDs iguais às linhas físicas, sem renumeração.
* **Fase 3 (Higienização):** Regex e dicionário configuráveis; RAW imutável separado de SANITIZED; comparação visual.
* **Fase 4 (Motor de IA):** Fetch local, verificação de capacidades via /api/show, JSON Schema/Zod, temperatura zero, think false, invariantes de IDs, lotes, progresso, timeout e cancelamento.
* **Fase 5 (Interface Final):** Sumário com citações que abrem RAW; Dashboard ABSA com filtros, tabela paginada e gráfico local; estados vazios e cobertura da classificação.

Consulte docs/VALIDATION.md para os testes efetivamente executados e as pendências.
A implementação das funcionalidades não equivale a garantia de qualidade semântica
do modelo ou conformidade jurídica automática.
