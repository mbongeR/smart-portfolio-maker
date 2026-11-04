import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { readFile } from "node:fs/promises";
import { ExtractionSchema, type Extraction, type PortfolioConfig } from "./schema";

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
  const result = await generateObject({ model, schema: ExtractionSchema, prompt });
  return ExtractionSchema.parse(result.object);
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
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: config.llm.base_url ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  });
  return ollama(config.llm.model);
}
