alter table if exists analytics.search_clicks
  add column if not exists clerk_user_id text;

grant update (clerk_user_id) on analytics.search_clicks to service_role;
