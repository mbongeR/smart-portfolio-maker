# Smart Portfolio Maker

Smart Portfolio Maker is an open-source, self-hosted developer portfolio that turns
opt-in GitHub repositories into reviewable project drafts. It uses GitHub Actions for
automation, structured LLM output for writing assistance, and static JSON for a fast,
private-by-default public site.

> **Human approval is required.** A repository is never published just because it has
> the `portfolio` topic. New entries are written to `data/drafts/` first.

## What it does

- Scans only repositories tagged with a configured topic (default: `portfolio`).
- Excludes forks and archived repositories by default.
- Reads README content, languages, topics, homepage, license, and latest commit.
- Detects stack information from `package.json`, `pyproject.toml`, and `go.mod`.
- Removes common secrets before README content is sent to an LLM.
- Supports Gemini, OpenAI, and Ollama-compatible providers through configuration.
- Validates LLM responses with Zod.
- Creates one approval pull request per repository. Merging approves the project;
  closing the PR discards it.
- Renders only approved entries from `data/projects.json`.
- Deploys the static Next.js site to GitHub Pages.

## Setup

GitHub Actions requires these repository secrets:

- `PORTFOLIO_GITHUB_TOKEN`: a fine-grained GitHub PAT with **Contents: Read** and
  **Metadata: Read** permissions, granted only to the selected repositories being
  scanned.
- `GROQ_API_KEY`: the Groq API key used by the default configuration.

Set them without putting their values in the repository:

```bash
gh secret set PORTFOLIO_GITHUB_TOKEN --repo mbongeR/smart-portfolio-maker
gh secret set GROQ_API_KEY --repo mbongeR/smart-portfolio-maker
```

The sync workflow skips scheduled and push runs when the GitHub token is absent.
Manual runs fail with a setup message instead. Never commit `.env` or secret values.

## Quick start

### 1. Install

Requirements:

- Node.js 22+
- npm
- A GitHub repository for this portfolio
- A fine-grained GitHub token with access to read the repositories being scanned

```bash
npm ci
cp .env.example .env
```

On Windows PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env
```

Set `PORTFOLIO_GITHUB_TOKEN` in `.env`. Never commit `.env`; it is ignored by Git.

### 2. Configure

Edit [`portfolio.config.json`](./portfolio.config.json):

```json
{
  "topics": ["portfolio"],
  "include_forks": false,
  "include_archived": false,
  "template": "default",
  "llm": {
    "provider": "ollama",
    "model": "llama3.2",
    "base_url": "http://localhost:11434/v1",
    "prompt_file": "prompts/project-extraction.md"
  },
  "github": {
    "draft_branch": "portfolio-drafts"
  }
}
```

Supported providers:

| Provider | Required environment/configuration |
| --- | --- |
| `ollama` | `base_url` or `OLLAMA_BASE_URL`, plus a reachable Ollama model |
| `gemini` | `GOOGLE_GENERATIVE_AI_API_KEY` and a Gemini model |
| `groq` | `GROQ_API_KEY` and a Groq model |
| `openai` | `OPENAI_API_KEY` and an OpenAI model |

For GitHub Actions, add the provider credentials and
`PORTFOLIO_GITHUB_TOKEN` as repository secrets. Ollama must be reachable from the
runner; a laptop-only `localhost` endpoint will not work on a GitHub-hosted runner.

### 3. Generate drafts

Tag a repository with `portfolio`, then run:

```bash
npm run sync
```

The sync is designed to be idempotent: unchanged source commits do not regenerate
drafts or create a diff.

### 4. Review and approve

The sync workflow commits each candidate to
`portfolio/draft-<repo-name>` and opens a separate pull request titled
`Portfolio draft: <repo-name>`. Each approval PR contains exactly two changes:
the project is added to `data/projects.json` and its draft is deleted from
`data/drafts/`. The PR body includes the generated summary, repository URL, and
README URL.

The static `/admin` page provides GitHub edit and delete links. Because GitHub Pages
is static, it does not hold a write token and cannot mutate the repository directly.
To approve an entry, review and merge its approval PR. To discard it, close the
PR without merging. If the source README changes before merge, the same branch and
open PR are force-updated rather than duplicated. Only entries in
`data/projects.json` are displayed publicly.

If repositories are deleted, archived, or lose the configured topic, the workflow
opens a separate aggregate cleanup PR that removes their approved entries. It
never auto-merges cleanup changes.

## Local development

```bash
npm run dev       # Start the Next.js development server
npm run test      # Run Vitest tests
npm run typecheck # Run TypeScript checks
npm run lint      # Run ESLint
npm run build     # Build the static export in out/
npm run e2e       # Optional real GitHub/Ollama smoke test (requires credentials)
```

Open `http://localhost:3000` for the portfolio and
`http://localhost:3000/admin` for draft review.

Set `NEXT_PUBLIC_REPOSITORY=owner/repository` in `.env` to enable the admin page's
GitHub links.

The E2E smoke test uses `mbongeR/MbongeRedeem-portfolio` as its positive fixture
and discovers one fork and one archived repository without modifying them:

```powershell
$env:PORTFOLIO_GITHUB_TOKEN = "<fine-grained-token>"
$env:OLLAMA_BASE_URL = "http://localhost:11434/v1"
$env:E2E_PROVIDER = "ollama"
npm run e2e
```

## GitHub Actions

- [`sync.yml`](./.github/workflows/sync.yml) runs daily, manually, or when
  `portfolio.config.json` changes. It creates per-repository approval PRs and an
  optional aggregate cleanup PR.
- [`deploy.yml`](./.github/workflows/deploy.yml) builds the static export and deploys
  it to GitHub Pages.

Enable GitHub Pages with **GitHub Actions** as the deployment source. The workflows
use least-privilege job permissions for their respective tasks.

## Project structure

```text
app/                 Next.js pages, including the static draft review page
components/          Portfolio and draft UI
data/projects.json   Approved public projects
data/drafts/         Generated, unapproved drafts
prompts/             Editable LLM extraction prompt
scripts/             GitHub sync, filtering, sanitization, extraction, and schemas
tests/               Filtering, parsing, sanitization, extraction, and idempotency tests
```

## Security and privacy

- Use a fine-grained token rather than a classic broad OAuth token.
- Store credentials only in `.env` locally or GitHub Actions secrets.
- README text is sanitized before it reaches the LLM, but sanitization is heuristic;
  do not place secrets in public READMEs.
- The public site contains only committed `data/projects.json` content.
- No database or third-party SaaS is required.

## Known limitations

- Approval is a human GitHub workflow, not an in-browser mutation.
- Repositories without a README are logged and skipped.
- README input is limited to 8,000 approximate whitespace tokens by default;
  configure `readme_max_tokens` to change it.
- A GitHub-hosted runner cannot access a local Ollama server without a reachable
  network endpoint or self-hosted runner.
- The first version ships one default visual template; the config field is reserved
  for future template plugins.

## License

This project is intended to be open source. Add the repository's chosen license file
before publishing a release.
