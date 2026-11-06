# Avalia · PoC UFC

Aplicação estática para analisar avaliações institucionais no navegador:
importação Excel → RAW imutável → SANITIZED → Ollama local → sumário rastreável e ABSA.

## Documentação técnica

- [Arquitetura do sistema](docs/ARCHITECTURE.md): execução 100% client-side, Web Workers, comunicação com Ollama local e exportação estática.
- [Privacidade e mascaramento](docs/PRIVACY.md): regras determinísticas de higienização 
- [Contrato de interface com a IA](docs/AI_CONTRACT.md): schema Zod 4, controle de `thinking`, limites de recepção JSON e invariantes de validação de IDs.
- [Avaliação ABSA offline](docs/EVALUATION.md) e [Protocolo experimental](docs/EXPERIMENT_PROTOCOL.md): ferramentas e diretrizes para aferição de métricas no TCC.

## Executar

Ambiente testado: Node.js 24.14.0 (também em `.nvmrc`), npm 11.9.0 e Python 3
para servir o export nos testes. `package.json` declara as linhas Node 24/npm 11.
Essas versões registram o ambiente verificado, não uma promessa de serem as mais recentes.
Na pasta deste arquivo:

    npm ci
    npm run dev -- --hostname 127.0.0.1 --port 3000

Mantenha esse terminal aberto e acesse http://localhost:3000.
Se aparecer “conexão recusada”, confirme que o processo está ativo e a porta 3000
está livre. O servidor de desenvolvimento não inicia automaticamente após reiniciar
o computador. A aplicação exportada não depende desse servidor Next.

Em outro terminal, caso o Ollama ainda não esteja em execução:

    OLLAMA_ORIGINS="http://localhost:3000,http://127.0.0.1:3000" ollama serve

Instale um modelo local compatível com: `ollama pull deepseek-r1` ou `ollama pull llama3.1`.
Se o Ollama já roda como serviço, configure OLLAMA_ORIGINS no ambiente desse serviço;
não abra outra instância na mesma porta. Não é necessário expor a porta 11434 à rede.

O menu consulta /api/tags e lista variantes locais do DeepSeek-R1 e do Llama 3.1. Antes da
inferência, /api/show verifica capacidades e `thinking.values` e rejeita aliases
remotos. Se os metadados de thinking estiverem ausentes, uma sonda JSON sintética
sem comentários testa o comportamento observado; falha nessa etapa bloqueia a análise.
O payload usa think: false, temperatura zero e JSON Schema gerado
do Zod. Se um lote com múltiplos comentários atingir o limite de tokens de saída (`done_reason: "length"`), ele é subdividido automaticamente ao meio; uma falha definitiva em qualquer lote descarta o resultado parcial.

## Usar

1. Selecione uma planilha .xls ou .xlsx.
2. Confira os comentários importados e a comparação RAW/SANITIZED.
   Com mais de 100 comentários, use a paginação ou **Ir para o ID original**;
   todos permanecem acessíveis e seus IDs não são renumerados.
3. Informe nomes conhecidos (um por linha); e-mails e matrículas institucionais
   (6 a 7 dígitos, padrão UFC) já são mascarados automaticamente.
   Aguarde **Higienizando comentários** terminar e revise a versão mascarada.
   Durante esse processamento a análise fica indisponível. Em caso de falha,
   use **Tentar higienizar novamente**; o RAW permanece na memória.
4. Escolha o modelo local (`deepseek-r1` ou `llama3.1`) e clique em **Analisar com IA**.
5. Consulte o **Sumário rastreável** ou **Dashboard ABSA**. Clique em [ID]
   para abrir o texto original com linha e aba da planilha. Use os botões de
   exportação no topo dos resultados (**Baixar planilha detalhada (.xlsx)**,
   **Baixar sumarização (.txt)**, **Baixar dashboard ABSA (.csv)** ou
   **Baixar JSON (.json)**) para salvar os resultados gerados pela IA no seu
   computador (apenas sínteses, classificações, matrizes e IDs numéricos são
   exportados, nunca os textos dos comentários RAW/SANITIZED).
6. Remova a planilha para cancelar o processamento e descartar comentários e resultados. Recarregar ou
   fechar a página também descarta as configurações mantidas em memória.

São aceitos a primeira aba do relatório de questões abertas SIGAA/UFC, incluindo
respostas de docentes e discentes, ou tabelas com Comentário/Comentários na
primeira linha preenchida. Metadados e avisos de ausência do relatório SIGAA não
são comentários. IDs correspondem às linhas físicas, inclusive quando há lacunas.

Os gráficos contam classificações únicas por comentário, aspecto e sentimento,
respeitando os filtros. Um comentário pode conter vários aspectos ou sentimentos.
A interface informa quantos comentários não receberam classificação; não confunde
ausência de classificação com sentimento neutro.

## Limites e privacidade

- Não há backend, API Routes, Server Actions, banco, autenticação, cookies de
  aplicação, armazenamento local ou IndexedDB. Os únicos Fetch da aplicação são
  destinados ao Ollama em http://localhost:11434.
- RAW nunca entra no payload. SANITIZED contém apenas id e text.
  A interface exibe textos como texto React, sem executar HTML da planilha/IA.
- Leitura e higienização usam Web Workers nativos, carregados como assets estáticos
  da própria aplicação. São operações locais com cópias temporárias em RAM, sem
  rede de dados ou persistência. Cada operação é encerrada ao concluir, falhar,
  ser cancelada ou atingir 60 segundos. O navegador precisa permitir Workers;
  não existe fallback que execute o processamento pesado na interface.
- Regex e dicionário reconhecem os padrões configurados; **não garantem remoção
  de todo dado pessoal nem conformidade jurídica automática**. Revise antes de
  analisar. Nomes desconhecidos e formatos diferentes podem permanecer.
  Nomes equivalentes em Unicode NFC/NFD são reconhecidos sem alterar o RAW ou
  normalizar os trechos não mascarados; isso não equivale a remover acentos.
- A aplicação não persiste comentários. O serviço Ollama e o navegador são
  processos externos: configuração de logs, extensões e coleta diagnóstica desses
  ambientes devem ser avaliadas separadamente.
- Importação limitada a 10 MB; a primeira aba deve caber nas primeiras 50.000
  linhas e 256 colunas, com intervalo de até 500.000 posições de células. Esses
  limites reduzem consumo acidental; não tornam qualquer arquivo hostil seguro.
- Lotes têm até 8 comentários e 3.000 caracteres de JSON de entrada.
  Um comentário que sozinho exceda o limite é rejeitado, sem truncamento.
  A inferência usa contexto de 8.192 tokens, até 2.048 tokens de saída e prazo de
  5 minutos por lote. Se ocorrer timeout ou truncamento, nenhum resultado parcial
  é mostrado como sucesso.
- As respostas HTTP do Ollama têm limite de 1 MiB; os JSONs recebidos, inclusive
  o conteúdo interno da análise, têm limite de 20.000 nós e profundidade 32 antes
  do Zod. Respostas excessivas são rejeitadas com erro e permitem nova tentativa;
  não são truncadas para caber no contrato. Esses limites são operacionais,
  distintos dos limites de importação e da avaliação offline.
- O sumário reúne pontos dos lotes; não executa uma segunda sumarização global.
  Assuntos semelhantes podem aparecer mais de uma vez. Os IDs asseguram
  rastreabilidade, não a correção semântica da classificação feita pelo modelo.
- Temperatura zero reduz variação, mas não prova ausência de alucinações.
  A conferência humana das evidências continua necessária.

## Verificação e exportação

    npm test
    npm run lint
    npm run build
    npm audit
    npm audit --omit=dev

O build gera a pasta out/. Para conferir o artefato sem um servidor Next:

    python3 -m http.server 3000 --bind 127.0.0.1 --directory out

Pare o servidor de desenvolvimento antes de usar a mesma porta.
A hospedagem apenas entrega arquivos estáticos. O Ollama continua rodando na
máquina que abre o navegador e precisa permitir a origem usada. Esta PoC foi
verificada em HTTP local; uma hospedagem HTTPS pode sofrer restrições de acesso
à rede local/conteúdo misto do navegador.

Os testes usam planilhas sintéticas e respostas simuladas para falhas, cancelamento,
privacidade, contratos, filtros e limites.

Para testar a interface desktop/mobile contra o export recém-gerado:

    npx playwright install chromium
    npm run build
    npm run test:e2e

Playwright inicia um servidor de arquivos na porta 4173, intercepta as chamadas ao
Ollama e usa somente a fixture sintética. Não é necessário um modelo real para esta
suíte. As falhas podem gerar traces em `test-results/`, ignorados pelo Git. Não use
planilhas institucionais nesses testes. No Fedora, o Playwright baixa um build de
Chromium destinado ao Ubuntu; a execução verificada está documentada, mas isso não
torna o Fedora uma plataforma oficialmente suportada pelo fornecedor.

Ensaios opcionais de capacidade, após gerar `out/`:

    npm run test:capacity
    CAPACITY_MAX=50000 npm run test:capacity

A primeira opção mede 100, 1.000 e 10.000 comentários; a segunda inclui 49.999
mais o cabeçalho. Gera dados sintéticos na memória, não faz inferência e imprime
tempos/contagens. Os números dependem do ambiente; não são limites universais de desempenho.
E2E e capacidade usam a mesma porta 4173 e devem rodar sequencialmente.

Para preparar a avaliação do TCC, há um [avaliador ABSA offline](docs/EVALUATION.md)
e 20 exemplos sintéticos em estado draft. A pontuação exige uma referência com
revisão humana registrada; não foi medida acurácia científica do modelo nesta etapa.

## Dependências

Nenhuma biblioteca adicional foi necessária para o dashboard: React, CSS e
JavaScript nativo implementam gráfico, filtros e diálogo. Zod 4.6.7 valida o
contrato e gera JSON Schema nativamente; o conversor anterior foi removido.
Campos, enums e regras do schema permanecem em docs/AI_CONTRACT.md.

Playwright foi adicionado somente ao desenvolvimento para exercitar o fluxo real
dos componentes, cancelamento, descarte, rastreabilidade e layouts desktop/mobile.
Não entra no bundle de produção.

Em 27/10/2026, `npm audit` e `npm audit --omit=dev` retornaram zero avisos
conhecidos após a atualização do Zod. A
[advisoria GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
foi retirada pela base oficial; isso não foi uma correção de `braces` no código
do projeto. O novo aviso do Zod e sua resolução estão no relatório de segurança.
Não foi usado `audit fix --force`, override de peers ou downgrade do Next.

O ESLint 9.39.5 também está fora de suporte. A tentativa com ESLint 10.13.0 passou
no lint, mas os plugins transitivos import/jsx-a11y/react ainda declaram apenas
até ESLint 9; a migração foi revertida para preservar uma instalação compatível.
A atualização coordenada dessa cadeia continua pendente.
