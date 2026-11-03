import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDraft, writeDraftIfChanged } from "../scripts/sync-core";

const extraction = { title: "Demo", one_liner: "A demo", problem: "A problem", approach: "An approach", stack: ["TypeScript"], highlights: ["Fast"], demo_url: null };
const source = { repo_url: "https://github.com/acme/demo", homepage: null, license: "MIT", topics: ["portfolio"], languages: ["TypeScript"], last_commit_at: null };

describe("sync idempotency", () => {
  it("runs the same sync twice and produces zero diff on the second run", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "portfolio-"));
    const file = path.join(directory, "draft.json");
    const draft = createDraft({ id: "acme--demo", sourceRepo: "acme/demo", sourceSha: "0123456789abcdef", generatedAt: "2026-01-01T00:00:00.000Z", extraction, source });
    expect(await writeDraftIfChanged(file, draft)).toBe(true);
    const before = await readFile(file, "utf8");
    expect(await writeDraftIfChanged(file, draft)).toBe(false);
    expect(await readFile(file, "utf8")).toBe(before);
  });
});
