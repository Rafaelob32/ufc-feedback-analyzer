# CONTRATO DE INTERFACE COM A IA (OLLAMA I/O)

A confiabilidade do sistema é garantida pelo uso do **Zod** como fonte única de verdade (Single Source of Truth) para tipagem, validação de runtime e geração de schema estruturado (Structured Outputs).

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
  format: zodToJsonSchema(AnalysisResultSchema),
  options: {
    temperature: 0.0,
  }
};
```

## 3. Estratégia Anti-thinking

Antes de congelar o ambiente experimental, verificar via `/api/show` se o modelo selecionado suporta `think: false`.

- Se suportado, utilizar obrigatoriamente `think: false` no payload.
- Independentemente disso, nenhum conteúdo de `thinking` poderá ser renderizado ou incorporado ao resultado da análise.
- O frontend deve manter a limpeza via Regex (`text.replace(/<think>[\s\S]*?<\/think>/gi, "")`) como camada de defesa de fallback.

## 4. Invariantes de Validação (Runtime)

Após a resposta estruturada do Ollama, o frontend executará: `AnalysisResultSchema.parse(JSON.parse(response.response))` para proteger o estado React. Além do schema, validar programaticamente:

- Todo `evidenceId` e `commentId` retornado DEVE existir na lista de IDs originais enviados. Falhar de forma segura em caso de violação.
