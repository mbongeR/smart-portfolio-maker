import { writeFile, readFile } from "node:fs/promises";
import type { Draft, Extraction } from "./schema";

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
  source: Draft["source"];
}): Draft {
  return {
    id: input.id,
    source_repo: input.sourceRepo,
    source_sha: input.sourceSha,
    generated_at: input.generatedAt,
    status: "draft",
    project: input.extraction,
    source: input.source,
  };
}
