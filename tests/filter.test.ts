import { describe, expect, it } from "vitest";
import { filterRepositories } from "../scripts/filter";

const repo = (topics: string[], extra = {}) => ({ topics, fork: false, archived: false, ...extra }) as never;
describe("filterRepositories", () => {
  it("requires an opted-in topic and excludes forks and archives", () => {
    expect(filterRepositories([repo(["portfolio"]), repo(["other"]), repo(["portfolio"], { fork: true }), repo(["portfolio"], { archived: true })], { topics: ["portfolio"], include_forks: false, include_archived: false })).toHaveLength(1);
  });
  it("supports configured overrides", () => {
    expect(filterRepositories([repo(["portfolio"], { fork: true, archived: true })], { topics: ["portfolio"], include_forks: true, include_archived: true })).toHaveLength(1);
  });
  it("includes forks when include_forks is true", () => {
    expect(filterRepositories([repo(["portfolio"], { fork: true })], { topics: ["portfolio"], include_forks: true, include_archived: false })).toHaveLength(1);
  });
});
