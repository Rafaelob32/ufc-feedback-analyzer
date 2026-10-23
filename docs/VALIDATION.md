# Revisão e validação — 19 e 20/10/2026

## Resultado

As funcionalidades previstas no PLAN.md foram implementadas, mantendo exportação
estática e dados da aplicação em memória. A suíte passou de 49 para 63 testes.
A validação visual/interativa foi concluída no navegador em 20/10/2026, após
a retomada autorizada pelo usuário. Foram testados desktop e uma área de celular
de 390 × 844 pixels contendo a aplicação real. A área útil medida foi de 375 pixels
por causa da barra de rolagem, sem transbordamento horizontal do documento.
Isso não equivale a uma certificação em todos os navegadores ou aparelhos.

## Correções e funcionalidades

- Sumário com citações numéricas; consulta ao comentário RAW pelo ID imutável,
  mostrando linha física e aba, em diálogo nativo.
- Dashboard ABSA com cinco aspectos e três sentimentos derivados do próprio
  schema, filtros combinados, tabela paginada e gráfico local.
- Classificações idênticas do mesmo comentário contam uma vez. A tela distingue
  comentários sem classificação de classificações neutras.
- Lista de variantes locais do DeepSeek-R1 via /api/tags; verificação de
  capacidades e rejeição de aliases remotos via /api/show.
- Lotes limitados por quantidade e tamanho serializado, progresso, cancelamento,
  prazo por requisição e descarte de análises parciais em caso de falha.
- Validação de IDs contra o lote efetivamente enviado. Um ID de outro lote
  também é rejeitado.
- Remoção de thinking antes e depois do JSON.parse, cobrindo tags codificadas
  como escapes Unicode. Saída truncada é rejeitada.
- Limites explícitos para arquivo e dimensões da aba, com mensagens de erro,
  evitando varreduras arbitrariamente grandes e truncamento silencioso.
- Rótulos explícitos ligados aos menus de modelo, aspecto e sentimento por
  htmlFor/id, separados das opções para evitar nomes acessíveis ambíguos.
- Navegação por seções atualizada, foco visível, abas operáveis por teclado,
  tabela com rolagem horizontal interna e diálogo com retorno de foco.
- Frontend reiniciado como serviço temporário de usuário
  poc-avaliacao-ufc-dev.service, restrito a 127.0.0.1:3000.
  Não foi configurado início permanente após reinicialização.

## Verificações executadas

| Verificação | Resultado observado |
| --- | --- |
| npm test, versão final | 63 testes passaram; zero falhas ou testes ignorados |
| npm run lint, versão final | Exit 0, sem warnings do ESLint |
| npm run build, versão final | Exit 0; TypeScript aprovado; exportação em out/ |
| Rotas produzidas no build | Somente / e /_not-found, ambas estáticas |
| Servidor estático temporário sobre out/ | HTML HTTP 200 e oito assets da página disponíveis, sem Next |
| Frontend de desenvolvimento | HTTP 200 em http://localhost:3000/ |
| Ollama /api/tags e /api/show | Serviço local 0.33.3; deepseek-r1:latest com completion e thinking |
| CORS para localhost:3000 | Preflight HTTP 204 com Access-Control-Allow-Origin correto |
| Inferência REAL pelo serviço TypeScript | Planilha sintética com IDs 2, 4 e 6: três pontos de sumário e três registros ABSA, validados pelo Zod/invariantes; RAW inalterado; thinking ausente |
| Relatorio_Questoes_Abertas.xls fornecido pelo usuário | 11 comentários; IDs 24, 25, 39, 40, 41, 42, 43, 44, 45, 46 e 47; objetos e array congelados |
| Inferência REAL pela interface, três comentários | Clique em analisar, sucesso visível, três pontos de sumário; citações abrem as linhas físicas correspondentes |
| Inferência REAL pela interface, seis comentários sintéticos | 30 classificações; página 1 com 25 linhas e página 2 com 5; limites dos botões corretos |
| Filtros ABSA | Combinação de aspecto/sentimento, gráfico e contador sincronizados; estado vazio; filtro aplicado na página 2 reinicia corretamente a paginação |
| Teclado e evidências | Seta direita troca a aba; diálogo abre com foco em Fechar; Escape fecha e devolve o foco à citação; botão Fechar funciona |
| Responsividade | Comparação em uma coluna, menus e botões ajustados à largura, diálogo legível, rolagem horizontal limitada à tabela; documento sem transbordamento |
| Ciclo de vida em memória | Cancelar permite nova análise; mudar higienização remove resultado anterior; remover arquivo elimina prévias e desabilita análise; recarregar limpa nomes configurados |
| Console da aplicação desktop | Nenhum erro ou warning capturado na checagem |
| npm audit --omit=dev | Zero vulnerabilidades reportadas |
| npm audit completo | Cinco entradas de severidade alta na cadeia do ESLint; pendência descrita abaixo |

Em 19/10, a inferência real foi executada pelo serviço da aplicação em um teste
Node, com a presença do navegador simulada para habilitar o guard. Em 20/10,
o fluxo foi também executado por clique na interface, com uploads reais de
planilhas sintéticas. Em ambos os casos o Ollama era real, sem mock de rede.
O teste de CORS foi feito separadamente.

A revisão de tela pequena usou uma página temporária com iframe na mesma origem,
carregando a aplicação real numa área de 390 × 844 pixels. Essa página não faz
parte do produto e foi removida antes da exportação final, assim como seu asset
gerado. O servidor temporário de teste foi encerrado.

Capturas locais da verificação:

- /tmp/avalia-dashboard-verificado.png — dashboard desktop.
- /tmp/avalia-mobile-comparacao.png — comparação RAW/SANITIZED em uma coluna.
- /tmp/avalia-mobile-evidencia.png — evidência da linha 7 em diálogo de tela pequena.

O relatório real foi apenas lido localmente; não foi modificado, copiado para o
repositório nem enviado ao Ollama nesta revisão. A inferência usou exclusivamente
a fixture sintética após mascaramento de nome, e-mail e matrícula.

Os testes unitários de rede usam mocks para verificar falhas HTTP, JSON inválido,
timeout, cancelamento, aliases remotos, IDs inventados, isolamento de SANITIZED,
saída truncada e união dos lotes. Os testes do parser cobrem XLS e XLSX, tabela e
SIGAA, linhas vazias, fórmulas, cabeçalhos ambíguos e fidelidade do texto original.

## Pendências e limites

1. **Dependência de desenvolvimento:** braces 3.0.3 e dependentes na cadeia do
   eslint-config-next. A [advisoria GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
   não tem versão corrigida publicada. A correção forçada sugerida pelo npm
   regride o eslint-config-next para 14.2.35 e não foi aplicada. Não se afirma que
   ferramentas de desenvolvimento sejam isentas de risco.
2. **Limites funcionais documentados:** comentários individuais acima de 3.000
   caracteres serializados exigem ajuste do relatório/contexto. O sumário agrega
   pontos por lote; a precisão semântica e o mascaramento de dados fora das regras
   dependem de revisão humana. No teste com três comentários, o modelo atribuiu
   Infraestrutura/Negativo ao ID 2, que não descrevia infraestrutura. O schema e
   os IDs eram válidos, mas essa classificação semântica precisa de correção
   humana. Nenhuma garantia de acurácia perfeita é feita. Ver README.md.
3. A auditoria do npm cobre a base de avisos consultada, não prova ausência de
   vulnerabilidades em todo software ou em dependências distribuídas fora do
   registro. Não houve teste de intrusão ou certificação de conformidade jurídica.

## Arquivos alterados nesta revisão

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| app/page.tsx | Modificado | Coordenação de importação, modelo, progresso, invalidação e resultados em memória |
| app/layout.tsx | Modificado | Descrição da aplicação atualizada |
| app/globals.css | Modificado | Foco visível e cursor para controles desabilitados |
| components/UploadArea.tsx | Modificado | Limite de tamanho antes da leitura, indicação do limite e âncora de navegação |
| components/AnalysisPanel.tsx | Modificado | Menu de modelos com rótulo explícito, atualização, erros, progresso por lote e acesso aos resultados |
| components/ResultsPanel.tsx | Criado | Abas de sumário/ABSA, filtros com rótulos explícitos, gráfico, tabela, paginação e diálogo RAW |
| lib/ollama.ts | Modificado | Lotes, limpeza de thinking decodificado, invariantes por lote e rejeição de truncamento |
| lib/ollamaConnection.ts | Criado | Fetch local comum, consulta/validação de modelos, timeout e cancelamento |
| lib/results.ts | Criado | Classificações únicas, enums do contrato, filtros e contagens |
| lib/importLimits.ts | Criado | Limites compartilhados e validação do tamanho do arquivo |
| lib/xlsxParser.ts | Modificado | Verificação das dimensões e recusa de leituras excedentes sem truncar RAW |
| tests/ollama.test.mjs | Modificado | Regressões de privacidade, lotes, thinking, truncamento e cancelamento |
| tests/ollamaConnection.test.mjs | Criado | Descoberta local, capacidades, erros e bloqueio de modelos remotos |
| tests/results.test.mjs | Criado | Filtros, contagens, deduplicação e preservação da entrada |
| tests/xlsxParser.test.mjs | Modificado | Limites de dimensão e tamanho antes da leitura |
| README.md | Criado | Execução, fluxo, privacidade, limites e pendência de dependência |
| PLAN.md | Modificado | Estado das funcionalidades previstas e referência à validação |
| docs/VALIDATION.md | Criado | Evidências dos testes, limitações e lista exata das alterações |

Nenhuma dependência foi adicionada ou alterada. O schema em lib/schema.ts e os
contratos AGENTS.md, ARCHITECTURE.md, PRIVACY.md e AI_CONTRACT.md foram preservados.
Os diretórios gerados .next/ e out/ foram atualizados pelos comandos de validação.
