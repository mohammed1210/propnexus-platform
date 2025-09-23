# Development Setup

This repository is a monorepo containing the Next.js frontend (`/frontend`), a FastAPI backend (`/backend`), and associated scripts and docs. It is designed to run on Vercel (frontend) and Railway (backend) with Supabase for database storage.

## Requirements

* **Node.js** ≥ 18.x. We recommend using the latest LTS version. [Node Version Manager](https://github.com/nvm-sh/nvm) can help manage multiple versions.
* **Python** ≥ 3.11.
* **pnpm**, **yarn**, or **npm** for managing JavaScript dependencies. We recommend `pnpm` (install via `corepack enable`).
* **pip** for Python dependencies.
* A **Vercel** account for deploying the frontend.
* A **Railway** account for deploying the backend.
* A **Supabase** account for database hosting (optional for local development).

## Initial Setup

1. **Clone the repository** and change into its directory.

   ```bash
   git clone https://github.com/mohammed1210/propnexus.git
   cd propnexus
