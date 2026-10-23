# CONTRATO DE COMPORTAMENTO PARA O AGENTE CÓDIGO (AI CODER)

1. **Proibição de Backend:** Você está estritamente proibido de instalar ORMs (Prisma), criar instâncias de banco de dados (PostgreSQL, Firebase) ou criar rotas em `/app/api`.
2. **Formato de Resposta Exigido:** Toda instrução para o Ollama deve exigir um retorno estrito em formato JSON estruturado.
3. **Fidelidade de IDs:** Você não pode programar a IA para inventar IDs de comentários. Os `evidenceIds` retornados pelo Ollama devem ser mapeamentos reais dos IDs enviados no payload.
4. **Tratamento da Tag <think>:** Como utilizamos o modelo DeepSeek-R1, você deve implementar uma função Regex/Split no frontend que remova e oculte a tag `<think>...</think>` antes de renderizar a resposta ao usuário final.
5. **Checagem de Segurança:** Todo código gerado deve ser compatível com o comando `npm run build` do Next.js configurado como Exportação Estática.

## Regras de manutenção

- Leia `PLAN.md`, `docs/ARCHITECTURE.md`, `docs/PRIVACY.md` e `docs/AI_CONTRACT.md` antes de alterar o fluxo. O schema Zod aprovado não deve ser redesenhado sem instrução explícita do responsável.
- Preserve a aplicação client-side e efêmera: sem Server Actions, persistência de comentários, SDK de nuvem ou serviços de backend próprios. Os Fetch de produção apontam exclusivamente para o Ollama local.
- RAW, seus IDs e os trechos não mascarados devem permanecer intactos. A equivalência Unicode NFC/NFD serve para comparação, sem normalizar o RAW. SANITIZED contém somente `id` e `text`.
- Antes de enviar comentários, verifique `thinking.values` em `/api/show`. Valores explícitos sem `false` bloqueiam a análise. Metadados ausentes exigem uma sonda JSON sintética sem dados do usuário. Falha da sonda impede o envio de comentários; não exponha sua resposta/thinking em erros ou logs.
- Toda análise usa `think: false`, `stream: false`, temperatura zero, JSON Schema e validação dos IDs de cada lote. Cancelamento ou alteração de entrada deve invalidar respostas pendentes e resultados anteriores.
- Não prometa anonimização completa, conformidade jurídica automática ou acurácia por causa de Zod/IDs/temperatura zero. Descreva limitações e necessidade de revisão humana.
- **Mantenha documentação e instruções para IA atualizadas junto com o código.** Atualize README, contratos afetados, PLAN/NEXT_STEPS e registre comandos/resultados em um relatório datado. Preserve auditorias anteriores como evidências históricas, com links para as resoluções.
- Para correções, inclua regressões pertinentes e execute `npm test`, `npm run lint`, `npm run build`. Para mudanças de fluxo/UI, execute também `npm run test:e2e` após gerar `out/`. Registre falhas ou verificações não executadas; não declare sucesso por existir uma pasta `out/` de um build anterior.
- Testes E2E usam somente fixtures sintéticas, interceptam o Ollama e servem `out/` em porta separada. Não envie relatórios institucionais para testes reais sem autorização específica; não versione traces, dados pessoais, `.env`, caches ou artefatos gerados.
- Explique novas dependências antes de adicionar; atualize lockfile e reavalie `npm audit`/`npm audit --omit=dev`. Não use `audit fix --force` nem oculte alertas para obter um build verde.
- Runtime de referência em `.nvmrc` e `package.json`. Use `npm ci` para reproduzir a instalação. Revise o diff e selecione explicitamente os arquivos ao preparar commits; não publique remotamente sem solicitação.
