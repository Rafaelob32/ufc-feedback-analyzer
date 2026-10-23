# REGRAS DE PRIVACIDADE E LGPD

## 1. Mascaramento de Dados Sensíveis
* O parse da planilha XLS/XLSX (via SheetJS) ocorre offline no navegador.
* Imediatamente após a leitura, uma função de Regex deve mascarar padrões de e-mails, números de matrícula e nomes próprios, substituindo-os pela tag `[DADO SENSÍVEL]`.

## 2. Isolamento de Memória: RAW vs SANITIZED
O estado da aplicação deve manter duas versões dos dados vinculadas por um ID numérico imutável:
* **RAW:** Texto original bruto da planilha. Permanece exclusivamente na RAM local e NUNCA é enviado para a API do Ollama.
* **SANITIZED:** Texto higienizado pelo Regex. Esta é a única versão enviada para a API da IA.

## 3. Auditoria Visual
O resumo gerado pela IA exibirá âncoras (ex: `[3]`). Ao clicar, a interface busca o ID correspondente na memória `RAW` e exibe o comentário original do aluno, garantindo prova de factualidade.
