import { describe, expect, it } from "vitest";
import { createGithubClient } from "../scripts/github";

describe("GitHub client configuration", () => {
  it("reports the required token when it is empty", () => {
    expect(() => createGithubClient("")).toThrow("PORTFOLIO_GITHUB_TOKEN is required");
  });
});
