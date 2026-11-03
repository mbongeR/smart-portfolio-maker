import { describe, expect, it } from "vitest";
import { sanitizeReadme } from "../scripts/sanitize";
describe("sanitizeReadme", () => {
  it.each([
    ["private keys", "-----BEGIN RSA PRIVATE KEY-----abc-----END RSA PRIVATE KEY-----"],
    ["provider tokens", "ghp_abcdefghijklmnopqrstuvwxyz"],
    ["named secrets", "token=super-secret-value"],
    ["database URLs", "postgres://user:pass@example.com/db"],
    [".env blocks", ".env\nAPI_KEY=secret-value\nDB_PASSWORD=hunter2\n\ntext"],
    ["AWS keys", "AKIA1234567890ABCDEF"],
    ["JWTs", "eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk"],
    ["private IPs", "Connect to 192.168.1.20"],
  ])("redacts %s", (_name, input) => {
    expect(sanitizeReadme(input)).toContain("[REDACTED]");
  });
});
