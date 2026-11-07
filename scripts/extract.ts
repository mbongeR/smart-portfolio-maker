import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { readFile } from "node:fs/promises";
import { ExtractionSchema, type Extraction, type PortfolioConfig } from "./schema";
import { z } from "zod";

const RawExtractionSchema = z.object({}).passthrough();

export async function extractProject(input: {
  config: PortfolioConfig;
  repositoryMetadata: unknown;
  detectedStack: string[];
  readme: string;
}): Promise<Extraction> {
  const template = await readFile(input.config.llm.prompt_file, "utf8");
  const prompt = template
    .replace("{{repository_metadata}}", JSON.stringify(input.repositoryMetadata, null, 2))
    .replace("{{detected_stack}}", input.detectedStack.join(", "))
    .replace("{{readme}}", input.readme)
    .concat(input.config.output_language
      ? `\n\nWrite the output in ${input.config.output_language}.`
      : "\n\nWrite the output in English unless the configuration specifies another output language.");
  const model = createModel(input.config);
  const result = await generateObject({ model, schema: RawExtractionSchema, prompt });
  return normalizeExtraction(result.object, input);
}

function normalizeExtraction(raw: Record<string, unknown>, input: {
  repositoryMetadata: unknown;
  detectedStack: string[];
  readme: string;
}): Extraction {
  const metadata = isRecord(input.repositoryMetadata) ? input.repositoryMetadata : {};
  const title = firstText(raw.title, raw.name, raw.project_name, metadata.name) ?? "Untitled project";
  const oneLiner = firstText(raw.one_liner, raw.summary, raw.description, metadata.description, firstReadmeLine(input.readme)) ?? "A project described by the available repository evidence.";
  const problem = firstText(raw.problem, raw.purpose, raw.challenge, oneLiner);
  const approach = firstText(raw.approach, raw.solution, raw.implementation, oneLiner);
  const stack = firstArray(raw.stack, raw.technologies, raw.tech_stack, raw.languages);
  const highlights = firstArray(raw.highlights, raw.features, raw.key_features);
  const demoUrl = firstUrl(raw.demo_url, raw.demoUrl, raw.live_url);

  return ExtractionSchema.parse({
    title,
    one_liner: oneLiner.slice(0, 240),
    problem,
    approach,
    stack: stack.length > 0 ? stack : input.detectedStack,
    highlights,
    demo_url: demoUrl,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstText(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

function firstArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
      if (items.length > 0) return items;
    }
  }
  return [];
}

function firstUrl(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    try {
      return new URL(value).toString();
    } catch {
      continue;
    }
  }
  return null;
}

function firstReadmeLine(readme: string): string | undefined {
  return readme.split(/\r?\n/).map((line) => line.replace(/^#+\s*/, "").trim()).find((line) => line.length > 0);
}

function createModel(config: PortfolioConfig) {
  if (config.llm.provider === "gemini") {
    const google = createGoogleGenerativeAI();
    return google(config.llm.model);
  }
  if (config.llm.provider === "openai") {
    const openai = createOpenAI({ baseURL: config.llm.base_url });
    return openai(config.llm.model);
  }
  if (config.llm.provider === "groq") {
    const groq = createOpenAICompatible({
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      baseURL: config.llm.base_url ?? "https://api.groq.com/openai/v1",
    });
    return groq(config.llm.model);
  }
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: config.llm.base_url ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  });
  return ollama(config.llm.model);
}
