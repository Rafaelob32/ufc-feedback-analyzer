# Avaliação ABSA fora da aplicação

Ferramenta de desenvolvimento, sem rede e sem dependências novas. Não é importada
pelo frontend, não captura o estado React e não altera o contrato de análise.
Ela lê dois arquivos fornecidos explicitamente e imprime métricas e hashes SHA-256
no terminal. A aplicação continua sem persistência dos comentários.

## Referência humana

`tests/fixtures/absa-draft.json` contém **20 exemplos sintéticos e rótulos propostos
pelo agente de IA**, cobrindo as 15 combinações de aspecto/sentimento, múltiplos
aspectos, sentimentos opostos, comando adversarial, ausência de aspecto e Unicode.
O arquivo tem `status: "draft"` e `review: null`: não é gabarito científico.

Antes de pontuar uma execução, uma pessoa deve revisar os textos, os rótulos,
as notas sobre ambiguidades e as convenções do estudo. Trabalhe em uma cópia
separada, preserve a proveniência e registre nela:

- `status: "human-reviewed"`;
- `review.reviewer`: identificador real do revisor;
- `review.date`: data da revisão em `AAAA-MM-DD`;
- `expectedAspects`: pares revisados de aspecto/sentimento por ID.

Esses metadados são uma declaração de revisão, não autenticação ou prova de que
ela aconteceu. O agente não deve preenchê-los alegando revisão humana nem alterar
rótulos para aproximá-los da saída do modelo. O rascunho versionado permanece draft.
Não misture corpus de desenvolvimento com avaliação final sem descrever o viés.

## Comando

Após uma execução experimental, forneça um JSON no formato `AnalysisResult`
(`summary` e `absa`, conforme AI_CONTRACT), não o envelope `response` do Ollama:

```bash
npm run evaluate:absa -- /tmp/referencia-revisada.json /tmp/resultado.json
```

O comando não executa inferência nem extrai resultados automaticamente da interface.
Ele exige uma referência revisada, IDs únicos e pares não duplicados na referência.
Valida o retorno com o Zod original e rejeita IDs inexistentes tanto no ABSA quanto
nas evidências de summary. Erros não imprimem os textos dos arquivos.

Para salvar somente o JSON do relatório, sem o cabeçalho do npm:

```bash
npm run --silent evaluate:absa -- /tmp/referencia-revisada.json /tmp/resultado.json > /tmp/metricas.json
```

Não versione comentários institucionais ou respostas brutas. Registre o manifesto
experimental definido em [EXPERIMENT_PROTOCOL](EXPERIMENT_PROTOCOL.md); hashes
permitem identificar os arquivos utilizados sem incluir seu conteúdo no relatório.

## Interpretação das métricas

- A unidade é a tripla única `(commentId, aspect, sentiment)`. Repetições da IA são deduplicadas. TP é uma tripla presente nos dois conjuntos, FP somente na previsão e FN somente na referência.
- Micro agrega TP/FP/FN antes de calcular precisão, revocação e F1. Por rótulo, o relatório apresenta as mesmas contagens para cada uma das 15 combinações; support é sua frequência de referência.
- Macro F1 é a média dos F1 definidos, incluindo combinações presentes apenas na previsão. Combinações ausentes nos dois conjuntos ficam com F1 null e não entram nessa média. Declare essa convenção ao comparar trabalhos.
- Denominador zero produz null, não pontuação perfeita. Saída vazia com rótulos esperados tem revocação/F1 zero; precisão indefinida. Referência e previsão sem rótulos têm F1 indefinido.
- `exactMatchRate` exige que o conjunto completo de pares de um comentário coincida. Comentário cuja referência e previsão são vazias é um acerto exato, mas não evidencia capacidade de classificação; interpretar junto com suporte e cobertura.
- `classificationCoverage` é a fração de comentários com algum ABSA retornado. Não é acurácia e pode ser legitimamente menor que 1 para comentários sem aspecto.
- `summaryItemsRequiringHumanReview` conta itens de síntese; não os aprova. ID existente não demonstra que o texto citado sustenta a afirmação.

Os testes matemáticos e o smoke test do CLI usam referências fictícias declaradas
como fixtures técnicas. Eles validam o programa, não constituem uma revisão humana
dos 20 exemplos nem uma medição de qualidade do modelo.
