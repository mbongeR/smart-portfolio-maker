# Implementation Audit 2

The request contains overlapping numbering between the original seven checks and
the additional fixes. This report uses unique checklist IDs so every requested
criterion is answered without silently combining requirements.

## 1. Admin approval

**PASS.** Approval is merging a repository-specific PR; discard is closing it.
There is no browser PAT and no custom UI mutation.

- Draft result and branch identity:
  [scripts/sync.ts:109](scripts/sync.ts:109)
- Promotion adds the validated project and deletes the draft:
  [scripts/promote-draft.ts:8](scripts/promote-draft.ts:8),
  [scripts/promote-draft.ts:23](scripts/promote-draft.ts:23)
- Exact two-file staging:
  [.github/workflows/sync.yml:44](.github/workflows/sync.yml:44),
  [.github/workflows/sync.yml:47](.github/workflows/sync.yml:47)
- PR title and body:
  [.github/workflows/sync.yml:51](.github/workflows/sync.yml:51),
  [.github/workflows/sync.yml:54](.github/workflows/sync.yml:54)

## 2. Idempotency

**PASS.** The full orchestration test runs `runSync` twice with mocked Octokit
and LLM dependencies, then compares `projects.json` bytes and draft bytes:
[tests/sync.test.ts:23](tests/sync.test.ts:23),
[tests/sync.test.ts:38](tests/sync.test.ts:38). The lower-level unchanged-write
behavior is also tested at [tests/sync.test.ts:10](tests/sync.test.ts:10).

## 3. Secret sanitizer

**PASS.** Current source:

```ts
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
```

Source is [scripts/sanitize.ts:1](scripts/sanitize.ts). Positive cases are
[tests/sanitize.test.ts:4](tests/sanitize.test.ts); negative cases are
[tests/sanitize.test.ts:18](tests/sanitize.test.ts).

| Pattern | Positive | Negative | Result |
|---|---|---|---|
| private-key block | complete RSA block | incomplete block | redacted / preserved |
| provider token prefix | `ghp_abcdefghijklmnopqrstuvwxyz` | `ghx_not-a-supported-token` | redacted / preserved |
| named assignment | `token=super-secret-value` | `tokenizer is useful` | redacted / preserved |
| database URL | `postgres://user:pass@example.com/db` | `https://example.com/docs` | redacted / preserved |
| `.env` block | `.env` followed by assignments | ordinary “environment variables” text | redacted / preserved |
| AWS access key | `AKIA1234567890ABCDEF` | `AKIA1234` | redacted / preserved |
| JWT | three dot-separated `eyJ...` segments | `eyJnot-a-jwt` | redacted / preserved |
| private IP | `192.168.1.20` | `8.8.8.8` | redacted / preserved |

No pattern matches the empty string. Pattern 8 is heuristic and could redact an
invalid private-looking address because it does not validate octet ranges.
Pattern 5 intentionally consumes a `.env` section until a blank line.

## 4. Fork and archived filtering

**PASS.**

- Implementation: [scripts/filter.ts:14](scripts/filter.ts:14)
- Default topic/fork/archive exclusion:
  [tests/filter.test.ts:5](tests/filter.test.ts:5)
- `include_forks: true` override:
  [tests/filter.test.ts:12](tests/filter.test.ts:12)
- Combined fork/archive override:
  [tests/filter.test.ts:9](tests/filter.test.ts:9)

## 5. LLM extraction

**PASS with a contract-enforcing mock, not a live network call.**

- `generateObject` receives `ExtractionSchema`:
  [scripts/extract.ts:23](scripts/extract.ts:23)
- Provider selection covers Gemini, OpenAI, and Ollama-compatible providers:
  [scripts/extract.ts:27](scripts/extract.ts:27)
- Valid result test:
  [tests/extract.test.ts:16](tests/extract.test.ts:16)
- Malformed result rejection test:
  [tests/extract.test.ts:21](tests/extract.test.ts:21)

## 6. `sync.yml` PR behavior

**PASS.** Drafts are not committed to `main`. Each draft uses
`portfolio/draft-<repo-name>`, and the workflow opens or edits
`Portfolio draft: <repo-name>`:
[.github/workflows/sync.yml:39](.github/workflows/sync.yml:39),
[.github/workflows/sync.yml:52](.github/workflows/sync.yml:52),
[.github/workflows/sync.yml:56](.github/workflows/sync.yml:56).
The separate cleanup branch is `portfolio/sync-log`:
[.github/workflows/sync.yml:67](.github/workflows/sync.yml:67).

## 7. Line-count audit

Files under 30 lines containing required production behavior:

| File | Lines | Assessment |
|---|---:|---|
| `app/admin/page.tsx` | 19 | Functional static draft loader; no mutation by design |
| `app/page.tsx` | 11 | Functional static project renderer |
| `components/draft-card.tsx` | 18 | Functional GitHub review links |
| `components/project-card.tsx` | 12 | Functional project renderer |
| `components/site-header.tsx` | 7 | Functional navigation |
| `lib/data.ts` | 6 | Functional build-time JSON loader |
| `lib/github-links.ts` | 9 | Functional URL builders |
| `scripts/filter.ts` | 25 | Functional filtering |
| `scripts/package-parser.ts` | 20 | Functional manifest parsing |
| `scripts/sanitize.ts` | 14 | Functional sanitization |

No listed file is an empty stub. The approval mutation is intentionally in the
workflow/promotion script rather than the static admin page.

## 8. Deleted, archived, or opted-out project cleanup

**PASS.** Cleanup records are generated for absent, archived, and no-longer-opted-in
repositories:
[scripts/sync.ts:115](scripts/sync.ts:115),
[scripts/sync.ts:120](scripts/sync.ts:120),
[scripts/sync.ts:123](scripts/sync.ts:123).
The workflow creates a cleanup-only PR:
[.github/workflows/sync.yml:59](.github/workflows/sync.yml:59).
Tests cover all three reasons:
[tests/sync.test.ts:101](tests/sync.test.ts:101).

## 9. README-less repositories

**PASS.** GitHub README 404s become `null`:
[scripts/github.ts:11](scripts/github.ts:11). Sync logs and skips empty/missing
README content before calling extraction:
[scripts/sync.ts:84](scripts/sync.ts:84). The test proves the extractor is not
called: [tests/sync.test.ts:64](tests/sync.test.ts:64).

## 10. README size limit

**PASS.** `readme_max_tokens` defaults to 8000:
[scripts/schema.ts:49](scripts/schema.ts:49). Truncation occurs after sanitization
and before extraction:
[scripts/sync-core.ts:4](scripts/sync-core.ts:4),
[scripts/sync.ts:102](scripts/sync.ts:102).
The oversized fixture is [tests/fixtures/large-readme.md](tests/fixtures/large-readme.md);
tests are [tests/sync.test.ts:76](tests/sync.test.ts:76) and
[tests/sync.test.ts:88](tests/sync.test.ts:88).

## 11. Non-English README instruction

**PASS.** `output_language` is configurable:
[scripts/schema.ts:50](scripts/schema.ts:50). The extractor appends either the
configured language or an English instruction:
[scripts/extract.ts:19](scripts/extract.ts:19). The instruction is asserted in
[tests/extract.test.ts:26](tests/extract.test.ts:26).

## 12. Full injectable orchestration

**PASS.** `runSync` accepts injected Octokit, extraction, collector, filesystem
directory, clock, and logger:
[scripts/sync.ts:39](scripts/sync.ts:39),
[scripts/sync.ts:63](scripts/sync.ts:63). The full two-run byte-identical test is
[tests/sync.test.ts:23](tests/sync.test.ts:23).

## 13. Required current-HEAD verification

**PASS — raw output from the current HEAD:**

Command:

```powershell
cmd /c "npm run typecheck && npm run lint && npm test && npm run build"
```

Raw output:

```text
> portfolio@1.0.0 typecheck
> tsc --noEmit

> portfolio@1.0.0 lint
> eslint .

> portfolio@1.0.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Mbonge/Desktop/PROJECTS/portfolio

 Test Files  5 passed (5)
      Tests  30 passed (30)
 Start at 12:40:45
 Duration 7.00s (import 70%, transform 13%, tests 11%, worker 6%)

> portfolio@1.0.0 build
> next build

▲ Next.js 16.4.4 (Turbopack)
✓ Running next.config.ts took 87ms
Creating an optimized production build ...
✓ Compiled successfully in 2.3s
Running TypeScript ...
Finished TypeScript in 6.7s ...
Generating static pages using 5 workers (4/4) in 1300ms
Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
└ ○ /admin

○ (Static) prerendered as static content
```

## 14. Live end-to-end check

**BLOCKED, not claimed as passed.**

The script exists at [scripts/e2e.ts:9](scripts/e2e.ts:9). It checks
`mbongeR/MbongeRedeem-portfolio`, requires the `portfolio` topic, discovers one
fork and one archived repository, invokes the configured real provider, and
isolates output in a temporary directory:
[scripts/e2e.ts:18](scripts/e2e.ts:18),
[scripts/e2e.ts:20](scripts/e2e.ts:20),
[scripts/e2e.ts:25](scripts/e2e.ts:25).

Credential check at audit time:

```text
PORTFOLIO_GITHUB_TOKEN_PRESENT=False
OLLAMA_BASE_URL_PRESENT=False
GOOGLE_GENERATIVE_AI_API_KEY_PRESENT=False
```

The exact command to run is:

```powershell
$env:PORTFOLIO_GITHUB_TOKEN = "<fine-grained-token>"
$env:OLLAMA_BASE_URL = "http://localhost:11434/v1"
$env:E2E_PROVIDER = "ollama"
npm run e2e
```

The package script is present at `package.json` under `scripts.e2e`. The only
unverified portion is the live network/provider execution because no credentials
were available in this environment.
