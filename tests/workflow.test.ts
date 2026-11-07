import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.join(process.cwd(), ".github", "workflows", "sync.yml");

describe("sync workflow safeguards", () => {
  it("uses a preflight guard and excludes pull request triggers", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    expect(workflow).toContain("configured=${{ secrets.PORTFOLIO_GITHUB_TOKEN != '' }}");
    expect(workflow).toContain("needs: preflight");
    expect(workflow).toContain("if: needs.preflight.outputs.configured == 'true'");
    expect(workflow).toContain("npm --silent run sync > sync-result.json");
    expect(workflow).toContain("[d.id,d.branch].join");
    expect(workflow).toContain('d.repoUrl ?? ""');
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
  });
});
