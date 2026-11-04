import { describe, expect, it, vi } from "vitest";

const { generateObjectMock } = vi.hoisted(() => ({ generateObjectMock: vi.fn() }));
vi.mock("ai", () => ({ generateObject: generateObjectMock }));

import { extractProject } from "../scripts/extract";

describe("LLM extraction contract", () => {
  const input = {
    config: { topics: ["portfolio"], include_forks: false, include_archived: false, template: "default", readme_max_tokens: 8000, github: { draft_branch: "drafts" }, llm: { provider: "ollama" as const, model: "test", base_url: "http://localhost:11434/v1", prompt_file: "prompts/project-extraction.md" } },
    repositoryMetadata: { name: "demo" },
    detectedStack: ["TypeScript"],
    readme: "A demo",
  };

  it("accepts a provider-shaped result after generateObject enforces the Zod schema", async () => {
    generateObjectMock.mockImplementationOnce(async ({ schema }) => ({ object: schema.parse({ title: "Demo", one_liner: "A demo", problem: "A problem", approach: "An approach", stack: ["TypeScript"], highlights: ["Fast"], demo_url: null }) }));
    await expect(extractProject(input)).resolves.toMatchObject({ title: "Demo", stack: ["TypeScript"] });
  });

  it("rejects malformed provider output", async () => {
    generateObjectMock.mockImplementationOnce(async ({ schema }) => ({ object: schema.parse({ title: "Missing required fields" }) }));
    await expect(extractProject(input)).rejects.toThrow();
  });

  it("adds the default English instruction to the provider prompt", async () => {
    generateObjectMock.mockImplementationOnce(async ({ schema, prompt }) => {
      expect(prompt).toContain("Write the output in English");
      return { object: schema.parse({ title: "Demo", one_liner: "A demo", problem: "A problem", approach: "An approach", stack: ["TypeScript"], highlights: ["Fast"], demo_url: null }) };
    });
    await extractProject(input);
  });
});
