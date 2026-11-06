# Privacidade, mascaramento e seus limites

## Processamento local

A leitura XLS/XLSX e o mascaramento ocorrem na memória do navegador. Não há
persistência de comentários, backend próprio ou API de nuvem. Somente a coleção
SANITIZED pode ser enviada ao serviço Ollama local, após ação explícita de análise.

Parsing e higienização executam em Workers dedicados locais. A troca de mensagens
entre a página e o Worker cria cópias temporárias de RAW, dicionário e SANITIZED na
RAM do navegador; não envia esses dados para um servidor. O código do Worker é
carregado como asset estático da própria aplicação. Cada Worker é encerrado ao
concluir, falhar, ser cancelado ou atingir 60 segundos. Erros inesperados são
substituídos por mensagens genéricas, sem conteúdo das células.

## Regras determinísticas

`lib/sanitize.ts` substitui por `[DADO SENSÍVEL]`:

- E-mails comuns com local-part dot-atom e domínio ASCII. Não é um reconhecedor universal de endereços ou dados pessoais.
- Blocos numéricos completos de 6 a 7 dígitos (padrão institucional da UFC fixado na interface; `lib/sanitize.ts` preserva suporte programático a faixas configuráveis nos testes). Números como nota 10, tirou 4 e faltou 2 vezes são preservados no padrão. Um número fora do padrão não é presumido matrícula.
- Nomes cadastrados no dicionário, sem diferenciar caixa, com limites Unicode e prioridade para nomes completos. Formas canonicamente equivalentes NFC/NFD são reconhecidas. A comparação não remove acentos: José e Jose continuam diferentes. Variações não cadastradas podem permanecer.

A comparação usa uma representação normalizada temporária; trechos não mascarados
são copiados do original. No remapeamento de offsets NFC/NFD, uma correspondência
parcial de grafema mascara o grafema inteiro para não deixar caracteres quebrados.
Nomes desconhecidos, telefones, endereços, documentos e identificações indiretas
podem escapar. SANITIZED não significa anonimização comprovada. Revise a planilha,
o dicionário e as amostras antes de analisar; a amostra não substitui revisão integral.

## Isolamento e descarte

- RAW preserva texto, linha, aba e ID imutável. Nunca entra no prompt.
- SANITIZED é uma coleção independente contendo apenas `id` e `text`; a sanitização não sobrescreve RAW.
- Remover/trocar a planilha descarta comentários e resultados e cancela leitura, higienização e análise anteriores. Remover preserva nomes e configurações para a próxima importação na mesma página.
- Editar a lista de nomes apaga a versão SANITIZED anterior, cancela a operação anterior e bloqueia análise até concluir a nova higienização. RAW permanece intacto. Em caso de falha, é possível repetir a higienização sem reimportar.
- Recarregar/fechar a página descarta também nomes e configurações. Isso é descarte de referências da aplicação, não uma garantia de apagamento forense da memória do sistema.
- A aplicação não registra textos em logs. Navegador e Ollama são processos externos, cujas extensões, diagnósticos e políticas de retenção exigem avaliação própria.

## Rastreabilidade, exportação e revisão humana

Ao clicar em uma citação, o ID busca o comentário RAW local com sua linha e aba,
sem nova chamada de IA. A existência do ID comprova a ligação ao texto original;
não comprova que a síntese ou classificação está correta. Zod valida estrutura,
não factualidade.

Os botões de exportação no painel de resultados (**Baixar planilha detalhada (.xlsx)**,
**Baixar sumarização (.txt)**, **Baixar dashboard ABSA (.csv)** e **Baixar JSON (.json)**)
geram arquivos localmente no navegador via `Blob` somente mediante clique explícito
do usuário. As funções de formatação (`lib/results.ts`) recebem apenas o `AnalysisResult`
validado e metadados agregados (modelo, contagem/IDs numéricos de comentários e filtros ativos);
**nenhum texto de comentário RAW ou SANITIZED, nome do arquivo ou nome da aba
entra nos arquivos baixados** — apenas os pontos de síntese gerados pela IA,
as classificações ABSA, a matriz cruzada Aspecto × Sentimento, as contagens por
sentimento e os IDs numéricos de referência.

Conformidade com a LGPD depende também de finalidade, base legal,
governança e operação; não é garantida apenas pela arquitetura ou por estes testes.
