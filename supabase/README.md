# Supabase Database Setup

This directory contains all database-related files for the PropNexus platform.

## Files

### Schema
- **`schema.sql`** - Complete database schema with tables, indexes, RLS policies, and triggers

### Policies
- **`policies/saved_deals.sql`** - Row Level Security policies for saved_deals table

### Seed Data
- **`seed/dev_seed.sql`** - Development seed data for testing
- **`monetisation_seed.sql`** - Payment logging table setup

## Setup Instructions

### 1. Initial Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the complete schema file:
   ```sql
   -- Copy and paste contents of schema.sql
   ```

### 2. Verify Setup

After running the schema, verify that the following tables exist:
- `users`
- `subscriptions`
- `properties`
- `saved_deals`
- `property_notes`
- `payments_log`

Check that RLS is enabled on user-facing tables:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 3. Seed Development Data (Optional)

For local development, you can run the seed files:
```sql
-- Run dev_seed.sql for test users and deals
-- Run monetisation_seed.sql for payments table
```

## Table Descriptions

### users
Stores user account information and links to Stripe customers.

**Columns**:
- `id` (uuid) - Primary key
- `email` (text) - Unique user email
- `stripe_customer_id` (text) - Stripe customer ID
- `plan` (text) - Subscription plan: 'free', 'pro', 'investor' (default: 'free')
- `plan_status` (text) - Subscription status: 'active', 'trialing', 'past_due', 'canceled' (default: 'active')
- `current_period_end` (bigint) - Unix timestamp of current billing period end
- `created_at`, `updated_at` (timestamp)

### subscriptions
Tracks user subscription status and details.

**Note**: This table exists for legacy/future use. The primary billing logic uses the `users` table directly with embedded plan columns.

**Columns**:
- `id` (uuid) - Primary key
- `user_id` (uuid) - Foreign key to users(id) with ON DELETE CASCADE
- `email` (text) - User email (unique)
- `stripe_customer_id` (text) - Stripe customer ID
- `subscription_id` (text) - Stripe subscription ID (unique)
- `status` (text) - Subscription status (active, canceled, etc.)
- `price_id` (text) - Stripe price ID
- `created_at`, `updated_at` (timestamp)

### properties
Stores property listing data from various sources.

**Columns**:
- `id` (uuid) - Primary key
- `external_id` (text) - Unique ID from source
- `title`, `description` (text) - Property details
- `price` (numeric) - Property price
- `bedrooms`, `bathrooms` (integer)
- `property_type`, `address`, `postcode` (text)
- `latitude`, `longitude` (numeric) - Coordinates
- `source` (text) - Data source (rightmove, zoopla, etc.)
- `url` (text) - Source URL
- `image_urls` (text[]) - Array of image URLs
- `data` (jsonb) - Additional metadata
- `created_at`, `updated_at` (timestamp)

### saved_deals
User-saved property deals.

**Columns**:
- `id` (uuid) - Primary key
- `user_id` (uuid) - Foreign key to auth.users
- `data` (jsonb) - Deal data
- `created_at`, `updated_at` (timestamp)

**RLS**: Users can only access their own saved deals

### property_notes
User notes on properties.

**Columns**:
- `id` (uuid) - Primary key
- `user_id` (uuid) - Foreign key to auth.users
- `property_id` (uuid) - Foreign key to properties
- `note` (text) - Note content
- `created_at`, `updated_at` (timestamp)

**RLS**: Users can only access their own notes

### payments_log
Logs payment events for monitoring.

**Columns**:
- `id` (uuid) - Primary key
- `user_email` (text) - User email
- `event` (text) - Event type
- `amount` (numeric) - Payment amount
- `created_at` (timestamp)

## Row Level Security (RLS)

### Enabled Tables
All tables have RLS enabled to ensure data security.

### Policy Summary

**saved_deals & property_notes**:
- Users can only SELECT, INSERT, UPDATE, DELETE their own records
- Filtered by `auth.uid() = user_id`

**properties**:
- Read-only for all authenticated and anonymous users
- Writes managed by service role only

**users & subscriptions**:
- Users can view their own records (by email)
- Writes managed by service role only (via webhooks)

## Indexes

Performance indexes are created on:
- `users(email, stripe_customer_id)`
- `subscriptions(email, stripe_customer_id, status)`
- `properties(postcode, source)`
- `saved_deals(user_id)`

## Triggers

Automatic `updated_at` timestamp triggers on all tables:
- `users`
- `subscriptions`
- `properties`
- `saved_deals`
- `property_notes`

## Migration Notes

### From Existing Database
If migrating from an existing database:

1. Export data from old tables
2. Run `schema.sql` to create new structure
3. Import data with proper UUID generation
4. Verify RLS policies match expected behavior

### Updates and Changes
When modifying the schema:

1. Create migration SQL files
2. Test in development first
3. Document changes in this README
4. Apply to production with backup

## Environment Variables

Ensure these are set in your application:

**Backend**:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server operations

**Frontend**:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key for client operations
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server components

## Troubleshooting

### RLS Issues
If users can't access their data:
1. Verify RLS policies are enabled
2. Check that `auth.uid()` matches `user_id`
3. Ensure user is authenticated

### Performance Issues
If queries are slow:
1. Check if indexes exist: `\di` in psql
2. Review query plans: `EXPLAIN ANALYZE <query>`
3. Consider adding composite indexes

### Webhook Updates Not Working
If Stripe webhooks aren't updating the database:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
2. Check webhook logs in Stripe Dashboard
3. Review backend logs for errors
4. Ensure tables exist and RLS allows service role writes

## Security Checklist

- [x] RLS enabled on all user-facing tables
- [x] Service role key only used server-side
- [x] Anonymous key used for public data only
- [x] User data isolated by auth.uid()
- [x] Indexes on sensitive columns for performance
- [x] Automatic timestamp updates
- [x] Foreign key constraints for data integrity

## Support

For issues or questions:
1. Check Supabase documentation: https://supabase.com/docs
2. Review application logs
3. Test queries in Supabase SQL Editor
4. Verify environment variables are set correctly
