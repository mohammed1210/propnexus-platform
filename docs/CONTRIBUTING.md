### docs/CONTRIBUTING.md
```md
# Contributing Guide

Thank you for your interest in contributing to PropNexus! Please take a moment to review this guide before opening an issue or submitting a pull request.

## Branching and Commit Style

- All development should occur on feature branches created from `main`. Use descriptive names such as `feature/ai-routes` or `bugfix/login-timeout`.
- Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. Examples include:
  - `feat: add investment summary component`
  - `fix(api): prevent division by zero in ROI calculation`
  - `docs: update README-DEV with local setup instructions`

## Pull Request Checklist

Before you submit a pull request, please ensure that:

- [ ] All new code includes appropriate comments and/or docstrings.
- [ ] Any new public API routes are documented.
- [ ] You have added or updated tests to cover your changes.
- [ ] `ruff .` and `black --check .` pass for Python files.
- [ ] `pnpm typecheck` and `pnpm build` succeed for JavaScript/TypeScript files (or the equivalent `yarn`/`npm` commands).
- [ ] The project builds without errors.
- [ ] You have run `bash scripts/verify-deploy.sh` against your deployed backend (if applicable) and it reports success.
- [ ] All environment variables used by your feature are documented in the appropriate `.env.example` file.
- [ ] Your branch is up to date with `main` and does not contain merge conflicts.

## Code Reviews

Pull requests require at least one approval from a maintainer. Reviews focus on correctness, security, clarity, performance, and adherence to style. Respond constructively to feedback; a dialog often leads to better solutions.

## Reporting Bugs

If you find a bug, please open a new [bug report](../.github/ISSUE_TEMPLATE/bug_report.md) and provide as much detail as possible, including steps to reproduce, expected vs. actual behavior, and information about your environment.

## Proposals and Feature Requests

If you have an idea for a new feature, please open a [feature request](../.github/ISSUE_TEMPLATE/feature_request.md). Describe the problem you’re trying to solve, not just your proposed solution; this helps the maintainers understand the context and possibly propose alternative solutions.

## Code of Conduct

This project follows a code of conduct. Be respectful, inclusive, and professional in all interactions. See `CODE_OF_CONDUCT.md` for details if one exists; otherwise, default to the standards of the open‑source community.

Thank you for helping make PropNexus better!
