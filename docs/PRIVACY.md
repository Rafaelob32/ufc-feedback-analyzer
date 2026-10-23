# Privacidade, mascaramento e seus limites

## Processamento local

A leitura XLS/XLSX e o mascaramento ocorrem na memória do navegador. Não há
persistência de comentários, backend próprio ou API de nuvem. Somente a coleção
SANITIZED pode ser enviada ao serviço Ollama local, após ação explícita de análise.

## Regras determinísticas

`lib/sanitize.ts` substitui por `[DADO SENSÍVEL]`:

- E-mails comuns com local-part dot-atom e domínio ASCII. Não é um reconhecedor universal de endereços ou dados pessoais.
- Blocos numéricos completos de 6 a 7 dígitos por padrão; a interface permite outros comprimentos. Números como nota 10, tirou 4 e faltou 2 vezes são preservados no padrão. Um número fora do padrão não é presumido matrícula.
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
- Remover/trocar a planilha descarta comentários e resultados e cancela a análise anterior. Remover preserva nomes e configurações para a próxima importação na mesma página.
- Recarregar/fechar a página descarta também nomes e configurações. Isso é descarte de referências da aplicação, não uma garantia de apagamento forense da memória do sistema.
- A aplicação não registra textos em logs. Navegador e Ollama são processos externos, cujas extensões, diagnósticos e políticas de retenção exigem avaliação própria.

## Rastreabilidade e revisão humana

Ao clicar em uma citação, o ID busca o comentário RAW local com sua linha e aba,
sem nova chamada de IA. A existência do ID comprova a ligação ao texto original;
não comprova que a síntese ou classificação está correta. Zod valida estrutura,
não factualidade. Conformidade com a LGPD depende também de finalidade, base legal,
governança e operação; não é garantida apenas pela arquitetura ou por estes testes.
