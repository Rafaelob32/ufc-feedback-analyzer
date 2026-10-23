import { z } from "zod";

// Fonte do contrato: docs/AI_CONTRACT.md. Não acrescentar campos ou restrições aqui.
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
