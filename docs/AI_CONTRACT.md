# CONTRATO DE INTERFACE COM A IA (OLLAMA I/O)

O **Zod** é a fonte única de verdade para tipagem, validação de runtime e geração de schema estruturado (Structured Outputs). Ele valida a estrutura da resposta; não garante acurácia, cobertura ou factualidade.

## 1. Zod Schema e Validação

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

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
  format: zodToJsonSchema(AnalysisResultSchema),
  options: {
    temperature: 0.0,
    num_ctx: 8192,
    num_predict: 2048,
  }
};
```

## 3. Estratégia Anti-thinking

Antes de congelar o ambiente experimental, verificar via `/api/show` se o modelo selecionado suporta `think: false`.

- Se suportado, utilizar obrigatoriamente `think: false` no payload.
- `thinking.values` explícito precisa conter o booleano `false`; strings de níveis ou `"false"` não são equivalentes. Metadados malformados ou valores incompatíveis bloqueiam o envio de comentários.
- Na ausência de `thinking`, executar antes de cada análise uma sonda sintética local: JSON `{ "ok": true }`, `think: false`, temperatura zero, contexto 2048 e até 64 tokens. A sonda não contém comentários, nomes ou IDs do usuário. Exigir resposta completa, JSON esperado e ausência de thinking/tag; caso contrário, falhar sem enviar comentários. O prazo continua 5 minutos e o cancelamento interrompe também a sonda.
- A sonda verifica comportamento observado, não prova universal de ausência de raciocínio interno. Não remover thinking da resposta da sonda para fazê-la passar; a limpeza de fallback abaixo pertence à análise dos comentários.
- Independentemente disso, nenhum conteúdo de `thinking` poderá ser renderizado ou incorporado ao resultado da análise.
- O frontend deve manter a limpeza via Regex (`text.replace(/<think>[\s\S]*?<\/think>/gi, "")`) como camada de defesa de fallback.

## 4. Invariantes de Validação (Runtime)

Após a resposta estruturada do Ollama, o frontend executará: `AnalysisResultSchema.parse(JSON.parse(response.response))` para proteger o estado React. Além do schema, validar programaticamente:

- Todo `evidenceId` e `commentId` retornado DEVE existir na lista de IDs originais enviados. Falhar de forma segura em caso de violação.

Na análise em lotes, a validação usa os IDs do próprio lote. Só publicar o resultado
após todos os lotes serem validados e se a requisição ainda estiver ativa. O schema
acima permanece inalterado: permite listas externas vazias e descarta campos extras;
a interface deve representar ausência de cobertura sem inventar classificação.

Referência dos controles de thinking: [documentação oficial do Ollama](https://docs.ollama.com/capabilities/thinking), consultada em 23/10/2026.
