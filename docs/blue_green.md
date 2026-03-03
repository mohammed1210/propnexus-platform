# Blue-Green Search Deploy

- Two Railway services: **search-blue** and **search-green** (identical containers, different ENV `COLOUR`).
- Edge selection:
  - `SEARCH_INSTANCE` env-var on **Vercel** sets the colour for the Next.js app.
  - The backend route proxy reads the same var and forwards to the target service.
- Switch strategies:
  1. Manual – `gh workflow run traffic-switch.yml -f colour=green`
  2. Automated – promote new colour after CI + smoke test pass.

## Rollback

```bash
gh workflow run traffic-switch.yml -f colour=blue
```
