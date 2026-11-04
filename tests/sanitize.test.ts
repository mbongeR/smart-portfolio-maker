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

  it.each([
    ["private keys", "-----BEGIN RSA PRIVATE KEY-----abc"],
    ["provider tokens", "ghx_not-a-supported-token"],
    ["named secrets", "tokenizer is useful"],
    ["database URLs", "https://example.com/docs"],
    [".env blocks", "environment variables are documented here"],
    ["AWS keys", "AKIA1234"],
    ["JWTs", "eyJnot-a-jwt"],
    ["private IPs", "Public DNS 8.8.8.8"],
  ])("does not redact the common negative case for %s", (_name, input) => {
    expect(sanitizeReadme(input)).toBe(input);
  });
});
