#### `supabase/policies/saved_deals.sql`
```sql
-- Enable row-level security and restrict saved_deals CRUD to the owning user.

alter table public.saved_deals enable row level security;

-- Select only your own saved deals
create policy "Saved deals: select own" on public.saved_deals
for select
  using (auth.uid() = user_id);

-- Insert only for yourself
create policy "Saved deals: insert own" on public.saved_deals
for insert
  with check (auth.uid() = user_id);

-- Update only your own rows
create policy "Saved deals: update own" on public.saved_deals
for update
  using (auth.uid() = user_id);

-- Delete only your own rows
create policy "Saved deals: delete own" on public.saved_deals
for delete
  using (auth.uid() = user_id);
