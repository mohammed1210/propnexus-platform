# Enable pg_trgm for similarity search

The search stack uses PostgreSQL `similarity()` matching for typo tolerance (for example, `londn` → `london`).

Apply migration `supabase/migrations/20260302_enable_pg_trgm_for_search.sql` to ensure:

- `pg_trgm` extension is enabled
- GIN trigram indexes exist on `properties.title`, `properties.location`, and `properties.postcode` (via `lower(...)` expressions)

After deployment, verify the backend diagnostic endpoint:

- `GET /health/search`
