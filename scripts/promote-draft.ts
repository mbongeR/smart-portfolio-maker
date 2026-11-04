import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { DraftSchema, ProjectSchema } from "./schema";

const root = process.cwd();
const draftPath = process.argv[2];
if (!draftPath) throw new Error("Usage: tsx scripts/promote-draft.ts data/drafts/<id>.json");
const draft = DraftSchema.parse(JSON.parse(await readFile(draftPath, "utf8")));
const projectsPath = path.join(root, "data/projects.json");
const projects = ProjectSchema.array().parse(JSON.parse(await readFile(projectsPath, "utf8")));
const timestamp = new Date().toISOString();
const project = ProjectSchema.parse({
  ...draft.project,
  id: draft.id,
  source_repo: draft.source_repo,
  source_sha: draft.source_sha,
  repo_url: draft.source.repo_url,
  homepage: draft.source.homepage,
  license: draft.source.license,
  updated_at: timestamp,
  approved_at: timestamp,
});
const next = [...projects.filter((item) => item.id !== project.id), project].sort((a, b) => a.id.localeCompare(b.id));
await writeFile(projectsPath, `${JSON.stringify(next, null, 2)}\n`);
await unlink(draftPath);
