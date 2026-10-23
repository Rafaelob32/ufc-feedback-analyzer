# 04 — Rastreabilidade dos requisitos

[Índice](README.md) · [Funcionalidades](03-INVENTARIO-DE-FUNCIONALIDADES.md) · [Testes](08-TESTES-E-VALIDACOES.md)

Esta matriz usa documentos existentes e instruções explícitas conhecidas. A numeração de fases mudou entre pedidos anteriores e o PLAN atual; por isso os requisitos recebem IDs estáveis próprios, sem reconstruir uma cronologia inexistente no Git.

| ID / requisito e origem | Implementação / evidência no código | Teste/evidência | Resultado real |
| --- | --- | --- | --- |
| R01 — Sem backend, DB, API Routes, Server Actions. AGENTS:3; ARCHITECTURE:4 | `next.config.ts:4`; árvore `app` contém apenas layout/page/CSS; nenhum ORM/handler | V01, V05, V06, V07 | Atendido no código e exportação examinados. Ollama é serviço externo previsto |
| R02 — Dados sem persistência de aplicação. ARCHITECTURE:4; PRIVACY:9 | `app/page.tsx:21–37,121–147`; `UploadArea.tsx:22,78–81`; sem APIs de storage | V05; H01 histórico | Atendido como ausência de gravação da aplicação; não prova apagamento físico ou política de processos externos |
| R03 — `output:"export"`. AGENTS:7; ARCHITECTURE:5 | `next.config.ts:4`; build estático | V06 e V07 | Atendido; primeira execução restrita falhou, repetição externa passou |
| R04 — Seleção/drop XLS/XLSX, sem parsing no servidor. Pedido inicial; PLAN:3–4 | `UploadArea.tsx:29–75`; `xlsxParser.ts:86–105` | V02 parser, H01; P06 | Extensão validada. Conteúdo não é estritamente autenticado como XLS/XLSX; UI não coberta automaticamente |
| R05 — Primeira aba; cabeçalho Comentário/Comentários na primeira linha preenchida. Resposta explícita do usuário; README:42–45 | `xlsxParser.ts:6–8,32–55,100,110` | V02 dez testes tabulares | Atendido nos casos testados; só uma coluna reconhecida |
| R06 — RAW com ID numérico imutável, texto e linha. Pedido Fase 2; PRIVACY:8–9 | `types/index.ts:2–8`; `xlsxParser.ts:73–82`; `sigaaParser.ts:53,103` | V02 imutabilidade, lacunas, duplicatas | Atendido; ID é local à importação e muda se a posição física mudar |
| R07 — Aceitar modelo de relatório SIGAA enviado. Pedido de adaptação; PLAN:4 | `sigaaParser.ts:17–103` | V02 treze testes de formato; H01 real anterior | Atendido para a estrutura representada; demais variantes não verificadas |
| R08 — Regex e nomes conhecidos, marcador e preservação de números comuns. Pedido Fase 3; PRIVACY:5 | `sanitize.ts:11,26–56` | V02 quatorze testes; P01 | Parcial: NFC/NFD equivalentes falham no dicionário. Nomes desconhecidos não são detectados por projeto |
| R09 — RAW separado e preservado; somente SANITIZED na IA. PRIVACY:8–10; pedido Fase 3/5 | `page.tsx:92,118,139–142`; `sanitize.ts:53`; `ollama.ts:8–10,95` | V02 integração com Fetch simulado e RAW congelado; P05 | Atendido no fluxo atual. Tipo/shape isoladamente não prova proveniência sanitizada |
| R10 — Fetch exclusivo Ollama local e temperatura zero. ARCHITECTURE:8–10 | `ollamaConnection.ts:4,23–27`; `ollama.ts:85–95` | V02 payload; V09 serviço/CORS | Atendido no protocolo. Não houve generate real nesta auditoria |
| R11 — Verificar via show suporte a think:false; ocultar thinking. AI_CONTRACT:61–65; AGENTS:6 | `ollamaConnection.ts:63–71`; `ollama.ts:15–32,85` | V02 limpeza; P04; V09 | Limpeza atendida. Confirmação do valor false é parcial: só capabilities é verificado (`AUD-03`) |
| R12 — Schema Zod exato, JSON Schema, stream:false, JSON.parse + Zod. AI_CONTRACT:11–55,69 | `schema.ts:4–32`; `ollama.ts:27,79,85` | V02 enumerações, arrays, formato gerado | Atendido. Arrays externos vazios e campos extras descartados são comportamento do próprio contrato |
| R13 — Todos evidenceIds/commentIds existem nos enviados. AGENTS:5; AI_CONTRACT:71 | `ollama.ts:33–39,100` | V02 IDs inventados e ID de outro lote | Atendido; existência do ID não valida conclusão |
| R14 — Loading, resultado local, erros. Pedido Fase 5; PLAN:6 | `page.tsx:83–109`; `AnalysisPanel.tsx:45–73` | V02 serviço e aborto; H01 UI | Implementado. Ausência de teste React automatizado deixa transições parcialmente verificadas |
| R15 — Sumário interativo abre RAW. ARCHITECTURE:13; PRIVACY:13 | `ResultsPanel.tsx:17–39,51,68–94` | H01 citações/foco; V02 IDs | Consulta implementada; promessa de “prova de factualidade” não demonstrada (`AUD-04`) |
| R16 — Duas abas, cinco aspectos, três sentimentos, filtros/tabelas/gráficos. ARCHITECTURE:12–14 | `results.ts:3–29`; `ResultsPanel.tsx:78–140` | V02 projeções; H01 filtros e paginação | Transformação atende; interação completa não repetida agora |
| R17 — Não adicionar bibliotecas na sanitização. Pedido Fase 3 | `sanitize.ts` importa somente tipo interno | V01/V05, package atual | Sanitizador usa JS nativo; evolução histórica de instalações não verificável sem Git |
| R18 — Zod e conversor como dependências autorizadas. Pedido Fase 5 | `package.json:16–17`; `schema.ts:1`; `ollama.ts:2,79` | V01 versões/peer, V02 conversão | Atendido nas versões instaladas |
| R19 — Testes de sanitização, lint e build. Pedidos das fases | `tests/sanitize.test.mjs`, scripts `package.json:5–9` | V02, V03, V04, V06 | Executados; 63 testes totais, lint e tipos passaram, build externo passou |

## Comportamentos adicionais e origem conhecida

| Comportamento | Origem disponível | Julgamento |
| --- | --- | --- |
| Limites de arquivo/dimensões | README:65–67; defesa operacional | Úteis, porém valores não fundamentados por benchmark disponível |
| Lotes 8/3.000, contexto/saída/prazos fixos | README:68–72 e PLAN:6 | Proporcionais à operação local; critérios de ajuste não documentados originalmente |
| Menu de modelos | PLAN atual:3; README:26–29 | Não comprova aprovação histórica para trocar o modelo fixo exemplificado no pedido Fase 5; decisão experimental pendente |
| Importação de respostas docentes | README:42–45 e UploadArea:162 | Comportamento explícito, sem comprovação de intenção original sobre população analisada; validar com responsável |
| Deduplicação de tuplas ABSA | README:47–50; `results.ts:11` | Evita dupla contagem técnica sem eliminar comentários duplicados. Regra de métrica precisa concordância humana |
| Paginação e gráfico CSS | PLAN:7; ARCHITECTURE:14 | Implementação simples do resultado pedido |
| Aborto, timeout, descarte de análise parcial | PLAN:6; README:29,70–72 | Controles coerentes; não há requisito de retomada parcial |

## Divergências e lacunas

1. `docs/PRIVACY.md:5` menciona nomes próprios de modo amplo; o requisito detalhado pediu dicionário conhecido. O código atende a abordagem limitada, além da falha Unicode, mas o documento não explicita essa limitação (`AUD-02/04`).
2. `docs/PRIVACY.md:13` trata citação como factualidade; a implementação só vincula ID e texto. `docs/AI_CONTRACT.md:3` usa garantia de confiabilidade ampla. Há correção dessa interpretação no README, mas os contratos continuam divergentes (`AUD-04`).
3. `docs/AI_CONTRACT.md:61` exige conferir suporte a false; capabilities não demonstra os valores aceitos (`AUD-03`).
4. `app/page.tsx:275` descreve descarte dos dados da página ao remover arquivo; a configuração de nomes é preservada (`AUD-10`).
5. Não existe histórico Git ou critério quantitativo original de acurácia, capacidade, latência e navegadores suportados. Não foram inventados limiares para declarar aprovação.

Não há evidência de requisitos para backend, banco, APIs próprias ou persistência. A solicitação genérica anterior de verificar essas camadas não substitui as proibições específicas da arquitetura.
