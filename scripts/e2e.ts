import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGithubClient, collectRepository } from "./github";
import { extractProject } from "./extract";
import { runSync } from "./sync";
import { PortfolioConfigSchema } from "./schema";

const token = process.env.PORTFOLIO_GITHUB_TOKEN;
if (!token) throw new Error("Set PORTFOLIO_GITHUB_TOKEN before running the E2E check.");
const provider = process.env.E2E_PROVIDER ?? "ollama";
const root = process.cwd();
const config = PortfolioConfigSchema.parse(JSON.parse(await readFile(path.join(root, "portfolio.config.json"), "utf8")));
const e2eConfig = { ...config, llm: { ...config.llm, provider: provider as "ollama" | "gemini" | "openai" } };
const client = createGithubClient(token);
const { data: viewer } = await client.users.getAuthenticated();
const { data: repositories } = await client.repos.listForAuthenticatedUser({ per_page: 100, affiliation: "owner" });
const positive = repositories.find((repo) => repo.full_name === "mbongeR/MbongeRedeem-portfolio");
if (!positive) throw new Error("mbongeR/MbongeRedeem-portfolio was not found in the authenticated account.");
if (!(positive.topics ?? []).includes("portfolio")) throw new Error("mbongeR/MbongeRedeem-portfolio must have the portfolio topic for the E2E check.");
const fork = repositories.find((repo) => repo.fork);
const archived = repositories.find((repo) => repo.archived);
if (!fork || !archived) throw new Error("The authenticated account needs at least one fork and one archived repository for the filter fixture.");
console.log(`E2E fixtures: ${positive.full_name}, fork=${fork.full_name}, archived=${archived.full_name}`);

const dataDir = await mkdtemp(path.join(os.tmpdir(), "portfolio-e2e-"));
await cp(path.join(root, "data/projects.json"), path.join(dataDir, "projects.json"));
const result = await runSync({
  octokit: client,
  extract: extractProject,
  collect: collectRepository as never,
  dataDir,
  config: e2eConfig,
  logger: (message) => console.error(message),
});
await writeFile(path.join(dataDir, "e2e-result.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  viewer: viewer.login,
  provider,
  included: result.drafts.map((draft) => draft.sourceRepo),
  skipped: result.skipped,
  cleanup: result.cleanup,
  diff: "Generated output is isolated in a temporary directory and was not written to the repository.",
}, null, 2));
