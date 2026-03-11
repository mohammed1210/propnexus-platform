# Search Analytics

Search result clicks are recorded in `analytics.search_clicks` through the existing frontend event pipeline:

- UI cards call `track('search_click', ...)`
- Next.js proxies the request via `/api/events/search_click`
- The backend writes to `analytics.search_clicks`

Inspect the newest rows:

```sql
select *
from analytics.search_clicks
order by coalesce(created_at, inserted_at) desc
limit 50;
```

Top clicked listings in the last 7 days:

```sql
select listing_id, count(*) as clicks
from analytics.search_clicks
where coalesce(created_at, inserted_at) >= now() - interval '7 days'
group by listing_id
order by clicks desc
limit 50;
```
