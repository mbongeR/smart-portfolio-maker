export type Repo = {
  name: string;
  owner: { login: string };
  default_branch: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  license: { spdx_id: string | null } | null;
  topics?: string[];
  fork?: boolean;
  archived?: boolean;
  private?: boolean;
};

export function filterRepositories(
  repositories: Repo[],
  config: { topics: string[]; include_forks: boolean; include_archived: boolean },
): Repo[] {
  return repositories.filter((repo) => {
    const topics = repo.topics ?? [];
    const optedIn = config.topics.some((topic) => topics.includes(topic));
    return optedIn &&
      (config.include_forks || !repo.fork) &&
      (config.include_archived || !repo.archived);
  });
}
