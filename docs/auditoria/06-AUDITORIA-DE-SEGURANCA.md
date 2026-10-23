# 06 — Auditoria de segurança e privacidade

[Índice](README.md) · [Dependências](07-DEPENDENCIAS-E-CONFIGURACOES.md) · [Achados](09-NAO-CONFORMIDADES.md)

## Modelo de ameaça e alcance

Ativos: textos originais, identificadores, dicionário de nomes, textos tratados e conclusões. Entradas não confiáveis: arquivos, comentários, nome de aba, respostas/metadados do modelo. Fronteiras: sistema de arquivos do usuário → navegador; navegador → Ollama local; servidor estático → JavaScript carregado.

O operador da máquina, extensões do navegador, software que escuta em localhost e distribuições de dependências influenciam a confiança. Esta foi revisão de código e sondagens limitadas, não pentest, auditoria de sistema operacional, análise de pesos ou certificação jurídica.

## Controles verificados

| Área | Controle/evidência | Limite |
| --- | --- | --- |
| Entrada de arquivo | `UploadArea.tsx:29–46`, `xlsxParser.ts:90–105`: único arquivo, extensão, tamanho e leitura local | Extensão pode ser falsificada; P06 aceitou texto renomeado |
| Formato e fórmulas | `xlsxParser.ts:25–27,68`, `sigaaParser.ts:49`: rejeita limites e fórmulas nas células de comentário | Não executa fórmula/macros; rejeição de células não equivale a parser seguro para todo arquivo hostil |
| Separação | Frozen arrays/objetos, somente id/text no prompt; teste `ollama.test.mjs:107` | Mesma página/processo, não enclave. O schema de entrada não prova que texto foi higienizado |
| Mascaramento | Regex numérica delimitada, e-mail, nomes literais escapados | Nomes não cadastrados e formas não previstas permanecem; falha NFC/NFD reproduzida |
| XSS | Conteúdo em expressões React, sem `dangerouslySetInnerHTML`, eval ou Markdown HTML | Revisão da aplicação, não garantia sobre todas as dependências/navegadores |
| Injeção no prompt | `ollama.ts:89,92`: comentários tratados como dados, sem instruções | Linguagem natural não é isolamento formal; IA pode produzir interpretação falsa dentro do schema |
| Transporte | Origem fixa local, sem credenciais, redirects recusados, no-store, AbortController | CORS precisa ser configurado; serviço local não tem autenticação adicionada pela aplicação |
| Resposta | Envelope/Zod/IDs, bloqueio de truncamento, limpeza thinking | Semântica e completude não validadas; `thinking.values` ignorado |
| Erros e logs | Mensagens controladas de Ollama; não há console de conteúdo no código autoral | Logs de Ollama/OS/extensões não inspecionados; nome de arquivo/RAW é visível ao operador |
| Persistência | Busca não encontrou local/sessionStorage, IndexedDB, cookies de aplicação ou backend | Ausência de API de storage não prova zero escrita por browser/OS ou apagamento seguro |
| Segredos | Nenhum token/chave/configuração secreta encontrado nos 38 arquivos relevantes; `.env*` ignorado | Não se vasculhou indiscriminadamente a máquina nem todo histórico, que está indisponível |
| Permissões | File selecionado pelo usuário; nenhum acesso de filesystem em código de produção | Documentos reais permanecem no disco de origem. Runtime de desenvolvimento é outro escopo |

Há somente um ponto de Fetch autoral (`lib/ollamaConnection.ts:23`), com paths tags/show/generate. Tags/show enviam metadados, não comentários. O frontend inicia tags ao montar; isso não é envio de planilha. Assets estáticos e tráfego do dev server não devem ser confundidos com Fetch de negócio.

## Vulnerabilidade confirmada versus riscos

**Confirmado no inventário de dependências:** `braces 3.0.3`, via ferramentas ESLint, tem aviso alto no npm (`AUD-01`). As cinco entradas não significam cinco explorações independentes. Não foi demonstrado caminho de exploração por comentário na página; não se deve afirmar que dependência de desenvolvimento é inofensiva.

**Defeito confirmado de privacidade:** dicionário não reconhece equivalência Unicode canônica (`AUD-02`). O dado pode permanecer na coleção enviada ao serviço local. A prova usa texto sintético e Fetch simulado; não houve exfiltração real demonstrada.

**Suspeita fundamentada:** consumo de CPU/memória por descompactação, regex grande, muitas opções e respostas grandes (`AUD-06`). Limites existem, mas não cobrem tudo antes de alocar/processar. Nenhum arquivo malicioso foi usado para derrubar o navegador.

**Recomendações preventivas sem vulnerabilidade confirmada:** avaliar CSP/headers no host estático quando houver publicação; restringir CORS às origens necessárias; fixar origem/versão do modelo; testar corpus de prompt injection; não confiar em máquina/extensões não controladas. A PoC foi examinada em HTTP local; hospedagem HTTPS, rede privada e outros browsers requerem validação própria.

## LGPD: controles técnicos não equivalem a conclusão jurídica

A LGPD considera a possibilidade de reidentificação ao tratar dados anonimizados e exige medidas técnicas e administrativas de proteção. Mascaramento com vínculo preservado ao RAW não demonstra anonimização irreversível nem conformidade integral. Esta revisão não determina base legal, agentes de tratamento ou adequação institucional. [Lei 13.709/2018, arts. 12 e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).

Na aplicação, a separação de versões e o processamento local reduzem superfícies de transmissão e persistência. Permanecem texto livre identificável, reidentificação pelo contexto, exibição intencional de RAW, dicionário manual e processos externos. Os documentos originais devem distinguir redução de risco de garantia absoluta (`AUD-04`).

O responsável institucional precisa definir finalidade e público autorizado, quais dados realmente serão recebidos, política de estação/serviço, revisão humana e procedimento operacional de descarte/incidente. Essas decisões não exigem por si só introduzir banco, login ou coleta de logs contendo comentários.

## Descarte e acesso ao original

`removeFile` remove a referência File e `handleFileSelect(null)` limpa comentários/resultados. O dicionário permanece; a mensagem ampla de privacidade pode induzir interpretação incorreta (`AUD-10`). Fechar/recarregar encerra o estado da página, mas não permite confirmar zeroização de cópias na RAM ou limpeza de contextos internos do Ollama.

O diálogo RAW é requisito, não vazamento acidental: mostra original a quem usa a sessão. Em uma máquina compartilhada, esse acesso precisa de controle operacional. Não existe mecanismo técnico na PoC que isole operadores dentro da mesma sessão.

## O que não foi provado

- Ausência total de vulnerabilidades: audit de produção reportou zero, mas cobre uma base conhecida, não análise completa de bibliotecas.
- Privacidade de toda informação possível: regex não cobre nomes desconhecidos, todos os identificadores, contexto ou equivalências canônicas.
- Procedência do modelo: a tag local e metadados não autenticam os pesos.
- Segurança de implantação pública/HTTPS, extensões, swap, logs de terceiros, permissões do daemon ou ataques de rede.
- Correção factual: um ID existente só prova vínculo, não que a conclusão é sustentada pelo texto.
