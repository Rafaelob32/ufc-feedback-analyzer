# CONTRATO DE INTERFACE COM A IA (OLLAMA I/O)

O **Zod** é a fonte única de verdade para tipagem, validação de runtime e geração de schema estruturado (Structured Outputs). Ele valida a estrutura da resposta; não garante acurácia, cobertura ou factualidade.

## 1. Zod Schema e Validação

```typescript
import { z } from "zod";

export const AnalysisResultSchema = z.object({
  summary: z.array(
    z.object({
      text: z.string(),
      evidenceIds: z.array(z.number().int()).min(1),
    }),
  ),
  absa: z.array(
    z.object({
      commentId: z.number().int(),
      aspects: z.array(
        z.object({
          aspect: z.enum([
            "Didática",
            "Infraestrutura",
            "Assiduidade",
            "Relacionamento",
            "Avaliação",
          ]),
          sentiment: z.enum([
            "Positivo",
            "Negativo",
            "Neutro",
          ]),
        }),
      ).min(1),
    }),
  ),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
```

## 2. Payload Obrigatório (Fetch API)

O Ollama será forçado a respeitar a estrutura usando o JSON Schema gerado dinamicamente a partir do Zod:

```typescript
const payload = {
  model: OLLAMA_MODEL,
  stream: false,
  think: false,
  format: z.toJSONSchema(AnalysisResultSchema, { target: "draft-7" }),
  options: {
    temperature: 0.0,
    num_ctx: 8192,
    num_predict: 2048,
  }
};
```

Desde 27/10/2026, a biblioteca é Zod 4.6.7 e a conversão usa sua API nativa.
`zod-to-json-schema` foi removido: o projeto foi descontinuado e aceita apenas
schemas v3, mesmo quando instalado ao lado do pacote Zod 4. A definição de
`AnalysisResultSchema` acima mantém os mesmos campos, enums, `.min(1)` e descarte
de campos extras; listas externas vazias continuam válidas. No Zod 4, `.int()`
aceita apenas inteiros seguros de JavaScript e o JSON Schema inclui esses limites.
Os IDs físicos da planilha já estão nesse intervalo. Não usar `zod/v3` como
atalho para esconder alertas da implementação antiga.

## 3. Estratégia Anti-thinking

Antes de congelar o ambiente experimental, verificar via `/api/show` se o modelo selecionado suporta `think: false`.

- Se suportado, utilizar obrigatoriamente `think: false` no payload.
- `thinking.values` explícito precisa conter o booleano `false`; strings de níveis ou `"false"` não são equivalentes. Metadados malformados ou valores incompatíveis bloqueiam o envio de comentários.
- Na ausência de `thinking`, executar antes de cada análise uma sonda sintética local: JSON `{ "ok": true }`, `think: false`, temperatura zero, contexto 2048 e até 64 tokens. A sonda não contém comentários, nomes ou IDs do usuário. Exigir resposta completa, JSON esperado e ausência de thinking/tag; caso contrário, falhar sem enviar comentários. O prazo continua 5 minutos e o cancelamento interrompe também a sonda.
- A sonda verifica comportamento observado, não prova universal de ausência de raciocínio interno. Não remover thinking da resposta da sonda para fazê-la passar; a limpeza de fallback abaixo pertence à análise dos comentários.
- Independentemente disso, nenhum conteúdo de `thinking` poderá ser renderizado ou incorporado ao resultado da análise.
- O frontend deve manter a limpeza via Regex (`text.replace(/<think>[\s\S]*?<\/think>/gi, "")`) como camada de defesa de fallback.
- Antes da limpeza, confira linearmente o pareamento de tags. Aberturas/fechamentos incompletos, tags com atributos e blocos aninhados são rejeitados; muitas aberturas sem fechamento não devem provocar buscas repetidas pelo restante do texto. A mesma defesa vale para tags decodificadas dentro de summary.

## 4. Invariantes de Validação (Runtime)

Após a resposta estruturada do Ollama, o frontend executará: `AnalysisResultSchema.parse(JSON.parse(response.response))` para proteger o estado React. Além do schema, validar programaticamente:

- Todo `evidenceId` e `commentId` retornado DEVE existir na lista de IDs originais enviados. Falhar de forma segura em caso de violação.

Na análise em lotes, a validação usa os IDs do próprio lote. O prompt de sistema
solicita JSON compacto em uma única linha, até 3 itens curtos em `summary` por lote
e ausência de repetição de `commentId` e `evidenceIds`. Caso um lote com múltiplos
comentários retorne `done_reason === "length"`, o serviço subdivide automaticamente
o lote ao meio e reprocessa as metades; se um lote de comentário único atingir
`done_reason === "length"`, a análise inteira falha com mensagem controlada.
Só publicar o resultado após todos os lotes serem validados e se a requisição
ainda estiver ativa. O schema acima permanece inalterado: permite listas externas
vazias e descarta campos extras; a interface deve representar ausência de cobertura
sem inventar classificação.

## 5. Limites de recursos antes da validação

Cada resposta HTTP de `/api/tags`, `/api/show` e `/api/generate` é lida com um
limite de **1 MiB (1.048.576 bytes)**. O frontend conta os bytes do corpo, mesmo
sem `Content-Length` ou com um header incorreto; interrompe a leitura ao exceder
o limite. Não usa `response.json()` para acumular um corpo sem limite. UTF-8
inválido, corpo incompleto ou falhas de leitura são rejeitados.

Após JSON.parse e antes do Zod, um percurso iterativo permite até **20.000 nós**
e **32 níveis de profundidade** (raiz no nível zero). Contam-se objetos, arrays
e valores; os nomes de propriedades não são nós adicionais. Esses controles
também se aplicam ao JSON interno de `response` e à sonda de thinking. Resíduos
de thinking continuam sendo removidos apenas no fluxo da análise.

Esses são limites operacionais de recepção, separados da definição do schema
de negócio. Eles não truncam resultados nem adicionam `.max()` ao contrato.
Excesso rejeita a análise inteira com mensagem controlada; uma nova tentativa
é possível. Não são prova de imunidade a toda entrada hostil nem limite total
de memória do navegador. O teto de 2.048 tokens solicitado ao modelo não
substitui a medição do corpo efetivamente recebido.

Referências: [conversão nativa do Zod](https://zod.dev/json-schema),
[migração de inteiros](https://zod.dev/v4/changelog#int-accepts-safe-integers-only)
e [estado do conversor anterior](https://github.com/StefanTerdell/zod-to-json-schema),
consultados em 27/10/2026.

Referência dos controles de thinking: [documentação oficial do Ollama](https://docs.ollama.com/capabilities/thinking), consultada em 23/10/2026.
