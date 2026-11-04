import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createGithubClient, collectRepository } from "./github";
import { filterRepositories, type Repo } from "./filter";
import { detectStack } from "./package-parser";
import { sanitizeReadme } from "./sanitize";
import { DraftSchema, PortfolioConfigSchema, ProjectSchema, type Draft, type PortfolioConfig, type Project } from "./schema";
import { extractProject } from "./extract";
import { createDraft, truncateToTokens, writeDraftIfChanged } from "./sync-core";

export type SyncDraft = {
  id: string;
  repoName: string;
  sourceRepo: string;
  repoUrl: string;
  readmeUrl: string;
  summary: string;
  branch: string;
  draftFile: string;
};

export type CleanupRecord = {
  id: string;
  repoName: string;
  sourceRepo: string;
  reason: "repo no longer opted in" | "repo archived" | "repo not found";
};

export type RepositoryCollector = (client: unknown, owner: string, repo: string) => Promise<{
  metadata: Repo;
  readme: string | null;
  readmeUrl: string;
  languages: string[];
  lastCommit: string | null;
  files: Record<string, string>;
}>;

export type SyncDependencies = {
  octokit: {
    users: { getAuthenticated: () => Promise<{ data: { login: string } }> };
    repos: {
      listForAuthenticatedUser: (options: { per_page: number; affiliation: string }) => Promise<{ data: Repo[] }>;
      get: (options: { owner: string; repo: string }) => Promise<{ data: Repo }>;
      getBranch: (options: { owner: string; repo: string; branch: string }) => Promise<{ data: { commit: { sha: string } } }>;
    };
  };
  extract: typeof extractProject;
  collect?: RepositoryCollector;
  dataDir: string;
  config: PortfolioConfig;
  now?: () => string;
  logger?: (message: string) => void;
};

export type SyncResult = {
  drafts: SyncDraft[];
  cleanup: CleanupRecord[];
  skipped: string[];
  viewer: string;
};

export async function runSync(dependencies: SyncDependencies): Promise<SyncResult> {
  const { octokit, config, dataDir, logger = console.log, now = () => new Date().toISOString() } = dependencies;
  const collect = dependencies.collect ?? (collectRepository as unknown as RepositoryCollector);
  const projectsPath = path.join(dataDir, "projects.json");
  const draftsDir = path.join(dataDir, "drafts");
  const projects = ProjectSchema.array().parse(JSON.parse(await readFile(projectsPath, "utf8"))) as Project[];
  await mkdir(draftsDir, { recursive: true });

  const { data: viewer } = await octokit.users.getAuthenticated();
  const { data: repositories } = await octokit.repos.listForAuthenticatedUser({ per_page: 100, affiliation: "owner" });
  const selected = filterRepositories(repositories, config);
  const selectedSources = new Set(selected.map((repo) => `${repo.owner.login}/${repo.name}`));
  const drafts: SyncDraft[] = [];
  const skipped: string[] = [];

  for (const repo of selected) {
    const owner = repo.owner.login;
    const collected = await collect(octokit, owner, repo.name);
    const sourceRepo = `${owner}/${repo.name}`;
    const id = sourceRepo.replace(/[^A-Za-z0-9._-]/g, "-");
    const sourceSha = (await octokit.repos.getBranch({ owner, repo: repo.name, branch: repo.default_branch })).data.commit.sha;
    if (!collected.readme?.trim()) {
      const reason = `Skipped ${sourceRepo}: README not found or empty`;
      skipped.push(reason);
      logger(reason);
      continue;
    }
    const existingProject = projects.find((project) => project.id === id);
    const draftFile = path.join(draftsDir, `${id}.json`);
    let existingDraft: Draft | undefined;
    try { existingDraft = DraftSchema.parse(JSON.parse(await readFile(draftFile, "utf8"))); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") logger(`Ignoring invalid draft ${draftFile}`);
    }
    if (existingProject?.source_sha === sourceSha) continue;
    if (existingDraft?.source_sha === sourceSha) continue;
    const extraction = await dependencies.extract({
      config,
      repositoryMetadata: { name: repo.name, description: repo.description, homepage: repo.homepage, license: repo.license?.spdx_id },
      detectedStack: detectStack(collected.files),
      readme: truncateToTokens(sanitizeReadme(collected.readme), config.readme_max_tokens),
    });
    const draft: Draft = DraftSchema.parse(createDraft({
      id, sourceRepo, sourceSha, generatedAt: now(), extraction,
      source: { repo_url: repo.html_url, homepage: repo.homepage || null, license: repo.license?.spdx_id || null, topics: repo.topics ?? [], languages: collected.languages, last_commit_at: collected.lastCommit },
    }));
    await writeDraftIfChanged(draftFile, draft);
    drafts.push({
      id, repoName: repo.name, sourceRepo, repoUrl: repo.html_url, readmeUrl: collected.readmeUrl,
      summary: extraction.one_liner, branch: `portfolio/draft-${repo.name}`, draftFile,
    });
  }

  const cleanup: CleanupRecord[] = [];
  for (const project of projects) {
    if (selectedSources.has(project.source_repo)) continue;
    const [owner, repoName] = project.source_repo.split("/");
    let current: Repo | undefined;
    try { current = (await octokit.repos.get({ owner, repo: repoName })).data; } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
    const reason = !current ? "repo not found" : current.archived ? "repo archived" : "repo no longer opted in";
    cleanup.push({ id: project.id, repoName, sourceRepo: project.source_repo, reason });
  }
  logger(`Synced ${selected.length} opted-in repositories for ${viewer.login}.`);
  return { drafts, cleanup, skipped, viewer: viewer.login };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const config = PortfolioConfigSchema.parse(JSON.parse(await readFile(path.join(root, "portfolio.config.json"), "utf8")));
  const result = await runSync({ octokit: createGithubClient(), extract: extractProject, dataDir: path.join(root, "data"), config, logger: (message) => console.error(message) });
  console.log(JSON.stringify(result, null, 2));
}
