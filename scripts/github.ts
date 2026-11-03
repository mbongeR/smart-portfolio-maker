import { Octokit } from "@octokit/rest";

export function createGithubClient(token = process.env.PORTFOLIO_GITHUB_TOKEN): Octokit {
  if (!token) throw new Error("PORTFOLIO_GITHUB_TOKEN is required");
  return new Octokit({ auth: token });
}

export async function collectRepository(client: Octokit, owner: string, repo: string) {
  const [{ data: metadata }, { data: readme }, { data: languages }, { data: commits }] = await Promise.all([
    client.repos.get({ owner, repo }),
    client.repos.getReadme({ owner, repo, mediaType: { format: "raw" } }),
    client.repos.listLanguages({ owner, repo }),
    client.repos.listCommits({ owner, repo, per_page: 1 }),
  ]);
  const content = typeof readme === "string" ? readme : Buffer.from(readme.content, "base64").toString("utf8");
  const rootFiles = await Promise.all(["package.json", "pyproject.toml", "go.mod"].map(async (path) => {
    try {
      const result = await client.repos.getContent({ owner, repo, path, ref: metadata.default_branch });
      if (!Array.isArray(result.data) && "content" in result.data) return [path, Buffer.from(result.data.content, "base64").toString("utf8")] as const;
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
    return [path, ""] as const;
  }));
  return {
    metadata,
    readme: content,
    languages: Object.keys(languages),
    lastCommit: commits[0]?.commit.author?.date ?? null,
    files: Object.fromEntries(rootFiles),
  };
}
