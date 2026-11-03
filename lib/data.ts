import projects from "@/data/projects.json";
import type { Project } from "@/scripts/schema";

export function getProjects(): Project[] {
  return projects as Project[];
}
