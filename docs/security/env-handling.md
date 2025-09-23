### docs/security/env-handling.md
```md
# Environment Variables & Secret Handling

Sensitive information such as API keys, database URLs, and authentication tokens must never be committed to source control. This document outlines how to manage environment variables securely in PropNexus.

## Principles

- **Do not commit secrets** – Files such as `.env` should never be checked into git. Only `.env.example` should exist in the repository to serve as a template.
- **Use environment variables** – Read secrets from environment variables in your code. For example, use `os.getenv("DATABASE_URL")` in Python or `process.env.NEXT_PUBLIC_SUPABASE_URL` in JavaScript.
- **Least privilege** – Provision separate credentials for development, staging, and production. Avoid reusing tokens across environments.
- **Rotate regularly** – Rotate secrets periodically and immediately after suspected exposure.

## Example Setup

The `/frontend/.env.example` and `/backend/.env.example` files contain placeholders for required variables. Copy them to create `.env` files and fill in real values:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
