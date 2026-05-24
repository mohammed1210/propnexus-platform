alter table public.users
  add column if not exists clerk_user_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_clerk_user_id_key'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_clerk_user_id_key unique (clerk_user_id);
  end if;
end $$;

comment on column public.users.clerk_user_id is 'Clerk user ID used by Clerk webhooks and app authentication';