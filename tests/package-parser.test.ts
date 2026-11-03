import { expect, it } from "vitest";
import { detectStack } from "../scripts/package-parser";
it("detects manifests and dependencies", () => {
  expect(detectStack({ "package.json": '{"dependencies":{"next":"1"}}', "pyproject.toml": "[project]\ndependencies=['fastapi']" })).toEqual(["FastAPI", "Python", "next"]);
});
