import type { Project } from "@/scripts/schema";

export function ProjectCard({ project }: { project: Project }) {
  return <article className="card">
    <h2>{project.title}</h2><p className="muted">{project.one_liner}</p>
    <p>{project.problem}</p><p>{project.approach}</p>
    <div>{project.stack.map((item) => <span className="pill" key={item}>{item}</span>)}</div>
    <ul>{project.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
    <a className="button" href={project.repo_url}>View repository</a>
    {project.demo_url && <a className="button" href={project.demo_url} style={{ marginLeft: ".5rem" }}>Live demo</a>}
  </article>;
}
