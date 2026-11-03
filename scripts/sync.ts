import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createGithubClient, collectRepository } from "./github";
import { filterRepositories } from "./filter";
import { detectStack } from "./package-parser";
import { sanitizeReadme } from "./sanitize";
import { DraftSchema, PortfolioConfigSchema, ProjectSchema, type Draft, type Project } from "./schema";
import { extractProject } from "./extract";
import { createDraft, writeDraftIfChanged } from "./sync-core";

const root = process.cwd();
const config = PortfolioConfigSchema.parse(JSON.parse(await readFile(path.join(root, "portfolio.config.json"), "utf8")));
const client = createGithubClient();
const { data: viewer } = await client.users.getAuthenticated();
const { data: repositories } = await client.repos.listForAuthenticatedUser({ per_page: 100, affiliation: "owner" });
const selected = filterRepositories(repositories, config);
const projectsPath = path.join(root, "data/projects.json");
const draftsDir = path.join(root, "data/drafts");
const projects = ProjectSchema.array().parse(JSON.parse(await readFile(projectsPath, "utf8"))) as Project[];
await mkdir(draftsDir, { recursive: true });

for (const repo of selected) {
  const owner = repo.owner.login;
  const collected = await collectRepository(client, owner, repo.name);
  const id = `${owner}--${repo.name}`.replace(/[^A-Za-z0-9._-]/g, "-");
  const sourceSha = repo.default_branch ? (await client.repos.getBranch({ owner, repo: repo.name, branch: repo.default_branch })).data.commit.sha : "";
  const existingProject = projects.find((project) => project.id === id);
  const draftFile = path.join(draftsDir, `${id}.json`);
  let existingDraft: Draft | undefined;
  try { existingDraft = DraftSchema.parse(JSON.parse(await readFile(draftFile, "utf8"))); } catch { /* no prior draft */ }
  if ((existingProject?.source_sha === sourceSha) || (existingDraft?.source_sha === sourceSha)) continue;
  const extraction = await extractProject({
    config,
    repositoryMetadata: { name: repo.name, description: repo.description, homepage: repo.homepage, license: repo.license?.spdx_id },
    detectedStack: detectStack(collected.files),
    readme: sanitizeReadme(collected.readme),
  });
  const draft: Draft = DraftSchema.parse(createDraft({
    id, sourceRepo: `${owner}/${repo.name}`, sourceSha, generatedAt: new Date().toISOString(),
    extraction,
    source: { repo_url: repo.html_url, homepage: repo.homepage || null, license: repo.license?.spdx_id || null, topics: repo.topics ?? [], languages: collected.languages, last_commit_at: collected.lastCommit },
  }));
  await writeDraftIfChanged(draftFile, draft);
}
console.log(`Synced ${selected.length} opted-in repositories for ${viewer.login}.`);
