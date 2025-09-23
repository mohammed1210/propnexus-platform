# ADR-0001: Agent Mode Guardrails

## Status

Accepted

## Context

We integrate OpenAI’s Agent Mode to help generate scaffolding, documentation, and non‑invasive code for our repository. Because Agent Mode is autonomous, we need guardrails to ensure that the codebase remains maintainable, secure, and consistent.

## Decision

When using Agent Mode, we will adopt the following guardrails:

- **Additive-only:** Generated changes must not remove or simplify existing code. Agent Mode may create new files or append content but must never delete or refactor existing modules.

- **Minimal dependencies:** New code should prefer built‑in language features and widely adopted dependencies. Node dependencies should come from the existing `package.json` where possible. Python dependencies should be pinned in `requirements.txt`.

- **Explicit secrets handling:** Environment variables must be referenced via `.env` files and not hard-coded. Agent Mode must never commit secrets or tokens. Example values belong in `.env.example` files only.

- **Europe/London timezone:** All timestamps and schedules default to the Europe/London timezone unless explicitly overridden.

- **Testing and documentation:** When generating new modules, Agent Mode should include corresponding tests (where feasible) and update relevant documentation. Generated scripts should provide clear diagnostic output and fail gracefully.

- **Security and logging:** Generated code must not log sensitive information (e.g. API keys, tokens). Error messages should be informative but not leak secrets.

These constraints are documented here to inform human reviewers and automated tooling.

## Consequences

- Agent Mode contributions will remain non‑destructive and easy to audit.
- Developers can trust that automated tasks won’t secretly expose secrets or reconfigure core systems.
- Additional guardrails may be added as the project evolves; revisions to this ADR should be submitted via pull request.
