# ARQUITETURA DO SISTEMA (PoC UFC)

## 1. Princípio Core: 100% Client-Side e Stateless
* O sistema não possui banco de dados, backend, API Routes, Server Actions ou persistência em disco. Tudo ocorre na memória RAM do navegador cliente[cite: 14].
* O projeto Next.js (React) opera sob Exportação Estática (SSG). O arquivo `next.config.ts` possui `output: "export"`.

## 2. Comunicação com a IA (Ollama Local)
* É proibido o uso de APIs comerciais em nuvem (OpenAI, Gemini).
* O frontend se comunica diretamente com o modelo local (DeepSeek-R1) via `Fetch API` apontada para `http://localhost:11434/api/generate`.
* A inferência exige controle determinístico rígido para mitigar alucinações: o payload obrigatoriamente terá `"temperature": 0.0`.

## 3. Interface em Duas Abas
* **Aba 1 (Sumarização):** Síntese gerada com marcadores numéricos interativos.
* **Aba 2 (Classificação ABSA):** Tabelas e gráficos filtráveis por 5 eixos temáticos (Didática, Infraestrutura, Assiduidade, Relacionamento, Avaliação) e 3 polaridades (Positivo, Negativo, Neutro)[cite: 7, 10].
