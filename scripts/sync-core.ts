import { writeFile, readFile } from "node:fs/promises";
import type { Draft, Extraction } from "./schema";

export function truncateToTokens(input: string, maxTokens: number): string {
  const tokens = input.split(/\s+/).filter(Boolean);
  return tokens.length <= maxTokens ? input : `${tokens.slice(0, maxTokens).join(" ")}\n\n[README truncated at ${maxTokens} tokens]`;
}

export async function writeDraftIfChanged(file: string, draft: Draft): Promise<boolean> {
  const serialized = `${JSON.stringify(draft, null, 2)}\n`;
  try {
    if (await readFile(file, "utf8") === serialized) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeFile(file, serialized);
  return true;
}

export function createDraft(input: {
  id: string;
  sourceRepo: string;
  sourceSha: string;
  generatedAt: string;
  extraction: Extraction;
  source: Omit<Draft["source"], "is_private"> & { is_private?: boolean };
}): Draft {
  return {
    id: input.id,
    source_repo: input.sourceRepo,
    source_sha: input.sourceSha,
    generated_at: input.generatedAt,
    status: "draft",
    project: input.extraction,
    source: { ...input.source, is_private: input.source.is_private ?? false },
  };
}
