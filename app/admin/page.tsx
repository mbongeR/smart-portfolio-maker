import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SiteHeader } from "@/components/site-header";
import { DraftCard } from "@/components/draft-card";
import { DraftSchema } from "@/scripts/schema";

async function getDrafts() {
  const directory = path.join(process.cwd(), "data/drafts");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => DraftSchema.parse(JSON.parse(await readFile(path.join(directory, file), "utf8")))));
}

export default async function AdminPage() {
  const draftModules = await getDrafts();
  return <><SiteHeader /><main className="shell"><h1>Draft review</h1>
    <p className="muted">Review drafts in GitHub, then merge the generated PR after moving approved content into projects.json.</p>
    <section className="grid">{draftModules.map((draft) => <DraftCard key={draft.id} draft={draft} />)}</section>
  </main></>;
}
