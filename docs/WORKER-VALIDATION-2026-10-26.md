# Validação do processamento em Web Worker

Data: **26/10/2026**, America/Fortaleza. Continuação autorizada das recomendações
de `NEXT_STEPS.md`, a partir de `0913333`. Escopo: responsividade da importação e
sanitização, preservando exportação estática, RAW, IDs e funcionalidades anteriores.

## Resultado e funcionamento

SheetJS e a função pura de sanitização agora executam em Workers dedicados do
navegador. Cada operação cria um Worker e encerra sua execução ao concluir,
falhar, ser cancelada ou atingir 60 segundos. Nenhuma dependência foi adicionada.
Não foram criados backend, persistência, API Routes ou Server Actions.

A página recebe RAW, restaura `Object.freeze` nos objetos e no array, e inicia a
higienização com a configuração mais recente. A alteração do dicionário ou padrão
de matrícula cancela a higienização anterior, limpa SANITIZED e resultados da IA
e bloqueia nova análise até a coleção atual estar pronta. RAW não é sobrescrito.
Remover/trocar a planilha encerra Workers pendentes. Respostas atrasadas não
restauram dados; falhas de higienização oferecem nova tentativa sem reimportar.

O Worker não acessa Ollama nem faz Fetch. O File, RAW, dicionário e SANITIZED
atravessam mensagens locais por structured clone, com cópias temporárias em RAM.
Isso aumenta potencialmente memória e custo de cópia; encerrar Workers não é
garantia de apagamento forense. Apenas erros de validação marcados como
`SpreadsheetError` transportam mensagens do parser; diagnósticos inesperados
são substituídos por mensagens genéricas.

O entrypoint usa `new Worker(new URL(..., import.meta.url), { type: "module" })`,
seguindo a [integração nativa documentada pelo webpack](https://webpack.js.org/guides/web-workers/).
O chunk é entregue como arquivo estático da mesma origem. O empacotamento foi
verificado tanto no build webpack quanto no servidor de desenvolvimento padrão.
Não há fallback síncrono quando o navegador bloqueia ou não suporta Workers.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm test` | 86 testes passaram; 10 novos cobrem ciclo de vida, cancelamento, timeout, erros, protocolo e imutabilidade após clone |
| `npm run lint` | Aprovado, sem avisos |
| `npm run build` | Aprovado; TypeScript e exportação de `/` e `/_not-found` concluídos, com Worker em `out/` |
| `npm run test:e2e` | 30 testes passaram: 15 cenários em Chromium desktop e emulação Pixel 7 |
| `CAPACITY_MAX=50000 npm run test:capacity` | Quatro volumes passaram antes e depois da mudança; medidas abaixo |
| `npm run dev -- --hostname 127.0.0.1 --port 3000` | Serviço local reativado; sessão separada do Chromium abriu a tela, importou XLSX, conferiu máscara/RAW e não registrou `pageerror` |

As primeiras verificações detectaram `prefer-const` no timer do serviço e um
seletor E2E que também encontrava o anunciador de rotas do Next. Ambos foram
corrigidos e revalidados. O primeiro build com Worker já havia passado.

As regressões de navegador usam Workers reais do export. Alguns testes controlam
somente a entrega das mensagens para reproduzir operações pendentes sem depender
de atrasos arbitrários. Cobrem configuração alterada durante leitura, edição
durante sanitização, remoção durante ambas as etapas, erro com nova tentativa,
ausência de Worker, arquivo corrompido e recuperação com XLS binário. Mantêm o
fluxo de análise simulada, inspeção do payload exclusivamente SANITIZED, IDs
2/4/6, filtros, diálogo RAW, cancelamento da IA, paginação e descarte.

Toda a origem do Ollama foi interceptada nos testes de navegador; nenhum relatório
institucional foi usado. Não foi realizada nova inferência real ou avaliação
semântica nesta continuação. Nenhum schema/payload Ollama foi alterado.

## Comparação de capacidade

Ambiente: Intel Core i5-12450HX, 12 CPUs lógicas, 8.021.434.368 bytes de RAM,
Linux/Fedora `7.2.11-200.fc44.x86_64`, Node 24.14.0, npm 11.9.0 e
Chromium 156.0.8078.4. Arquivos de 10.548 a 861.045 bytes, uma coluna,
comentários sintéticos NFD e dicionário de 100 nomes. O maior caso tem 49.999
comentários mais cabeçalho, dentro do limite de 50.000 linhas.

| Comentários | Importação antes → depois (ms) | Editar nomes antes → depois (ms) | Maior tarefa da tela antes → depois (ms) |
| ---: | ---: | ---: | ---: |
| 100 | 126 → 158 | 61 → 91 | 0 → 0 |
| 1.000 | 132 → 145 | 61 → 145 | 0 → 0 |
| 10.000 | 304 → 347 | 176 → 238 | 197 → 0 |
| 49.999 | 975 → 1.112 | 654 → 887 | 816 → 64 |

`0` significa nenhuma tarefa de pelo menos 50 ms observada pelo Long Tasks API,
não ausência total de trabalho na tela. No maior caso ainda ocorreram duas
tarefas longas; a cópia, restauração da imutabilidade e renderização continuam
na thread principal. O maior bloqueio observado caiu cerca de 92%, mas os tempos
totais aumentaram. É uma troca de latência total por menor bloqueio da interface,
não uma aceleração universal do processamento.

Importação inclui a higienização inicial; o teste agora aguarda explicitamente
seu término assíncrono. Antes as duas etapas ocorriam no mesmo bloco síncrono.
Os tempos incluem automação e polling de asserções: uma execução de cada versão,
sem percentis, repetição estatística ou limite de aceite universal. O seletor
manteve no máximo 100 opções e 265 nós DOM nos casos maiores. O heap observado
depois foi 33,1 MB no maior caso, mas **não mede o pico nem necessariamente o heap
dos Workers**, portanto não comprova redução de memória total.

Medidas completas: [worker-2026-10-26.json](benchmarks/worker-2026-10-26.json).
Os resultados anteriores de 23/10 permanecem preservados como histórico.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/commentProcessing.ts` | Ponte da página com Worker, cancelamento, timeout, erros e congelamento dos resultados |
| `lib/processingProtocol.ts` | Tipos das mensagens de leitura, higienização, resposta e erro |
| `lib/sanitizationSettings.ts` | Configuração de matrícula e tipo compartilhado sem importar React |
| `lib/spreadsheetError.ts` | Identificação de erros de validação que podem ser exibidos sem revelar células |
| `workers/comments.worker.ts` | Execução local do parser e sanitizador puro |
| `tests/commentProcessing.test.mjs` | Regressões do serviço que controla os Workers |
| `docs/benchmarks/worker-2026-10-26.json` | Evidência agregada dos ensaios sintéticos |
| `docs/WORKER-VALIDATION-2026-10-26.md` | Este relatório de decisões, comandos, resultados e limites |

## Arquivos modificados

| Arquivo | Responsabilidade da alteração |
| --- | --- |
| `app/page.tsx` | Orquestração assíncrona, invalidação de respostas antigas, estado de higienização e repetição |
| `components/SanitizationPanel.tsx` | Feedback de processamento/erro e ação de nova tentativa |
| `lib/xlsxParser.ts` | Permitir o contexto de Worker mantendo bloqueio fora do navegador e erros controlados |
| `lib/sigaaParser.ts` | Marcar erros conhecidos de validação sem mudar extração ou IDs |
| `lib/importLimits.ts` | Marcar erros conhecidos de limites, preservando os valores existentes |
| `tests/e2e/workflow.spec.mjs` | Cenários reais de Worker, cancelamento, indisponibilidade e recuperação XLS |
| `tests/capacity/import.spec.mjs` | Espera explícita da higienização assíncrona nas medições |
| `AGENTS.md` | Regras para manutenção de Workers, privacidade, testes e medições |
| `PLAN.md` | Estado da implementação e ligação ao relatório atual |
| `README.md` | Operação, estados da interface, dependência do suporte a Worker e validação |
| `docs/ARCHITECTURE.md` | Ciclo de vida e fronteira página/Worker dentro do navegador |
| `docs/PRIVACY.md` | Cópias temporárias em RAM, descarte e análise bloqueada durante higienização |
| `docs/NEXT_STEPS.md` | Estado atualizado da recomendação de capacidade |
| `docs/auditoria/README.md` | Ligação das evidências atuais à auditoria histórica |

## Pendências preservadas

Revisão humana do rascunho ABSA, definição da população/digest/critério de aceite
do experimento e avaliação de navegadores/aparelhos/formatos adicionais continuam
necessárias. O ensaio não homologa 500.000 células, documentos hostis ou consumo
máximo de memória. Os alertas da cadeia de lint e a compatibilidade com ESLint 10
continuam registrados em `NEXT_STEPS.md`; dependências não foram alteradas nem
reauditadas nesta etapa. Não há conclusão nova sobre conformidade jurídica ou
acurácia do modelo.
