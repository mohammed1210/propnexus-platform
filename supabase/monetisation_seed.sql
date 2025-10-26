create table if not exists payments_log (
  id uuid primary key default uuid_generate_v4(),
  user_email text,
  event text,
  amount numeric,
  created_at timestamp default now()
);
