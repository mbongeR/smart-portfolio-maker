import { z } from "zod";

const text = z.string().trim().min(1);
const url = z.string().url();

export const ExtractionSchema = z.object({
  title: text,
  one_liner: text.max(240),
  problem: text,
  approach: text,
  stack: z.array(text).max(30),
  highlights: z.array(text).max(12),
  demo_url: url.nullable(),
});

export const ProjectSchema = ExtractionSchema.extend({
  id: z.string().regex(/^[A-Za-z0-9._-]+$/),
  source_repo: text,
  source_sha: z.string().regex(/^[0-9a-f]{7,40}$/),
  repo_url: url,
  homepage: url.nullable(),
  license: text.nullable(),
  updated_at: z.string().datetime({ offset: true }),
  approved_at: z.string().datetime({ offset: true }),
});

export const DraftSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9._-]+$/),
  source_repo: text,
  source_sha: z.string().regex(/^[0-9a-f]{7,40}$/),
  generated_at: z.string().datetime({ offset: true }),
  status: z.literal("draft"),
  project: ExtractionSchema,
  source: z.object({
    repo_url: url,
    homepage: url.nullable(),
    license: text.nullable(),
    topics: z.array(text),
    languages: z.array(text),
    last_commit_at: z.string().datetime({ offset: true }).nullable(),
  }),
});

export const PortfolioConfigSchema = z.object({
  topics: z.array(text).default(["portfolio"]),
  include_forks: z.boolean().default(false),
  include_archived: z.boolean().default(false),
  template: text.default("default"),
  readme_max_tokens: z.number().int().positive().default(8000),
  output_language: text.optional(),
  llm: z.object({
    provider: z.enum(["gemini", "ollama", "openai"]),
    model: text,
    base_url: url.optional(),
    prompt_file: text.default("prompts/project-extraction.md"),
  }),
  github: z.object({
    owner: text.optional(),
    draft_branch: text.default("portfolio-drafts"),
  }).default({ draft_branch: "portfolio-drafts" }),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type PortfolioConfig = z.infer<typeof PortfolioConfigSchema>;
