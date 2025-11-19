# Frontend Environment Variables (Clerk)

The app uses Clerk as the primary authentication provider. Supabase is used for
data and billing; it no longer handles user-facing auth flows.

## Required (Clerk)

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Public publishable key. Safe to expose to the browser.
- `CLERK_SECRET_KEY`: Server-side secret key. Do not expose publicly.

## Optional

- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`: Path to redirect after sign-in (e.g. `/dashboard`).
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`: Path to redirect after sign-up (e.g. `/dashboard`).

## Local Development

- Place variables in `frontend/.env.local` (git-ignored). Example:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

Restart the dev server after changes: `npm run dev`.

## Vercel (Preview/Production)

- Add the same variables in the Vercel project settings under Environment Variables for both Preview and Production.
- The deploy workflow runs `vercel pull` to sync env, so builds will pick them up automatically.

## GitHub Actions (CI)

- Add repository secrets so CI builds succeed without hardcoding values:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
- The workflows read these secrets and fall back to safe placeholders if not set.

## Notes

- If Clerk env vars are missing, authentication will not work. Configure them
  for local dev, Vercel environments, and CI before relying on protected pages.