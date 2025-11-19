# Frontend Environment Variables (Clerk)

This app currently uses Supabase Auth in production, with optional support for Clerk. If you enable Clerk, set the following environment variables.

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

- If you are not migrating to Clerk yet, you can leave these unset; the app will continue to use Supabase Auth.