# Implementation Audit

Audit target: the MVP implementation in this repository, compared with the approved implementation plan.

## 1. Admin approve/discard

**FAIL — manual only; no browser PAT security bug.**

- Draft loading: [app/admin/page.tsx:7](app/admin/page.tsx:7)
- Edit/discard GitHub links: [components/draft-card.tsx:5](components/draft-card.tsx:5)
- The UI has no `Approve` action and no code that moves a draft into `data/projects.json` or commits it.
- The displayed workflow is manual: edit `data/projects.json` in GitHub and merge the draft PR; discard uses GitHub's file-delete UI.
- No PAT is sent to or used by browser code. The missing behavior is therefore a functional gap, not a browser-token vulnerability.
- The initial plan explicitly selected static-safe `github-pr-links`, but the original product goal still requires documenting this as incomplete.

**Diff needed to close:** add a server-side/API or GitHub Actions approval workflow that validates a draft, appends it to `data/projects.json`, removes the draft, and commits through a protected GitHub credential. Do not put that credential in the browser.

## 2. Idempotency

**PARTIAL FAIL — helper-level test exists; full `sync.ts` orchestration is not run twice.**

- Idempotent write helper: [scripts/sync-core.ts:4](scripts/sync-core.ts:4)
- Sync uses the helper: [scripts/sync.ts:39](scripts/sync.ts:39)
- The test writes the same generated draft twice and asserts the second write returns `false` and the bytes are unchanged: [tests/sync.test.ts:10-19](tests/sync.test.ts:10)
- There is no test that invokes the complete GitHub/LLM orchestration twice with mocked dependencies.

**Diff needed to close:** extract the top-level orchestration into an injectable `runSync` function, mock Octokit and the LLM, invoke `runSync` twice against a temporary data directory, and assert both `data/projects.json` and `data/drafts` have identical snapshots after the second run.

## 3. Secret sanitization

**PASS — all listed patterns have focused coverage; implementation remains heuristic.**

Patterns:

1. Private-key blocks: [scripts/sanitize.ts:2](scripts/sanitize.ts:2) — test [tests/sanitize.test.ts:5](tests/sanitize.test.ts:5)
2. GitHub/provider token prefixes (`ghp`, `github_pat`, `sk`, `AKIA`): [scripts/sanitize.ts:3](scripts/sanitize.ts:3) — test [tests/sanitize.test.ts:6](tests/sanitize.test.ts:6)
3. Named assignments (`api_key`, `secret`, `token`, `password`): [scripts/sanitize.ts:4](scripts/sanitize.ts:4) — test [tests/sanitize.test.ts:7](tests/sanitize.test.ts:7)
4. Database URLs: [scripts/sanitize.ts:5](scripts/sanitize.ts:5) — test [tests/sanitize.test.ts:8](tests/sanitize.test.ts:8)
5. `.env` blocks: [scripts/sanitize.ts:6](scripts/sanitize.ts:6) — test [tests/sanitize.test.ts:9](tests/sanitize.test.ts:9)
6. AWS access-key shape: [scripts/sanitize.ts:7](scripts/sanitize.ts:7) — test [tests/sanitize.test.ts:10](tests/sanitize.test.ts:10)
7. JWT shape: [scripts/sanitize.ts:8](scripts/sanitize.ts:8) — test [tests/sanitize.test.ts:11](tests/sanitize.test.ts:11)
8. Private RFC1918 IP shapes: [scripts/sanitize.ts:9](scripts/sanitize.ts:9) — test [tests/sanitize.test.ts:12](tests/sanitize.test.ts:12)

The sanitizer is applied before extraction at [scripts/sync.ts:33](scripts/sync.ts:33).

## 4. Fork/archived filtering

**PASS.**

- Filtering implementation: [scripts/filter.ts:14](scripts/filter.ts:14)
- Default topic, fork, and archive exclusion test: [tests/filter.test.ts:5](tests/filter.test.ts:5)
- `include_forks: true` override test: [tests/filter.test.ts:12](tests/filter.test.ts:12)
- Combined fork/archive override test: [tests/filter.test.ts:9](tests/filter.test.ts:9)

## 5. LLM extraction

**PASS — provider call is wired and the mock test enforces the Zod contract.**

- Prompt loading and placeholder substitution: [scripts/extract.ts:8](scripts/extract.ts:8)
- `generateObject` with `ExtractionSchema`: [scripts/extract.ts:20](scripts/extract.ts:20)
- Ollama-compatible provider construction: [scripts/extract.ts:33](scripts/extract.ts:33)
- Gemini and OpenAI provider construction: [scripts/extract.ts:24](scripts/extract.ts:24)
- Valid provider-shaped mock result is parsed through the supplied schema: [tests/extract.test.ts:16](tests/extract.test.ts:16)
- Malformed provider output is rejected by the schema before extraction resolves: [tests/extract.test.ts:21](tests/extract.test.ts:21)

No live network provider call was made in the audit environment; the approved mock is contract-enforcing rather than an unvalidated fixture.

## 6. `sync.yml` PR behavior

**PASS — it commits to a dedicated branch and opens/updates a PR; it does not commit to main.**

- Change detection: [.github/workflows/sync.yml:30](.github/workflows/sync.yml:30)
- Dedicated branch checkout and push: [.github/workflows/sync.yml:34](.github/workflows/sync.yml:34)
- Existing-PR check and PR creation: [.github/workflows/sync.yml:38](.github/workflows/sync.yml:38)

**Remaining plan mismatch:** the PR title is aggregate `Portfolio draft: sync`, not `Portfolio draft: <repo-name>`. A per-repository PR or an explicitly approved aggregate-title revision is needed to satisfy that exact wording.

## 7. Line-count audit

Files under 30 lines containing production functions/components required by the plan:

| File | Lines | Assessment |
|---|---:|---|
| [app/admin/page.tsx](app/admin/page.tsx) | 19 | Functional draft loader/page; approve mutation is missing as reported in item 1 |
| [app/layout.tsx](app/layout.tsx) | 8 | Minimal but functional root layout |
| [app/page.tsx](app/page.tsx) | 11 | Functional static project renderer |
| [components/draft-card.tsx](components/draft-card.tsx) | 18 | Functional review links; no approve mutation |
| [components/project-card.tsx](components/project-card.tsx) | 12 | Functional project renderer |
| [components/site-header.tsx](components/site-header.tsx) | 7 | Minimal functional navigation |
| [lib/data.ts](lib/data.ts) | 6 | Functional build-time JSON loader, intentionally small |
| [lib/github-links.ts](lib/github-links.ts) | 9 | Functional URL builders |
| [scripts/filter.ts](scripts/filter.ts) | 25 | Functional filtering logic |
| [scripts/package-parser.ts](scripts/package-parser.ts) | 20 | Functional manifest parser |
| [scripts/sanitize.ts](scripts/sanitize.ts) | 14 | Functional sanitizer |

No listed file is an empty stub. The admin page is intentionally minimal, but its missing approval mutation is a product gap, not hidden stub code.

## Verification run

- `npm test`: **5 test files, 15 tests passed**
- `npm run typecheck`: passed before this audit-only documentation was added
- The tests added during this audit cover sanitizer variants, fork override, idempotent writes, and schema-enforced extraction mocks.
