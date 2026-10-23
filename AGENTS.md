# CONTRATO DE COMPORTAMENTO PARA O AGENTE CÓDIGO (AI CODER)

1. **Proibição de Backend:** Você está estritamente proibido de instalar ORMs (Prisma), criar instâncias de banco de dados (PostgreSQL, Firebase) ou criar rotas em `/app/api`.
2. **Formato de Resposta Exigido:** Toda instrução para o Ollama deve exigir um retorno estrito em formato JSON estruturado.
3. **Fidelidade de IDs:** Você não pode programar a IA para inventar IDs de comentários. Os `evidenceIds` retornados pelo Ollama devem ser mapeamentos reais dos IDs enviados no payload.
4. **Tratamento da Tag <think>:** Como utilizamos o modelo DeepSeek-R1, você deve implementar uma função Regex/Split no frontend que remova e oculte a tag `<think>...</think>` antes de renderizar a resposta ao usuário final.
5. **Checagem de Segurança:** Todo código gerado deve ser compatível com o comando `npm run build` do Next.js configurado como Exportação Estática.
