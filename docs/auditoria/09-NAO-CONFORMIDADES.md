# 09 — Registro de não conformidades e riscos

[Índice](README.md) · [Reprodução](08-TESTES-E-VALIDACOES.md) · [Parecer](10-PARECER-TECNICO-FINAL.md)

Registro inclui defeitos, divergências documentais, riscos e melhorias opcionais. Cada item distingue sua natureza; não se converte ausência de teste em vulnerabilidade comprovada. Estimativas são relativas (baixa: alteração localizada; média: coordenação/testes; alta: experimento ou mudança ampla), não promessas de prazo.

| ID | Severidade | Natureza | Título |
| --- | --- | --- | --- |
| AUD-01 | Alta | Fato confirmado | Dependência de lint com aviso de vulnerabilidade |
| AUD-02 | Média | Fato confirmado | Dicionário falha para Unicode canonicamente equivalente |
| AUD-03 | Média | Fato confirmado | Verificação de modelo não confirma suporte ao valor false |
| AUD-04 | Média | Fato confirmado | Garantias documentais excedem validações demonstradas |
| AUD-05 | Média | Fato confirmado | Ambiente experimental não identifica modelo de forma imutável |
| AUD-06 | Média | Suspeita fundamentada | Limites não controlam todo custo de memória/CPU |
| AUD-07 | Média | Melhoria opcional | Fluxos React sem regressão automatizada e IA sem benchmark |
| AUD-08 | Baixa | Fato confirmado | Instalação com extras e runtime não fixado executavelmente |
| AUD-09 | Média | Fato confirmado | Estado sem histórico Git auditável |
| AUD-10 | Baixa | Fato confirmado | Remoção preserva nomes apesar da mensagem ampla de descarte |
| AUD-11 | Baixa | Melhoria opcional | Extensão aceita não confirma formato real do arquivo |

## AUD-01 — Dependência de lint com aviso de vulnerabilidade

- **Categoria:** cadeia de suprimentos/disponibilidade. **Severidade:** alta, alinhada ao aviso npm; exploração na aplicação não demonstrada.
- **Local:** `package.json:25`; `package-lock.json:2630` (braces), `:3307` (eslint-config-next).
- **Descrição/evidência:** V08a reportou cinco entradas altas na cadeia eslint-config-next → plugin-next → fast-glob → micromatch → braces 3.0.3. São dependentes do mesmo problema, não cinco defeitos autorais. V08b de produção não reportou avisos.
- **Impacto:** entradas adversariais processadas pela ferramenta vulnerável podem afetar disponibilidade do processo de desenvolvimento/CI. Não se encontrou caminho de comentário da UI para braces.
- **Reprodução:** `npm ls braces micromatch fast-glob`; `npm audit --json`. Detalhes e fonte externa no documento 07. Não foi executado exploit.
- **Causa provável:** dependência transitiva na configuração de lint.
- **Correção recomendada:** acompanhar solução compatível, testar atualização/substituição localizada da cadeia; até lá restringir entradas não confiáveis nas ferramentas. Não aplicar downgrade/force automaticamente.
- **Complexidade:** média, dependente de solução upstream. **Reteste:** audit completo/prod, lint, tipos, testes e build após qualquer alteração.

## AUD-02 — Dicionário falha para Unicode canonicamente equivalente

- **Categoria:** privacidade/correção funcional. **Severidade:** média. **Natureza:** fato confirmado.
- **Local:** `lib/sanitize.ts:39–49,56`; teste existente de Unicode em `tests/sanitize.test.mjs:41` não cobre normalização canônica.
- **Descrição/evidência:** nomes são aparados, espaços normalizados e comparados sem case, mas não há equivalência entre caractere acentuado composto e letra + marca combinante. P01 retornou masked=true para NFC e false para NFD do mesmo identificador sintético.
- **Impacto:** nome conhecido cadastrado pode permanecer em SANITIZED e ser enviado ao Ollama local, contrariando a expectativa de mascaramento. Não se demonstrou exposição externa real.
- **Reprodução:** P01 no documento 08, sem rede.
- **Causa provável:** teste de limites Unicode foi confundido com suporte a normalização Unicode.
- **Correção recomendada:** definir comparação canônica para nomes/texto de trabalho preservando RAW; se SAN deve manter byte a byte tudo que não foi mascarado, usar correspondência com mapeamento de posições ou estratégia equivalente, não normalizar RAW. Documentar a política e não remover acentos indiscriminadamente.
- **Complexidade:** média. **Reteste:** NFC↔NFD nos dois sentidos, maiúsculas, nomes compostos, marcas combinantes, colisões de palavras e RAW invariável.

## AUD-03 — Verificação de modelo não confirma suporte ao valor false

- **Categoria:** integração/contrato. **Severidade:** média. **Natureza:** fato confirmado.
- **Local:** `lib/ollamaConnection.ts:63–71`; `lib/ollama.ts:85`; requisito `docs/AI_CONTRACT.md:61–65`.
- **Descrição/evidência:** verifica apenas capabilities completion/thinking e ausência de campos remotos. Ignora `thinking.values`, quando fornecido. P04 aceitou resposta simulada com `values:[true]`; modelo real consultado não declarou esse objeto.
- **Impacto:** pré-checagem pode autorizar um modelo sem comprovar que aceita desativar raciocínio; pode ocorrer falha na geração ou inferência com comportamento diferente do esperado. Limpeza de resposta continua ativa; não foi demonstrado thinking renderizado.
- **Reprodução:** P04; comparar com fonte oficial citada no documento 07.
- **Causa provável:** inferência de que capability thinking implica suporte a true/false.
- **Correção recomendada:** verificar valores disponíveis; para versões sem metadata, definir procedimento explícito de compatibilidade/teste do modelo e falha segura ou suporte documentado. Não alterar silenciosamente o requisito/payload.
- **Complexidade:** média. **Reteste:** values false/true/strings/ausente, serviço sem suporte, cancelamento durante pré-checagem e geração real do modelo escolhido.

## AUD-04 — Garantias documentais excedem validações demonstradas

- **Categoria:** requisitos/documentação/privacidade. **Severidade:** média. **Natureza:** fato confirmado.
- **Local:** `docs/PRIVACY.md:5,13`, `docs/AI_CONTRACT.md:3`; contraste com `README.md:59–77`, `lib/ollama.ts:23–40`.
- **Descrição/evidência:** documentos falam genericamente em nomes próprios, confiabilidade garantida e prova de factualidade. Código implementa dicionário conhecido, shape e pertinência dos IDs. P02/P03 mostram retorno vazio e conclusão arbitrária estruturalmente válida; registro histórico `docs/VALIDATION.md:99–102` relata erro semântico anterior.
- **Impacto:** avaliadores/operadores podem atribuir garantias de anonimização e correção que o software não entrega. A documentação atual é internamente inconsistente.
- **Reprodução:** comparar os trechos; executar P02/P03 e ler teste de nomes desconhecidos em `sanitize.test.mjs:62`.
- **Causa provável:** descrições de intenção transformadas em afirmações de eficácia, sem critérios de aceitação.
- **Correção recomendada:** alinhar contratos a mascaramento limitado e rastreabilidade verificável; diferenciar validação estrutural, completude e acurácia; obter política humana para vazio/ambiguidade e protocolo de avaliação. Não endurecer schema contra a instrução aprovada.
- **Complexidade:** baixa para redação; alta para comprovar eficácia experimental. **Reteste:** revisão cruzada dos documentos/UI e avaliação com corpus anotado aprovado, incluindo identificadores não previstos.

## AUD-05 — Ambiente experimental não identifica modelo de forma imutável

- **Categoria:** reprodutibilidade/validade experimental. **Severidade:** média. **Natureza:** fato confirmado.
- **Local:** `lib/ollamaConnection.ts:3,8–9,51–60`; `app/page.tsx:32–44`; `ResultsPanel.tsx:77`.
- **Descrição/evidência:** aceita nomes locais da família de tags e usa latest por padrão; resultado exibe só nome. Não conserva digest/versão do serviço. V09 identificou digest específico, família declarada qwen3/8.2B/Q4_K_M; esses metadados não comprovam nem refutam sozinhos procedência DeepSeek.
- **Impacto:** mudanças de tag/pesos/quantização podem alterar resultados sem mudança percebida no relatório. Temperatura zero não resolve reprodução entre ambientes.
- **Reprodução:** seguir mapeamento de ModelsSchema e estado da página; constatar que digest retornado por tags não é guardado. V09 registra o observado, sem alterar modelo.
- **Causa provável:** priorização de conveniência operacional, sem protocolo de congelamento.
- **Correção recomendada:** acordar modelo experimental e registrar digest, origem, quantização, versão Ollama, parâmetros e código. Isso pode ser manifesto de experimento sem comentários, mantendo a arquitetura sem persistência de dados pessoais.
- **Complexidade:** média. **Reteste:** modelo com mesma tag/digest diferente, metadados ausentes, registro de execução e repetição controlada.

## AUD-06 — Limites não controlam todo custo de memória/CPU

- **Categoria:** disponibilidade/desempenho. **Severidade:** média. **Natureza:** suspeita fundamentada.
- **Local:** `xlsxParser.ts:97–105,113` e limites `:22–27`; `page.tsx:112–118`; `SanitizationPanel.tsx:94–96`; `ollamaConnection.ts:34`.
- **Descrição/evidência:** arquivo é decodificado antes de validar dimensões; regex e coleção inteira são processadas no thread principal a cada tecla; todas as opções de prévia são renderizadas; resposta HTTP é lida inteira. Limites de entrada existem, mas não são orçamento de memória/tempo global.
- **Impacto potencial:** travamento transitório, grande consumo de RAM ou perda da sessão em arquivos/dicionários adversariais ou grandes. Não foi realizado ataque ou benchmark que confirme um limiar.
- **Reprodução:** caminho de código verificável; teste de carga/expansão em ambiente isolado permanece pendente. Não executar teste destrutivo na sessão real.
- **Causa provável:** foco em casos pequenos da PoC e limites após parse.
- **Correção recomendada:** medir primeiro no hardware alvo; estabelecer orçamento de tamanho expandido/quantidade de texto/nomes/resposta; considerar Worker cancelável para parse e filtro/paginação da prévia se a medição justificar. Limitar antes de alocar quando viável.
- **Complexidade:** média a alta. **Reteste:** corpus de limites, razão de compressão controlada, tempo máximo de bloqueio de UI, memória, aborto e ausência de truncamento silencioso.

## AUD-07 — Fluxos React sem regressão automatizada e IA sem benchmark

- **Categoria:** qualidade/evidência. **Severidade:** média. **Natureza:** melhoria opcional em relação aos requisitos originais de testes unitários/lint/build; necessária para aumentar a confiança operacional.
- **Local:** `package.json:5–9`, seis `tests/*.test.mjs`; áreas descobertas `app/page.tsx:83–147`, `ResultsPanel.tsx:17–144`.
- **Descrição/evidência:** 63 testes exercitam serviços com mocks/fixtures; V11 não carrega componentes. Não existe E2E automatizado, CI ou corpus semântico anotado. Testes manuais históricos são úteis, mas não impedem regressões.
- **Impacto:** mudanças podem quebrar upload/drop, foco, filtros, cancelamento ou ligação de estado sem falhar na suíte; não há métrica de acurácia aceita.
- **Reprodução:** scripts e imports dos testes; relatório de cobertura V11.
- **Causa provável:** desenvolvimento incremental com foco nos serviços.
- **Correção recomendada:** poucos E2E críticos com rede controlada e um protocolo separado de inferência real. Não introduzir framework amplo sem avaliar necessidade e autorização.
- **Complexidade:** média para E2E; alta para corpus/avaliação humana. **Reteste:** ciclo completo, troca durante análise, erro por lote, vazio, teclado/mobile acordados e métricas semânticas documentadas.

## AUD-08 — Instalação com extras e runtime não fixado executavelmente

- **Categoria:** configuração/reprodutibilidade. **Severidade:** baixa. **Natureza:** fato confirmado.
- **Local:** `package.json:1–30`, `README.md:8`, inventário `node_modules` por V01.
- **Descrição/evidência:** seis pacotes extraneous; ausência de engines/packageManager/arquivo de pin; Node emite aviso de tipo de módulo. README especifica somente major 24. Lockfile existe e os testes passaram.
- **Impacto:** outra estação pode executar suíte com runtime incompatível ou instalar árvore diferente; ambiente atual não foi reproduzido limpo.
- **Reprodução:** `npm ls --depth=0`, `node --version`, `npm --version`, `npm test`; lista no documento 07.
- **Causa provável:** resíduos de instalação e configuração operacional incompleta; origem exata dos extras não verificável.
- **Correção recomendada:** em tarefa autorizada, validar `npm ci` em cópia limpa, fixar ferramenta/runtime e explicitar ESM após testar configs. Não apagar node_modules do usuário como “correção” nesta auditoria.
- **Complexidade:** baixa. **Reteste:** instalação limpa, ausência de extras, suíte/lint/tipos/build no runtime suportado.

## AUD-09 — Estado sem histórico Git auditável

- **Categoria:** rastreabilidade/versionamento. **Severidade:** média. **Natureza:** fato confirmado.
- **Local:** raiz da aplicação/ancestrais acessíveis; não há arquivo/linha de produto aplicável.
- **Descrição/evidência:** git status, rev-parse e log falham com exit 128. Não é possível identificar commit, diferenciar mudanças preexistentes ou criar commit documental no repositório atual.
- **Impacto:** autoria, evolução dos requisitos, revisão de regressões e reprodução por commit não verificáveis.
- **Reprodução:** V13 no documento 08.
- **Causa provável:** checkout sem metadados ou projeto ainda não inicializado; não foi possível determinar qual.
- **Correção recomendada:** responsável localizar checkout original ou autorizar criação de repositório com baseline adequada. Não inventar histórico nem fazer git init para esconder a lacuna. Manifesto SHA-256 identifica somente o conteúdo observado.
- **Complexidade:** baixa se metadados existirem; recuperação histórica pode ser impossível. **Reteste:** status/log/rev-parse válidos, diff revisado e commit somente documental.

## AUD-10 — Remoção preserva nomes apesar da mensagem ampla de descarte

- **Categoria:** privacidade/clareza de interface. **Severidade:** baixa. **Natureza:** fato confirmado por fluxo de código.
- **Local:** `app/page.tsx:23,112–118,121–130,275`; `README.md:39–40`.
- **Descrição/evidência:** remover arquivo zera RAW/SAN e resultado, mas não chama setSanitizationSettings. A mensagem diz que remover descarta dados mantidos na página, embora o dicionário possa conter nomes. README descreve corretamente que configurações só são descartadas no reload/fechamento.
- **Impacto:** operador pode acreditar que limpou também identificadores digitados. Não há persistência em disco nem envio automático do dicionário.
- **Reprodução:** cadastrar identificador sintético, importar fixture, remover; textarea deve permanecer pelo código. Esse ciclo específico não foi repetido no navegador nesta auditoria.
- **Causa provável:** reutilização deliberada de configuração entre planilhas com mensagem genérica demais.
- **Correção recomendada:** esclarecer o escopo do botão/mensagem; se desejado, oferecer limpeza de toda sessão com comportamento acordado. Não apagar configuração útil silenciosamente sem decidir a regra.
- **Complexidade:** baixa. **Reteste:** remoção preservando/limpando conforme decisão, reload e ausência de resultados antigos.

## AUD-11 — Extensão aceita não confirma formato real

- **Categoria:** contrato de entrada/endurecimento. **Severidade:** baixa. **Natureza:** melhoria opcional.
- **Local:** `UploadArea.tsx:7,37`; `xlsxParser.ts:90–105`.
- **Descrição/evidência:** nome com extensão Excel passa a barreira; SheetJS autodetecta outros formatos. P06 importou texto ASCII renomeado `.xlsx`.
- **Impacto:** aceitação é mais ampla que a indicação visual “Excel”; aumenta formatos internos processados. Não houve XSS, execução de macro ou leitura remota demonstrada.
- **Reprodução:** P06 no documento 08.
- **Causa provável:** confiança na autodetecção tolerante do SheetJS, após validação de extensão solicitada originalmente.
- **Correção recomendada:** decidir se apenas BIFF/OOXML deve ser admitido. Se sim, conferir assinatura/container e formato esperado, sem confiar em MIME/extensão; se tolerância for desejada, documentá-la. Assinatura não substitui parse seguro.
- **Complexidade:** baixa a média. **Reteste:** XLS/XLSX legítimos, texto renomeado, arquivo truncado, criptografado e container inválido.
