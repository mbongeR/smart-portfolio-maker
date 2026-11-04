import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDraft, writeDraftIfChanged } from "../scripts/sync-core";
import { runSync } from "../scripts/sync";
import { ExtractionSchema } from "../scripts/schema";

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

  it("runs full orchestration twice with byte-identical projects and drafts", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "portfolio-sync-"));
    await writeFile(path.join(dataDir, "projects.json"), "[]\n");
    const repo = { name: "demo", owner: { login: "acme" }, default_branch: "main", description: "Demo", homepage: null, html_url: "https://github.com/acme/demo", license: null, topics: ["portfolio"], fork: false, archived: false };
    const octokit = {
      users: { getAuthenticated: async () => ({ data: { login: "acme" } }) },
      repos: {
        listForAuthenticatedUser: async () => ({ data: [repo] }),
        getBranch: async () => ({ data: { commit: { sha: "0123456789abcdef" } } }),
        get: async () => ({ data: repo }),
      },
    };
    const extract = async () => ExtractionSchema.parse({ title: "Demo", one_liner: "A demo", problem: "A problem", approach: "An approach", stack: ["TypeScript"], highlights: ["Fast"], demo_url: null });
    const config = { topics: ["portfolio"], include_forks: false, include_archived: false, template: "default", readme_max_tokens: 8000, github: { draft_branch: "drafts" }, llm: { provider: "ollama" as const, model: "test", prompt_file: "prompts/project-extraction.md" } };
    const collect = async () => ({ metadata: repo, readme: "README content", readmeUrl: "https://github.com/acme/demo/blob/main/README.md", languages: ["TypeScript"], lastCommit: null, files: {} });
    await runSync({ octokit, extract, collect, dataDir, config, now: () => "2026-01-01T00:00:00.000Z" });
    const firstProjects = await readFile(path.join(dataDir, "projects.json"), "utf8");
    const firstDraft = await readFile(path.join(dataDir, "drafts/acme-demo.json"), "utf8");
    await runSync({ octokit, extract, collect, dataDir, config, now: () => "2026-01-02T00:00:00.000Z" });
    expect(await readFile(path.join(dataDir, "projects.json"), "utf8")).toBe(firstProjects);
    expect(await readFile(path.join(dataDir, "drafts/acme-demo.json"), "utf8")).toBe(firstDraft);
    expect(await readdir(path.join(dataDir, "drafts"))).toEqual(["acme-demo.json"]);
  });

  it("keeps the same draft branch identity when source content changes", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "portfolio-change-"));
    await writeFile(path.join(dataDir, "projects.json"), "[]\n");
    let sha = "0123456789abcdef";
    const repo = { name: "demo", owner: { login: "acme" }, default_branch: "main", description: "Demo", homepage: null, html_url: "https://github.com/acme/demo", license: null, topics: ["portfolio"], fork: false, archived: false };
    const octokit = { users: { getAuthenticated: async () => ({ data: { login: "acme" } }) }, repos: { listForAuthenticatedUser: async () => ({ data: [repo] }), getBranch: async () => ({ data: { commit: { sha } } }), get: async () => ({ data: repo }) } };
    const extract = async () => ExtractionSchema.parse({ title: "Demo", one_liner: "Changed", problem: "A problem", approach: "An approach", stack: ["TypeScript"], highlights: ["Fast"], demo_url: null });
    const config = { topics: ["portfolio"], include_forks: false, include_archived: false, template: "default", readme_max_tokens: 8000, github: { draft_branch: "drafts" }, llm: { provider: "ollama" as const, model: "test", prompt_file: "prompts/project-extraction.md" } };
    const collect = async () => ({ metadata: repo, readme: "README content", readmeUrl: "https://github.com/acme/demo/blob/main/README.md", languages: ["TypeScript"], lastCommit: null, files: {} });
    const first = await runSync({ octokit, extract, collect, dataDir, config, now: () => "2026-01-01T00:00:00.000Z" });
    sha = "abcdef0123456789";
    const second = await runSync({ octokit, extract, collect, dataDir, config, now: () => "2026-01-02T00:00:00.000Z" });
    expect(first.drafts[0].branch).toBe("portfolio/draft-demo");
    expect(second.drafts[0].branch).toBe(first.drafts[0].branch);
    expect(JSON.parse(await readFile(path.join(dataDir, "drafts/acme-demo.json"), "utf8")).source_sha).toBe(sha);
  });

  it("logs and skips README-less repositories without extracting", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "portfolio-no-readme-"));
    await writeFile(path.join(dataDir, "projects.json"), "[]\n");
    const repo = { name: "empty", owner: { login: "acme" }, default_branch: "main", description: null, homepage: null, html_url: "https://github.com/acme/empty", license: null, topics: ["portfolio"], fork: false, archived: false };
    const octokit = { users: { getAuthenticated: async () => ({ data: { login: "acme" } }) }, repos: { listForAuthenticatedUser: async () => ({ data: [repo] }), getBranch: async () => ({ data: { commit: { sha: "0123456789abcdef" } } }), get: async () => ({ data: repo }) } };
    let called = false;
    const config = { topics: ["portfolio"], include_forks: false, include_archived: false, template: "default", readme_max_tokens: 8000, github: { draft_branch: "drafts" }, llm: { provider: "ollama" as const, model: "test", prompt_file: "prompts/project-extraction.md" } };
    const result = await runSync({ octokit, extract: async () => { called = true; return extraction; }, collect: async () => ({ metadata: repo, readme: null, readmeUrl: "https://github.com/acme/empty/blob/main/README.md", languages: [], lastCommit: null, files: {} }), dataDir, config, logger: () => undefined });
    expect(called).toBe(false);
    expect(result.skipped[0]).toContain("README not found");
  });

  it("truncates an over-limit README before extraction", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "portfolio-limit-"));
    await writeFile(path.join(dataDir, "projects.json"), "[]\n");
    const repo = { name: "large", owner: { login: "acme" }, default_branch: "main", description: null, homepage: null, html_url: "https://github.com/acme/large", license: null, topics: ["portfolio"], fork: false, archived: false };
    const octokit = { users: { getAuthenticated: async () => ({ data: { login: "acme" } }) }, repos: { listForAuthenticatedUser: async () => ({ data: [repo] }), getBranch: async () => ({ data: { commit: { sha: "0123456789abcdef" } } }), get: async () => ({ data: repo }) } };
    let received = "";
    const config = { topics: ["portfolio"], include_forks: false, include_archived: false, template: "default", readme_max_tokens: 3, github: { draft_branch: "drafts" }, llm: { provider: "ollama" as const, model: "test", prompt_file: "prompts/project-extraction.md" } };
    await runSync({ octokit, extract: async (input) => { received = input.readme; return extraction; }, collect: async () => ({ metadata: repo, readme: "one two three four five", readmeUrl: "https://github.com/acme/large/blob/main/README.md", languages: [], lastCommit: null, files: {} }), dataDir, config, logger: () => undefined });
    expect(received).toContain("[README truncated at 3 tokens]");
    expect(received.split(/\s+/).slice(0, 3)).toEqual(["one", "two", "three"]);
  });

  it("truncates the oversized README fixture to the configured limit", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "portfolio-fixture-"));
    await writeFile(path.join(dataDir, "projects.json"), "[]\n");
    const repo = { name: "fixture", owner: { login: "acme" }, default_branch: "main", description: null, homepage: null, html_url: "https://github.com/acme/fixture", license: null, topics: ["portfolio"], fork: false, archived: false };
    const octokit = { users: { getAuthenticated: async () => ({ data: { login: "acme" } }) }, repos: { listForAuthenticatedUser: async () => ({ data: [repo] }), getBranch: async () => ({ data: { commit: { sha: "0123456789abcdef" } } }), get: async () => ({ data: repo }) } };
    const config = { topics: ["portfolio"], include_forks: false, include_archived: false, template: "default", readme_max_tokens: 8000, github: { draft_branch: "drafts" }, llm: { provider: "ollama" as const, model: "test", prompt_file: "prompts/project-extraction.md" } };
    const fixture = await readFile(path.join(process.cwd(), "tests/fixtures/large-readme.md"), "utf8");
    let received = "";
    await runSync({ octokit, extract: async (input) => { received = input.readme; return extraction; }, collect: async () => ({ metadata: repo, readme: fixture, readmeUrl: "https://github.com/acme/fixture/blob/main/README.md", languages: [], lastCommit: null, files: {} }), dataDir, config, logger: () => undefined });
    expect(received.split(/\s+/).filter(Boolean).slice(0, 8000)).toHaveLength(8000);
    expect(received).toContain("[README truncated at 8000 tokens]");
  });

  it("creates cleanup records for archived, opted-out, and missing projects", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "portfolio-cleanup-"));
    const projects = [
      { ...extraction, id: "acme-archived", source_repo: "acme/archived", source_sha: "0123456789abcdef", repo_url: "https://github.com/acme/archived", homepage: null, license: null, updated_at: "2026-01-01T00:00:00.000Z", approved_at: "2026-01-01T00:00:00.000Z" },
      { ...extraction, id: "acme-opted-out", source_repo: "acme/opted-out", source_sha: "0123456789abcdef", repo_url: "https://github.com/acme/opted-out", homepage: null, license: null, updated_at: "2026-01-01T00:00:00.000Z", approved_at: "2026-01-01T00:00:00.000Z" },
      { ...extraction, id: "acme-missing", source_repo: "acme/missing", source_sha: "0123456789abcdef", repo_url: "https://github.com/acme/missing", homepage: null, license: null, updated_at: "2026-01-01T00:00:00.000Z", approved_at: "2026-01-01T00:00:00.000Z" },
    ];
    await writeFile(path.join(dataDir, "projects.json"), `${JSON.stringify(projects)}\n`);
    const archived = { name: "archived", owner: { login: "acme" }, default_branch: "main", description: null, homepage: null, html_url: "https://github.com/acme/archived", license: null, topics: ["portfolio"], fork: false, archived: true };
    const optedOut = { name: "opted-out", owner: { login: "acme" }, default_branch: "main", description: null, homepage: null, html_url: "https://github.com/acme/opted-out", license: null, topics: ["other"], fork: false, archived: false };
    const octokit = { users: { getAuthenticated: async () => ({ data: { login: "acme" } }) }, repos: { listForAuthenticatedUser: async () => ({ data: [archived, optedOut] }), getBranch: async () => ({ data: { commit: { sha: "0123456789abcdef" } } }), get: async ({ repo }: { repo: string }) => { if (repo === "missing") throw { status: 404 }; return { data: repo === "archived" ? archived : optedOut }; } } };
    const config = { topics: ["portfolio"], include_forks: false, include_archived: false, template: "default", readme_max_tokens: 8000, github: { draft_branch: "drafts" }, llm: { provider: "ollama" as const, model: "test", prompt_file: "prompts/project-extraction.md" } };
    const result = await runSync({ octokit, extract: async () => extraction, collect: async () => ({ metadata: archived, readme: null, readmeUrl: "", languages: [], lastCommit: null, files: {} }), dataDir, config, logger: () => undefined });
    expect(result.cleanup.map((item) => item.reason)).toEqual(["repo archived", "repo no longer opted in", "repo not found"]);
  });
});
