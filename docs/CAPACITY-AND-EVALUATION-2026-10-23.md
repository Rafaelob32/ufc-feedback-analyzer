# Capacidade e preparação da avaliação — 23/10/2026

Continuação autorizada após a manutenção registrada no commit `ac9d208`.
Não houve novas dependências, mudança do schema Zod, backend ou persistência
no frontend. As alterações foram motivadas por ensaios com dados sintéticos.

## Problema reproduzido e correção

O seletor RAW/SANITIZED renderizava uma opção para cada comentário. Com 49.999
comentários, havia 50.154 elementos no documento e a maior tarefa observada
bloqueou a thread principal por 1.198 ms. A edição de uma configuração também
recriava um segmentador Unicode para cada comentário com forma decomposta.

A comparação agora mostra até 100 opções por página, navegação anterior/próxima
e localização direta pelo ID original. IDs com lacunas continuam acessíveis;
ID inexistente apresenta erro sem mudar a seleção. Importar outra planilha
mantém o fallback para um comentário válido. Nenhum texto ou ID foi truncado,
renumerado ou substituído pela paginação.

A sanitização reutiliza um segmentador dentro da chamada, criado sob demanda
quando houver remapeamento Unicode. Não mantém cache entre chamadas e preserva
a função pura, os IDs, RAW e trechos não mascarados.

## Medições observadas

Fedora/Linux `7.2.11-200.fc44.x86_64`, Intel i5-12450HX, 12 CPUs lógicas,
8.021.442.560 bytes de RAM, Node 24.14.0 e Chromium 156.0.8078.4 headless.
O export estático foi servido na porta 4173. O Ollama foi interceptado e nenhuma
inferência executada. Cada cenário criou uma aba/coluna com textos sintéticos NFD,
um e-mail fictício, matrícula fictícia, notas comuns e um dicionário de 100 nomes.

| Comentários | Importação ms, antes → depois | Edição ms, antes → depois | Opções no seletor | Maior tarefa observada ms |
| --- | --- | --- | --- | --- |
| 100 | 122 → 108 | 62 → 52 | 100 → 100 | 0 → 0 |
| 1.000 | 144 → 122 | 77 → 64 | 1000 → 100 | 58 → 50 |
| 10.000 | 861 → 290 | 342 → 177 | 10000 → 100 | 281 → 192 |
| 49.999 | 2587 → 979 | 1379 → 631 | 49999 → 100 | 1198 → 820 |

No cenário maior, o documento final tinha 265 elementos. O arquivo XLSX sintético
tinha 861.045 bytes, muito abaixo do limite de 10 MB: o teste exercita 50.000 linhas
incluindo cabeçalho, **não** o pior arquivo possível de 500.000 posições de células.

Os números são uma execução estendida anterior e a última execução completa após
as correções, no mesmo computador. Houve aquecimento e variação entre execuções;
não são médias/percentis nem uma comparação estatística controlada. Importação
mede seleção até feedback, e edição mede preenchimento do dicionário até a amostra
mascarada, incluindo custos da automação. A maior tarefa reúne ambas as operações.
`performance.memory` foi apenas uma observação arredondada do Chromium, não pico
ou prova de ausência de vazamento. Dados completos: [JSON das medições](benchmarks/capacity-2026-10-23.json).

O gargalo do seletor foi corrigido, mas parsing/sanitização continuam síncronos.
O bloqueio final observado de 820 ms no cenário maior ainda prejudica a interação.
Para volumes grandes, a próxima melhoria técnica é executar essas operações em
Web Worker local, com cancelamento e proteção contra respostas antigas. Não foi
reduzido silenciosamente o limite de importação nem declarada homologação universal.

## Avaliador e rascunho de referência

Foram preparados 20 comentários sintéticos com rótulos propostos pelo agente,
cobrindo as combinações de aspectos/sentimentos, ambiguidades, múltiplos rótulos,
texto adversarial e ausência de aspecto. O arquivo permanece `draft`, sem revisor.

O avaliador offline usa o schema aprovado, valida os IDs, deduplica previsões e
calcula métricas micro/por rótulo/macro, correspondência exata e cobertura. Exige
metadados de revisão humana e produz hashes SHA-256 dos dois arquivos utilizados.
Não pontua factualidade da síntese nem registra acurácia científica do modelo.
A declaração de revisão não autentica o revisor: a revisão real continua necessária.
Leia [EVALUATION](EVALUATION.md) antes de utilizar o comando.

## Verificações realizadas

| Verificação | Resultado |
| --- | --- |
| `npm test` | 76 testes passaram, zero falhas/ignorados; cinco novos testes de avaliação matemática e validação da referência |
| `npm run lint` | Exit 0, sem avisos |
| `tsc --noEmit --incremental false` | Exit 0 |
| `npm run build` | Exit 0; `/` e `/_not-found` estáticas em `out/` |
| `npm run test:e2e` | 16/16 passaram, desktop/mobile; inclui páginas, busca por ID com lacunas, ID inexistente, troca de arquivo e largura do documento |
| `CAPACITY_MAX=50000 npm run test:capacity` | 4/4 passaram; assert de até 100 opções; feedback, preservação RAW, máscara e descarte conferidos |
| CLI de avaliação | Rascunho recusado com exit 1; fixture matemática fictícia pontuada com exit 0 e hashes válidos; JSON inválido recusado sem expor seu texto |

O smoke test do CLI usou arquivos temporários fictícios. O status de revisão dessa
fixture serve somente para exercitar o programa e não foi atribuído ao corpus draft
versionado. Não houve análise de planilha institucional nem teste real de inferência
nesta continuação. O lockfile e as versões das dependências permaneceram inalterados;
os alertas da cadeia de lint registrados anteriormente continuam pendentes.

## Pendências delimitadas

- Revisão humana dos exemplos e rótulos, escolha de população/digest e critérios de qualidade antes de pontuar uma execução científica.
- Avaliação humana de sínteses e suas evidências; métricas ABSA não medem factualidade.
- Processamento em background no navegador, dicionários maiores que 100 nomes, planilhas largas/complexas, limite de bytes, inferência em muitos lotes e memória ao longo de várias importações.
- Outros navegadores/aparelhos e uma campanha com repetições/percentis. Mobile foi emulado somente nos testes funcionais, não neste ensaio de capacidade.
- Atualização compatível da cadeia de lint; esta continuação não altera as dependências nem repete a auditoria de pacotes já registrada.

## Arquivos criados ou modificados

| Arquivo | Responsabilidade |
| --- | --- |
| `components/SanitizationPanel.tsx` | Paginação de até 100 opções e busca por ID |
| `lib/sanitize.ts` | Reutilização local e sob demanda do segmentador Unicode |
| `tests/e2e/workflow.spec.mjs` | Regressão de navegação/IDs com lacunas em desktop e mobile |
| `playwright.capacity.config.mjs` — novo | Execução isolada dos ensaios de capacidade sobre o export |
| `tests/capacity/import.spec.mjs` — novo | Geração sintética, medições e verificações funcionais em escala |
| `scripts/lib/evaluateAbsa.mjs` — novo | Referência revisada, validação e métricas ABSA offline |
| `scripts/evaluate-absa.mjs` — novo | CLI, hashes e mensagens de erro controladas |
| `tests/evaluation.test.mjs` — novo | Matemática, deduplicação, saídas vazias e recusa de referências/IDs inválidos |
| `tests/fixtures/absa-draft.json` — novo | 20 exemplos propostos por IA, explicitamente não revisados |
| `package.json` | Comandos de capacidade e avaliação, sem alteração das dependências |
| `docs/EVALUATION.md` — novo | Uso e limitações das métricas e do rascunho |
| `docs/CAPACITY-AND-EVALUATION-2026-10-23.md` — novo | Este relatório de evidências e limitações |
| `docs/benchmarks/capacity-2026-10-23.json` — novo | Medições anteriores/posteriores e ambiente, sem comentários |
| `AGENTS.md` | Instruções para manter paginação, ensaios sintéticos e revisão humana real |
| `PLAN.md` | Estado da continuação e referências às evidências |
| `README.md` | Navegação e comandos novos |
| `docs/ARCHITECTURE.md` | Paginação, segmentador transitório e ferramenta offline |
| `docs/EXPERIMENT_PROTOCOL.md` | Ferramentas preparadas e limites de interpretação |
| `docs/NEXT_STEPS.md` | Pendências atualizadas com base nas medições |
| `docs/auditoria/README.md` | Link para esta continuação sem reescrever a auditoria histórica |
