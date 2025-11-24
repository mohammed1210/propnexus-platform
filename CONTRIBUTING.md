# Contributing Guidelines for AI Tools (Copilot, ChatGPT, and Automated Agents)

This repository relies heavily on AI-assisted development.  
To prevent schema drift, routing mismatches, and subscription errors,  
**all contributors and AI agents must follow these rules**.

---

# 1. DATABASE & SCHEMA RULES

### ✔ Migrations are the source of truth  
- **Do NOT modify `schema.sql` directly** unless it is to sync with the live DB.  
- All schema changes **must** be implemented as an additive migration in:
```

supabase/migrations/YYYYMMDD_description.sql

```
- All migrations must use:
- `ADD COLUMN IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE TABLE IF NOT EXISTS`

### ✔ Keep naming consistent (snake_case only)
- Never create camelCase DB columns.
- Correct naming for property fields:  
```

investment_type
yield_percent
roi_percent
imageurl
location
bmv

```

### ✔ RLS rules must be kept valid
- Any table touched must have proper RLS policies.
- Do not reference columns in policies that do not exist.

---

# 2. BACKEND ROUTING RULES

### ✔ Listings page must use the backend API  
The frontend **must not** query Supabase directly for properties.

Always use:
```

GET /properties

```

### ✔ Keep field naming consistent  
The backend must return snake_case keys to the frontend.

### ✔ Do not silently filter out rows  
Property routes must not require non-null `yield_percent` or `roi_percent` unless explicitly requested.

---

# 3. SUBSCRIPTION & STRIPE RULES

### ✔ Stripe is the source of truth for billing
- All plan updates must occur through:
```

backend/routes/stripe_webhook.py

```

### ✔ Required columns in `users` table
Agents must ensure these columns always exist:

```

plan
plan_status
current_period_end
stripe_customer_id

```

### ✔ Trials must match Stripe product settings
If the UI mentions trials, Stripe must be configured or UI must be corrected.

---

# 4. TESTING REQUIREMENTS

For any change touching schema, routing, ingestion, or subscriptions:

### ✔ Add/Update tests:
- Backend tests (pytest)
- Frontend tests (`__tests__/…`)
- Contract tests for `/properties` return shape
- Tests for `users.plan` updates from Stripe webhooks

### ✔ Do not break existing tests  
All changes must keep:
```

pytest → 100% pass
npm test → 100% pass

```

---

# 5. BEFORE CREATING ANY PR (AI OR HUMAN)

### ✔ Mandatory PR checklist
- [ ] I added/updated migrations (if schema changed)
- [ ] I did NOT touch schema.sql except to sync with live DB
- [ ] `/properties` route returns expected columns
- [ ] Listings page displays properties locally
- [ ] Stripe webhook correctly updates user plan
- [ ] All tests pass (backend + frontend)
- [ ] No direct Supabase queries for listings

---

# 6. AI-SPECIFIC RULES

### ✔ Agents MUST obey repository invariants  
Before applying changes, Agents should inspect:

- `supabase/schema.sql`
- All files in `supabase/migrations/`
- `/backend/routes`
- `/frontend/app`
- `/frontend/hooks/useUserPlan.ts`

### ✔ If uncertain → STOP and ask  
Conflicting schema? Conflicting env variables?  
Agents must request clarification instead of guessing.

---

These rules prevent:

- Schema drift  
- Broken routing  
- Subscription mismatches  
- Missing columns  
- Zero-data listings  
- Repeated failures after deploying

Following these ensures PropNexus stays stable, scalable, and production-ready.
