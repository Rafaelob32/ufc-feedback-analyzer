# Protocolo proposto para avaliação do TCC

Preparado em 23/10/2026. Este protocolo não é um resultado experimental nem um
critério de aprovação já aceito pelo orientador.

## Antes de medir

1. Definir a população: docentes/discentes juntos ou separados, disciplinas e período. O parser atual inclui ambos e não muda essa decisão automaticamente.
2. Escolher um conjunto sintético ou dados com autorização e regras de acesso definidas. A fixture de três comentários serve para integração, não para estimar qualidade do modelo.
3. Fazer anotação humana de referência dos pares aspecto/sentimento e das evidências admissíveis por síntese. Cobrir os cinco aspectos, três sentimentos, múltiplos aspectos, comentários vazios/sem aspecto e instruções maliciosas dentro do texto. Registrar desacordos e sua resolução; não usar a própria saída da IA como verdade de referência.
4. Definir antes da execução os limites aceitáveis de omissões, citações sem suporte e erros por classe. Os números dependem do objetivo do estudo e não foram escolhidos pelo agente.

## Manifesto de cada execução

Registrar commit Git, checksum do corpus autorizado, regras/dicionário de
sanitização, versão do Ollama (`/api/version`), nome **e digest** (`/api/tags`),
família/quantização/capacidades/`thinking.values` (`/api/show`), resultado da sonda,
navegador, sistema, CPU/GPU/RAM e se o modelo estava carregado.

Registrar também o schema e prompt versionados em `lib/schema.ts` e `lib/ollama.ts`,
temperatura 0, thinking false, contexto 8192, saída 2048, limites de 8 comentários /
3000 caracteres serializados por lote e prazo de 5 minutos. A sonda tem limites
próprios descritos em AI_CONTRACT. Conferir o digest antes/depois e invalidar uma
execução se o modelo mudar. O alias `latest` sozinho não congela o ambiente.

O registro de manutenção contém um snapshot real de metadados. Ele não obriga o
estudo a adotar esse modelo nem implica que a qualidade foi avaliada. Não adicionar
telemetria ou persistência automática à aplicação para construir o manifesto.

## Medidas e limitações

- ABSA: precisão, revocação e F1 por aspecto/sentimento, cobertura e matriz de erros; reportar também classes raras, saídas vazias e falhas de contrato.
- Síntese: revisão humana de cada afirmação e seus IDs, separando ID existente de evidência que realmente sustenta a afirmação; registrar omissões e repetições entre lotes.
- Privacidade: falsos negativos/positivos de mascaramento no corpus de referência. Incluir nomes desconhecidos, NFC/NFD, formatos não cobertos e números comuns. Não extrapolar para anonimização universal.
- Operação: tempo de importação, sanitização, inferência fria/quente, pico de memória e responsividade. Medir volumes graduais e interromper se a interface ficar impraticável; não assumir que os limites máximos atuais já foram homologados.
- Repetibilidade: repetir execuções com ambiente congelado e registrar divergências mesmo com temperatura zero. Descrever amostra pequena, viés de seleção e dependência do hardware.

Resultados devem incluir casos de falha e itens não medidos. Comentários reais,
dicionários pessoais, respostas brutas e traces não devem ser adicionados ao Git.
