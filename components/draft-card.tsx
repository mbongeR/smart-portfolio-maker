"use client";
import type { Draft } from "@/scripts/schema";
import { githubDeleteUrl, githubFileUrl } from "@/lib/github-links";

export function DraftCard({ draft }: { draft: Draft }) {
  const file = `data/drafts/${draft.id}.json`;
  const portfolioRepository = process.env.NEXT_PUBLIC_REPOSITORY;
  return <article className="card">
    <h2>{draft.project.title}</h2><p className="muted">{draft.project.one_liner}</p>
    <p>{draft.project.problem}</p>
    <div>{draft.project.stack.map((item) => <span className="pill" key={item}>{item}</span>)}</div>
    <p className="muted">Source: {draft.source_repo}</p>
    {portfolioRepository ? <>
      <a className="button" href={githubFileUrl(portfolioRepository, file)}>Edit draft</a>
      <a className="button" href={githubDeleteUrl(portfolioRepository, file)} style={{ marginLeft: ".5rem" }}>Discard draft</a>
    </> : <p className="muted">Set NEXT_PUBLIC_REPOSITORY to enable GitHub review links.</p>}
  </article>;
}
