# 03 — Inventário de funcionalidades

[Índice](README.md) · [Requisitos](04-RASTREABILIDADE-DOS-REQUISITOS.md) · [Verificações](08-TESTES-E-VALIDACOES.md)

Status considera o comportamento descrito, não uma aprovação universal. Testes `Vxx/Pxx` são atuais; `H01` é evidência histórica em `docs/VALIDATION.md`. A aceitação visual completa de controles não foi reexecutada nesta auditoria.

## F01 — Fundação e exportação estática

- **Origem/esperado:** R01–R03, uma aplicação responsiva sem backend/persistência.
- **Real/módulos:** `next.config.ts:4`, `app/layout.tsx:10`, `app/page.tsx:150–287`; página inicial e erro estático, interface React.
- **Entrada/saída:** acesso HTTP → HTML/CSS/JS e hidratação; nenhum dado de usuário no build.
- **Validação/erros/extremos:** V06 build; V07 HTML e oito assets HTTP 200; V10 abertura desktop sem erro de console. Fonte `pt-BR`, foco e controles nativos.
- **Limites:** primeiro build restrito falhou; repetição fora do isolamento passou. Responsividade histórica em H01, sem nova matriz de dispositivos.
- **Status:** **completa no escopo estático examinado**; acessibilidade e compatibilidade ampla não verificadas.

## F02 — Seleção, drop, troca e remoção de planilha

- **Origem/esperado:** R04, um XLS/XLSX por vez, mantido em memória.
- **Real/módulos:** `UploadArea.selectFile:29`, `handleDrop:71`, `removeFile:78`, `app/page.tsx:121`.
- **Entrada/saída:** `FileList` → `File|null` para a página. Extensão, tamanho e cardinalidade validados.
- **Erros/extremos:** vazio, múltiplos, extensão errada, mais de 10 MiB; erro preliminar mantém arquivo anterior. Seleção válida mas ilegível substitui o anterior e termina sem comentários.
- **Testes:** V02 parser verifica extensão/tamanho; H01 upload/remoção. Drag-and-drop e estados próprios do componente não têm teste automatizado.
- **Limites:** extensão não comprova conteúdo Excel; P06 aceitou texto ASCII renomeado. Dicionário continua após remover (`AUD-10`).
- **Status:** **parcial** na evidência: mecanismo implementado, cobertura automatizada de UI ausente.

## F03 — Parser tabular e IDs

- **Origem/esperado:** R05–R06, primeira aba, cabeçalho Comentário/Comentários, texto bruto e ID imutável.
- **Real/módulos:** `extractRawComments`, `lib/xlsxParser.ts:16–82`; leitura `:86–114`.
- **Entrada/saída:** File → array RAW congelado com linha física e aba.
- **Validações:** cabeçalho único na primeira linha preenchida, células textuais, limites de dimensões; só a normalização do cabeçalho altera comparação.
- **Erros/extremos:** aba vazia, cabeçalho ausente/duplicado, fórmulas, números, arquivo ilegível, lacunas e duplicatas. Linha vazia é ignorada sem renumerar.
- **Testes:** V02, dez casos `tests/xlsxParser.test.mjs`; fixture real sintética lida pelo SheetJS.
- **Limites:** um layout e uma aba por sessão; Unicode de cabeçalho não normalizado canonicamente; limites após decodificação.
- **Status:** **completa nos formatos/casos examinados**, com risco de recursos e tolerância de formato em `AUD-06/11`.

## F04 — Parser SIGAA/UFC

- **Origem/esperado:** R07, aceitar a estrutura do relatório fornecido.
- **Real/módulos:** `extractSigaaComments`, `lib/sigaaParser.ts:17–103`; entrada acionada por `xlsxParser.ts:52–54`.
- **Entrada/saída:** worksheet com assinatura UFC/questões abertas, colunas A/B/C → respostas RAW.
- **Validações:** disciplina antes do bloco, rótulos conhecidos, texto em C; avisos exatos de ausência são omitidos.
- **Erros/extremos:** bloco órfão, falta de seções, fórmula/erro/número; rótulos desconhecidos encerram captura. Mudança de identificação/curso encerra bloco anterior.
- **Testes:** V02, 13 casos sintéticos, serialização XLS e XLSX; H01 registra leitura do relatório real, não repetida agora.
- **Limites:** novo layout institucional pode exigir adaptação; docentes e discentes são misturados, curso não é armazenado. Não há requisito verificável de segmentação.
- **Status:** **completa para a estrutura sintética representativa**; universalidade dos relatórios não verificável.

## F05 — Mascaramento por regras

- **Origem/esperado:** R08, e-mails comuns, matrícula configurável e nomes cadastrados, preservando números cotidianos.
- **Real/módulos:** `sanitizeComments`, `lib/sanitize.ts:21–57`.
- **Entrada/saída:** RAW + nomes + comprimentos → nova coleção `{id,text}` congelada.
- **Validações:** comprimento inteiro 1–32; nomes escapados como literais, limites Unicode, prioridade de nomes completos; marcador protegido.
- **Erros/extremos:** regra inválida lança RangeError; dicionário vazio não remove nomes; números longos fora do padrão continuam; formatos de e-mail não ASCII não cobertos.
- **Testes:** V02, 14 casos; P01 demonstrou que acento decomposto deixa de coincidir com nome composto cadastrado.
- **Limites:** nenhuma prova de anonimização completa; falha canônica confirmada `AUD-02`.
- **Status:** **parcial**.

## F06 — Configuração e comparação RAW/SANITIZED

- **Origem/esperado:** R09, preservação do original e comparação visual vinculada pelo ID.
- **Real/módulos:** `app/page.tsx:112–118,139–142`, `SanitizationPanel.tsx:25–115`.
- **Entrada/saída:** edição do dicionário/padrão e escolha de ID → amostra original e higienizada.
- **Validações/erros:** regra oferecida por select controlado; entrada de nomes é literal; UI explica cobertura limitada. Não existe tratamento específico para excesso de nomes.
- **Extremos:** até 50 mil opções de amostra; recalcula toda coleção a cada tecla; mantém configuração entre arquivos.
- **Testes:** V02 imutabilidade; H01 comparação/alteração. Falta teste React da transição/race.
- **Status:** **completa no mecanismo de separação**, com cobertura de interação parcial e limites `AUD-06/10`.

## F07 — Descoberta e validação do modelo local

- **Origem/esperado:** R10–R11, usar DeepSeek local e confirmar controle de thinking.
- **Real/módulos:** `listLocalModels:55`, `verifyLocalModel:63` em `ollamaConnection.ts`; effect `app/page.tsx:39`.
- **Entrada/saída:** tags/show → nomes locais filtrados e autorização de análise.
- **Validações/erros:** nome, campos de alias remoto, capabilities completion/thinking, HTTP/JSON, CORS, timeout e aborto.
- **Extremos:** lista vazia desabilita análise; nome local não prova origem dos pesos; `thinking.values` não é inspecionado.
- **Testes:** V02 cinco casos; V09 serviço real; P04 demonstra aprovação mesmo com `values:[true]`.
- **Status:** **parcial** (`AUD-03/05`).

## F08 — Inferência, lotes, progresso e cancelamento

- **Origem/esperado:** R10, R12, R14: apenas SANITIZED, Fetch local, JSON estruturado, temperatura zero, resultado seguro.
- **Real/módulos:** `analyzeComments`, `lib/ollama.ts:67–108`; transporte `ollamaConnection.ts:12`.
- **Entrada/saída:** SANITIZED + signal/modelo → Promise de resultado combinado ou erro, callback por lote.
- **Validações:** IDs únicos positivos seguros, objetos estritos, entrada não vazia, orçamento por lote, envelope completo, recusa de `done_reason:length`.
- **Erros/extremos:** um comentário grande impede tudo; falha de qualquer lote descarta parciais; cancelar impede retorno inclusive no último lote; sem retomada/retry.
- **Testes:** V02 vinte casos de serviço, incluindo parser→sanitização→Fetch simulado; H01 inferência local real anterior.
- **Limites:** contexto estimado por caracteres; modelo/quantização podem mudar; nenhum teste real de generate reexecutado nesta auditoria.
- **Status:** **completa no protocolo simulado examinado**, operação integral atual dependente de validação real adicional.

## F09 — Validação de resposta e thinking

- **Origem/esperado:** R12–R13, schema exato, remover raciocínio, rejeitar IDs inventados.
- **Real/módulos:** `parseAnalysisResponse`, `lib/ollama.ts:15–40`; `lib/schema.ts:4`.
- **Entrada/saída:** string + IDs permitidos → resultado tipado.
- **Validações/erros:** JSON.parse, Zod, tags incompletas, IDs fora do lote; erros não exibem corpo bruto. Tags codificadas são limpas após decodificar.
- **Extremos:** `{summary:[],absa:[]}` válido; texto vazio permitido; campos extras descartados; sentido do texto não examinado.
- **Testes:** V02 e P02/P03; schema convertido também testado.
- **Status:** **completa para validação estrutural exigida**. Fidelidade semântica não é assegurada (`AUD-04`).

## F10 — Sumário com evidências

- **Origem/esperado:** R15, marcadores interativos retornam ao RAW correto.
- **Real/módulos:** `ResultsPanel.tsx:17–39,51,68–94`; consulta por Map, diálogo nativo.
- **Entrada/saída:** pontos summary + RAW → texto/citações e comentário original com linha/aba.
- **Erros/extremos:** sumário vazio ou texto vazio têm mensagem; IDs repetidos por ponto são deduplicados; sem paginação do sumário.
- **Testes:** H01 citações, Escape e retorno de foco; V02 valida a existência do ID, mas não renderiza esse componente.
- **Limites:** síntese concatena lotes; não há revisor/correção humana no produto, apenas consulta de evidência.
- **Status:** **parcial**, com semântica não validada.

## F11 — ABSA, filtros, gráfico e tabela

- **Origem/esperado:** R16, cinco aspectos/três sentimentos, filtros e gráficos.
- **Real/módulos:** `lib/results.ts:11–29`, `ResultsPanel.tsx:95–140`.
- **Entrada/saída:** ABSA → tuplas únicas, contagens, tabela de 25 linhas/página.
- **Validações/erros:** enums derivam do schema, filtros combinados; contador de não classificados; estado vazio; filtro reinicia página.
- **Extremos:** sentimentos opostos do mesmo aspecto são mantidos; contagem é de classificações, não de alunos; repetição idêntica conta uma vez.
- **Testes:** V02 um teste com múltiplas asserções; H01 interação em 30 classificações e duas páginas.
- **Status:** **completa na transformação de dados testada**; interface integral parcialmente verificada.

## F12 — Ciclo de vida e descarte

- **Origem/esperado:** R02/R09/R14, manter dados apenas na sessão e evitar resultados obsoletos.
- **Real/módulos:** `app/page.tsx:56–69,83–147`, `UploadArea.tsx:78`.
- **Entrada/saída:** troca/configuração/cancelamento/remoção → abortar análise, limpar resultados e ignorar resposta antiga.
- **Testes:** V02 cobre aborto no serviço; H01 cobre remoção/reload. Inspeção confirma versionamento de importação e identidade de requisição.
- **Limites:** parser síncrono não pode ser interrompido; limpeza não zeroiza RAM; nomes ficam no textarea após remoção (`AUD-10`).
- **Status:** **parcial em relação à mensagem ampla de descarte da UI**; ausência de persistência de aplicação confirmada por inspeção.

## Ausências e limites que não são funcionalidades prometidas

Backend de negócio, banco, API Routes, autenticação, nuvem, persistência, múltiplos arquivos, segmentação por curso, edição de classificações e exportação final estão ausentes. Os quatro primeiros tipos de infraestrutura de dados são proibidos ou não requeridos nos contratos; não devem ser “completados” por iniciativa da auditoria.

Não há funcionalidade crítica inteiramente ausente entre as descritas no plano atual. As pendências são precisão do mascaramento, confirmação de capacidades, alinhamento de garantias, reprodutibilidade e cobertura, detalhadas nos achados.
