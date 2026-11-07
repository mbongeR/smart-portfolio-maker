"use client";
import type { Draft } from "@/scripts/schema";
import { githubPullRequestsUrl } from "@/lib/github-links";

export function DraftCard({ draft }: { draft: Draft }) {
  const portfolioRepository = process.env.NEXT_PUBLIC_REPOSITORY;
  return <article className="card">
    <h2>{draft.project.title}</h2><p className="muted">{draft.project.one_liner}</p>
    <p>{draft.project.problem}</p>
    <div>{draft.project.stack.map((item) => <span className="pill" key={item}>{item}</span>)}</div>
    <p className="muted">{draft.source.is_private ? "Private project — review the generated PR before publishing." : `Source: ${draft.source_repo}`}</p>
    {portfolioRepository ? <a className="button" href={githubPullRequestsUrl(portfolioRepository)}>Review approval PRs</a> : <p className="muted">Set NEXT_PUBLIC_REPOSITORY to enable GitHub review links.</p>}
  </article>;
}
