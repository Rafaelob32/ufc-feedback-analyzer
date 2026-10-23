# ARQUITETURA DO SISTEMA (PoC UFC)

## 1. Princípio Core: 100% Client-Side e Stateless
* A aplicação não possui banco de dados, backend próprio, API Routes, Server Actions ou persistência dos comentários. O processamento e o estado de sessão ficam na memória do navegador.
* O projeto Next.js (React) opera sob Exportação Estática (SSG). O arquivo `next.config.ts` possui `output: "export"`.

## 2. Comunicação com a IA (Ollama Local)
* É proibido o uso de APIs comerciais em nuvem (OpenAI, Gemini).
* O frontend se comunica diretamente com o modelo local (DeepSeek-R1) via `Fetch API` apontada para `http://localhost:11434/api/generate`.
* O payload obrigatoriamente terá `"temperature": 0.0`, `think: false`, `stream: false` e JSON Schema gerado do Zod. Temperatura zero reduz variação; não garante determinismo entre ambientes nem correção semântica.
* `/api/tags` lista modelos locais e `/api/show` verifica capacidades e valores de thinking. Sem metadados explícitos, uma sonda sintética valida o comportamento observado antes de enviar SANITIZED. Essa verificação pode adicionar uma requisição de geração e não é prova universal do comportamento futuro do modelo.

## 3. Interface em Duas Abas
* **Aba 1 (Sumarização):** Síntese gerada com marcadores numéricos interativos.
* **Aba 2 (Classificação ABSA):** Tabelas e gráficos filtráveis por 5 eixos temáticos (Didática, Infraestrutura, Assiduidade, Relacionamento, Avaliação) e 3 polaridades (Positivo, Negativo, Neutro).

## 4. Validação e ferramentas de desenvolvimento

Os serviços têm testes unitários com Fetch simulado. Playwright, somente no
desenvolvimento, testa a interface em Chromium desktop/mobile contra `out/`
servido por HTTP estático na porta 4173. Esse servidor de arquivos é infraestrutura
do teste, não backend da aplicação. A suíte intercepta a origem do Ollama e usa
somente planilhas sintéticas. Testes reais do modelo são registrados separadamente.

A comparação RAW/SANITIZED pagina as opções em grupos de 100 e permite localizar
diretamente o ID original. Nenhuma paginação renumera IDs ou trunca coleções.
O segmentador Unicode é reutilizado dentro de cada chamada de sanitização e criado
somente se necessário; não existe cache de comentários entre chamadas.

`scripts/evaluate-absa.mjs` é um utilitário offline de desenvolvimento que recebe
arquivos explícitos e imprime métricas no terminal. Ele não integra o bundle,
não é backend da aplicação e não adiciona persistência ao fluxo do navegador.
