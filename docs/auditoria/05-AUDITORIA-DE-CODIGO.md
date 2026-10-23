# 05 — Auditoria de código

[Índice](README.md) · [Fluxos](02-ESTRUTURA-E-FLUXOS.md) · [Registro de achados](09-NAO-CONFORMIDADES.md)

## Método e conclusão

Foram inspecionados os 15 módulos TypeScript/TSX autorais, o CSS, seis arquivos de testes, configurações e documentos. A busca por imports locais e revisão do grafo não identificou ciclos. Não foram encontrados TODO/FIXME/HACK, funções de produto evidentemente abandonadas, rotas inacessíveis ou dependências diretas sem uso demonstrado. Isso não substitui análise exaustiva de código de terceiros.

A organização é adequada à PoC: funções puras para transformação, um serviço de transporte e componentes com responsabilidades reconhecíveis. Os maiores riscos não são ausência de padrões sofisticados, mas diferenças entre o que se valida e o que se promete, tarefas síncronas sobre entradas grandes e falta de testes de ciclo de vida React.

## Princípios e manutenção

| Critério | Evidência e avaliação |
| --- | --- |
| Responsabilidade única | Parser tabular, SIGAA, sanitizador e transporte separados. `Home` também contém layout e todos os estados; 287 linhas ainda administráveis, mas mudanças de fluxo exigem cuidado |
| Aberto/fechado | Regras pequenas e explícitas são preferíveis a registro de plugins. Novo formato exige ramo adicional; isso é aceitável para dois formatos conhecidos |
| Substituição/interface | Não há hierarquia de classes a justificar análise Liskov. Props e tipos readonly são claros; não criar interfaces/repositórios artificiais |
| Inversão de dependência | Serviços importam funções concretas; Fetch é substituído nos testes. Suficiente ao porte. A página importar regras/tipo de configuração de um componente visual é acoplamento invertido pequeno (`page.tsx:8,14–17`) |
| DRY | Enums de resultado vêm do Zod (`results.ts:3–5`); transporte e limites são compartilhados. Extensão se verifica na UI e no serviço: redundância defensiva útil, não bug |
| KISS | Gráfico CSS, diálogo nativo, estado local e Fetch dispensam novas bibliotecas. `ResultsPanel` concentra JSX muito denso; reformatar trechos facilitaria revisão sem redesenhar arquitetura |
| YAGNI | Não há ORM, banco, store global, SDK IA ou biblioteca de gráficos. Não foram encontrados recursos claramente sem finalidade. Seleção de modelos tem utilidade operacional, mas demanda decisão experimental |
| Tipagem | TS strict; tipos de resultado inferidos. Casts nos selects dependem das próprias opções renderizadas. SANITIZED é estrutural e não comprova proveniência; entrada estrita em runtime bloqueia metadados RAW |
| Testabilidade | Funções puras e mocks de Fetch facilitam teste negativo. Componentes React e interação ficam fora dos testes executáveis existentes |

### Duplicações e abstrações

`requestOllama` centraliza timeout, aborto, erros e opções Fetch em três operações: abstração justificada. Separar `results.ts` permite testar contagem sem DOM. `extractSigaaComments` tem parser próprio porque seu layout difere do tabular; extrair um “parser genérico de planilhas” agora aumentaria complexidade sem benefício demonstrado.

As cores de sentimentos estão em dois mapas (`ResultsPanel.tsx:8–15`). São dois contextos visuais diferentes; fundir é melhoria pequena, não falha. `rowIndex` repete numericamente `id`, mas dá sentido explícito à proveniência. Não removê-lo apenas por DRY.

## Concorrência e ciclo de vida

- `importVersion` muda antes de ler (`page.tsx:123`) e é conferido antes de escrever estado (`:138,144`). Troca/remoção não permite que uma leitura antiga sobrescreva a nova.
- `settingsRef` evita que leitura pendente use a configuração capturada antes da edição (`:115,139`).
- `analysisRequest` impede duas análises simultâneas pelo handler e valida identidade antes de estado/progresso (`:84,95,99,102,105`).
- `invalidateAnalysis` aborta e remove resultado antes de troca de modelo, arquivo ou regras. Sem esse controle, IDs repetidos entre arquivos poderiam vincular resultado antigo ao RAW novo.
- Consulta de modelos usa AbortController por effect, limpeza e guard de aborto (`:39–54`); a análise usa outra referência.
- Serviço elimina timers/listeners no `finally`. Os testes cobrem cancelamento anterior, no Fetch, entre lotes e ao concluir o último.
- A leitura SheetJS e a higienização são síncronas após obter o buffer. Não existe cancelamento computacional: controle de versão descarta o resultado, mas não recupera a responsividade durante a tarefa.

Não foi confirmada corrida que sobrescreva estado no fluxo atual. A ausência de teste de componente para essas sequências deixa risco de regressão (`AUD-07`), não prova de defeito.

## Erros, invariantes e limites

As mensagens de rede não exibem corpo bruto, pensamento ou erro interno do modelo. A interface distingue ausência de dados, leitura falha, modelo ausente e inferência rejeitada. Há erro descritivo para comentário acima do limite, sem truncá-lo silenciosamente.

`SanitizedInputSchema.strict()` verifica formato, IDs e unicidade; um objeto `{id,text}` construído sem o sanitizador ainda passa (P05). Uma marca TypeScript poderia evitar enganos acidentais de manutenção, mas não é barreira de segurança contra JavaScript comprometido. No chamador atual, o dado correto é usado; não se recomenda criar outro protocolo apenas para aparentar isolamento.

O schema de saída é exatamente o solicitado. Listas vazias e strings vazias são válidas; a UI mostra mensagens correspondentes. Inventar `.min(1)` externo ou `.strict()` como “correção” violaria a instrução de preservar o contrato. Uma política de completude exige decisão explícita.

## Recursos e escalabilidade

| Operação | Custo/limite observável | Consequência |
| --- | --- | --- |
| Decodificar XLS/XLSX | Arquivo até 10 MiB; expansão antes dos limites de dimensão | Memória descomprimida não limitada; risco, sem exploit demonstrado |
| Localizar cabeçalho/varrer | Retângulo até 500.000 posições; SIGAA varre linhas duas vezes | Custo linear limitado após leitura; layout inválido grande ainda consome tempo |
| Higienizar | Compila regex e percorre todos os textos a cada mudança | Muitos nomes/textos podem bloquear digitação; sem debounce/Worker |
| Prévia | `.find` em ambas as coleções; todas as opções de IDs são renderizadas | Até dezenas de milhares de opções; sem teste de capacidade |
| Planejar lotes | Até oito itens por candidato; stringificação repetida | Constante pequena; não justifica otimização antecipada, mas rejeição de textos longos limita uso |
| Inferir | Lotes sequenciais, cinco minutos por lote | Sem prazo global; duração máxima total cresce com quantidade de lotes |
| Resultados | Tuplas achatadas, deduplicadas, ordenadas; tabela paginada | Paginação limita DOM da tabela, mas não sumário/array completo |
| Resposta HTTP | `response.json()` sem limite próprio de bytes | Serviço local confiável é pressuposto; timeout não substitui limite de memória |

Não houve benchmark, teste de exaustão ou corpus representativo para confirmar capacidade nos limites anunciados. `AUD-06` registra essa hipótese, sem tratá-la como negação de serviço explorada.

## Decisões questionáveis — dez respostas obrigatórias

1. **Mais complexo que necessário?** Next introduz build/framework para uma única página, mas é requisito existente. Migrar para SPA só por preferência seria custo injustificado. Já o JSX comprimido de resultados dificulta revisão sem reduzir complexidade real.
2. **Menos código?** Pequenos controles repetidos poderiam ser formatados ou extraídos localmente quando houver alteração funcional. Não há evidência de redução relevante com biblioteca de componentes.
3. **Abstrações sem valor?** Nenhuma camada existente claramente inútil. Exportar regras de sanitização pelo componente visual é fronteira inconveniente; um módulo de configuração independente seria mais claro, sem “arquitetura de plugins”.
4. **Dependências removíveis?** Nenhuma direta deve ser removida agora. Zod 4 poderia dispensar conversor em migração aprovada; CSS manual poderia dispensar Tailwind ao custo de reescrever layout. Pacotes extras da instalação não são dependências do produto.
5. **Partes com risco de bugs?** Regex Unicode, parser de layout institucional, verificação de thinking, estado assíncrono e limpeza/foco do diálogo. Dois defeitos foram reproduzidos: P01 e P04.
6. **Suposições sem validação?** Nome da tag identifica modelo correto; capabilities implica false; limites de caracteres correspondem a contexto suficiente; regex equivale a anonimização; mistura de docentes/discentes serve à finalidade acadêmica. As quatro últimas exigem delimitação ou experimento, não afirmação automática.
7. **Funcionalidades parciais?** Dicionário com formas canônicas diferentes, verificação de controle thinking, mensagem de descarte, validação semântica e cobertura de UI. “Conformidade LGPD completa” não é funcionalidade demonstrada.
8. **Nova implementação?** Definir antes um protocolo de avaliação, formatos de entrada, métricas e limites; preservar funções puras; registrar versão/digest de modelo; criar poucos E2E críticos e testes negativos Unicode.
9. **Remover/simplificar/reestruturar?** Remover afirmações absolutas dos documentos originais, simplificar JSX, mover configuração para módulo neutro se houver mudança nessa área. Não adicionar servidor, banco, Redux ou framework de agentes.
10. **Aprovação humana?** Escopo de mascaramento, população incluída, critério de acurácia, modelo congelado, resultado vazio permitido, significado dos gráficos e uso institucional. Engenharia não decide esses pontos sozinha; recomendações concretas estão no parecer.
