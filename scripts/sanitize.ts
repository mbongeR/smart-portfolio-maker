const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
  /\b(?:ghp|github_pat|sk|AKIA)[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'`\s]+["']?/gi,
  /\b(?:postgres|mysql|mongodb(?:\+srv)?)\:\/\/[^\s"'`]+/gi,
  /(?:^|\n)(?:[A-Za-z0-9_.-]+)?\.env(?:\.[A-Za-z0-9_.-]+)?\s*(?:\n|$)[\s\S]*?(?=\n\s*\n|$)/gi,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[0-1]))\.(?:\d{1,3}\.){1,2}\d{1,3}\b/g,
];

export function sanitizeReadme(input: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[REDACTED]"), input);
}
