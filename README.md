# Self-hosted portfolio

This portfolio discovers only GitHub repositories tagged `portfolio`, drafts entries with a configured LLM, and requires human review before anything appears in `data/projects.json`.

Set `PORTFOLIO_GITHUB_TOKEN` locally or in GitHub Actions, configure `portfolio.config.json`, then run `npm run sync`. The static site is built with `npm run build`.
