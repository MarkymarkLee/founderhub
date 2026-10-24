import { anthropic } from "@ai-sdk/anthropic";
import type { EmbeddingModelV4 } from "@ai-sdk/provider";
import { RAG } from "@convex-dev/rag";
import { generateObject } from "ai";
import type { z } from "zod";
import { components } from "./_generated/api";

export const claude = anthropic("claude-sonnet-5-5");

// Sonnet 5.5 list price per million tokens; used for the spend meter.
const USD_PER_MTOK = { input: 3, output: 15 };
export function claudeCost(usage: { inputTokens?: number; outputTokens?: number } | undefined) {
  return (
    ((usage?.inputTokens ?? 0) * USD_PER_MTOK.input +
      (usage?.outputTokens ?? 0) * USD_PER_MTOK.output) /
    1e6
  );
}

// Vertex AI gemini-embedding-001 with an API key; the model takes one input per call.
const embeddingModel: EmbeddingModelV4 = {
  specificationVersion: "v4",
  provider: "vertex-ai",
  modelId: "gemini-embedding-001",
  maxEmbeddingsPerCall: 1,
  supportsParallelCalls: true,
  async doEmbed({ values, abortSignal }) {
    const res = await fetch(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-embedding-001:predict?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: values.map((content) => ({ content, task_type: "RETRIEVAL_DOCUMENT" })),
          parameters: { outputDimensionality: 768 },
        }),
        signal: abortSignal,
      },
    );
    if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { predictions: { embeddings: { values: number[] } }[] };
    return { embeddings: json.predictions.map((p) => p.embeddings.values), warnings: [] };
  },
};

export type RagFilters = { sourceType: string; hypothesisId: string };

export const rag = new RAG<RagFilters>(components.rag, {
  textEmbeddingModel: embeddingModel,
  embeddingDimension: 768,
  filterNames: ["sourceType", "hypothesisId"],
});

export const GUARDRAIL =
  "If an action could be illegal, deceptive, or against a site's terms, do not do it; log it as skipped with a reason.";

/** One structured Claude call. Returns the parsed object and its cost in USD. */
export async function askClaude<T>(system: string, prompt: string, schema: z.ZodType<T>) {
  const { object, usage } = await generateObject({ model: claude, system, prompt, schema });
  return { object, costUsd: claudeCost(usage) };
}
