import { SiteHeader } from "@/components/site-header";
import { ProjectCard } from "@/components/project-card";
import { getProjects } from "@/lib/data";

export default function Home() {
  const projects = getProjects();
  return <><SiteHeader /><main className="shell">
    <p className="muted">Selected work</p><h1>Developer portfolio</h1>
    <section className="grid">{projects.length ? projects.map((project) => <ProjectCard key={project.id} project={project} />) : <p className="muted">No approved projects yet.</p>}</section>
  </main></>;
}
