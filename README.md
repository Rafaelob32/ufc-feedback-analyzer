# Avalia · PoC UFC

Aplicação estática para analisar avaliações institucionais no navegador:
importação Excel → RAW imutável → SANITIZED → Ollama local → sumário rastreável e ABSA.

## Executar

Requer Node.js 24 e npm. Na pasta deste arquivo:

    npm ci
    npm run dev -- --hostname 127.0.0.1 --port 3000

Mantenha esse terminal aberto e acesse http://localhost:3000.
Se aparecer “conexão recusada”, confirme que o processo está ativo e a porta 3000
está livre. O servidor de desenvolvimento não inicia automaticamente após reiniciar
o computador. A aplicação exportada não depende desse servidor Next.

Em outro terminal, caso o Ollama ainda não esteja em execução:

    OLLAMA_ORIGINS="http://localhost:3000,http://127.0.0.1:3000" ollama serve

Instale o modelo local com: ollama pull deepseek-r1.
Se o Ollama já roda como serviço, configure OLLAMA_ORIGINS no ambiente desse serviço;
não abra outra instância na mesma porta. Não é necessário expor a porta 11434 à rede.

O menu consulta /api/tags e lista variantes locais do DeepSeek-R1. Antes da
inferência, /api/show verifica as capacidades do modelo e rejeita aliases
remotos. O payload usa think: false, temperatura zero e JSON Schema gerado
do Zod. Uma falha em qualquer lote descarta o resultado parcial.

## Usar

1. Selecione uma planilha .xls ou .xlsx.
2. Confira os comentários importados e a comparação RAW/SANITIZED.
3. Informe nomes conhecidos (um por linha) e ajuste o tamanho das matrículas.
4. Escolha o modelo local e clique em **Analisar com IA**.
5. Consulte o **Sumário rastreável** ou **Dashboard ABSA**. Clique em [ID]
   para abrir o texto original com linha e aba da planilha.
6. Remova a planilha para descartar comentários e resultados. Recarregar ou
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
- Regex e dicionário reconhecem os padrões configurados; **não garantem remoção
  de todo dado pessoal nem conformidade jurídica automática**. Revise antes de
  analisar. Nomes desconhecidos e formatos diferentes podem permanecer.
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
privacidade, contratos, filtros e limites. Integrações reais e revisão visual devem
ser registradas separadamente em [docs/VALIDATION.md](docs/VALIDATION.md).

## Dependências

Nenhuma biblioteca adicional foi necessária para o dashboard: React, CSS e
JavaScript nativo implementam gráfico, filtros e diálogo. O schema Zod permanece
exatamente como definido em docs/AI_CONTRACT.md.

Na revisão de 19/10/2026, o audit sem dependências de desenvolvimento não apontou
vulnerabilidades. O audit completo apontou cinco entradas de severidade alta na cadeia
eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces.
A [advisoria GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
não informa versão corrigida de braces. Não foi aplicado npm audit fix --force,
pois a sugestão regride o eslint-config-next para a versão 14. A pendência continua
aberta e deve ser reavaliada quando houver correção compatível.
