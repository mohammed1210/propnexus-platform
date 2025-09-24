-- Minimal seed data for development.
-- Replace IDs as needed via Supabase CLI before execution.

insert into public.users (id, email)
values ('00000000-0000-0000-0000-000000000000', 'test@example.com')
on conflict (id) do nothing;

insert into public.saved_deals (id, user_id, data)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '{}'::jsonb)
on conflict (id) do nothing;
