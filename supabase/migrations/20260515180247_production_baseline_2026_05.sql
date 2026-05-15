

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "analytics";


ALTER SCHEMA "analytics" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "cube" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "earthdistance" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."properties_listing_history_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    new.first_seen_at := coalesce(new.first_seen_at, new.created_at, now());
    new.last_seen_at := coalesce(new.last_seen_at, now());
    new.initial_price := coalesce(new.initial_price, new.price);
    new.price_history := coalesce(new.price_history, '[]'::jsonb);
    new.price_change_count := coalesce(new.price_change_count, 0);
    return new;
  end if;

  new.first_seen_at := coalesce(old.first_seen_at, new.first_seen_at, old.created_at, now());
  new.last_seen_at := now();
  new.initial_price := coalesce(old.initial_price, new.initial_price, old.price, new.price);
  new.price_history := coalesce(old.price_history, new.price_history, '[]'::jsonb);
  new.price_change_count := coalesce(old.price_change_count, new.price_change_count, 0);

  if old.price is distinct from new.price and old.price is not null and new.price is not null then
    new.previous_price := old.price;
    new.last_price_change_at := now();
    new.price_change_count := coalesce(old.price_change_count, 0) + 1;
    new.price_history := coalesce(old.price_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'old_price', old.price,
      'new_price', new.price,
      'changed_at', now(),
      'direction', case when new.price < old.price then 'reduction' else 'increase' end
    ));
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."properties_listing_history_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_property_images"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  cleaned text[];
  cover text;
begin
  -- Normalize null -> empty array
  cleaned := coalesce(new.image_urls, '{}'::text[]);

  -- Remove null/blank entries
  cleaned := array(
    select x
    from unnest(cleaned) as x
    where x is not null and btrim(x) <> ''
  );

  -- Deduplicate (keep first occurrence order-ish)
  -- NOTE: DISTINCT loses strict ordering, but good enough for image arrays.
  cleaned := array(
    select distinct x
    from unnest(cleaned) as x
  );

  -- Choose cover image:
  -- 1) existing imageurl if present
  -- 2) else first element of image_urls
  cover := nullif(btrim(coalesce(new.imageurl, '')), '');
  if cover is null then
    cover := cleaned[1];
  end if;

  -- Ensure cover is included in image_urls (prepend so it becomes [1])
  if cover is not null then
    if array_position(cleaned, cover) is null then
      cleaned := array_prepend(cover, cleaned);
    else
      -- If cover exists but isn't first, move it to front
      cleaned := array_prepend(cover, array_remove(cleaned, cover));
    end if;
  end if;

  new.image_urls := coalesce(cleaned, '{}'::text[]);
  new.imageurl := cover;
  new.image_count := coalesce(array_length(new.image_urls, 1), 0);

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_property_images"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tradesman_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE tradesmen
  SET rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM tradesmen_reviews
    WHERE tradesman_id = COALESCE(NEW.tradesman_id, OLD.tradesman_id)
  )
  WHERE id = COALESCE(NEW.tradesman_id, OLD.tradesman_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_tradesman_rating"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "analytics"."search_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "query_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "rank" integer,
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "query" "text" DEFAULT ''::"text",
    "property_id" "uuid",
    "position" integer,
    "filters_json" "jsonb" DEFAULT '{}'::"jsonb",
    "session_id" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "clerk_user_id" "text"
);


ALTER TABLE "analytics"."search_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."area_intel_cache" (
    "id" bigint NOT NULL,
    "area_key" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."area_intel_cache" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."area_intel_cache_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."area_intel_cache_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."area_intel_cache_id_seq" OWNED BY "public"."area_intel_cache"."id";



CREATE TABLE IF NOT EXISTS "public"."comps_cache" (
    "id" bigint NOT NULL,
    "postcode" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comps_cache" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."comps_cache_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."comps_cache_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."comps_cache_id_seq" OWNED BY "public"."comps_cache"."id";



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "stripe_customer_id" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "text" NOT NULL,
    "title" "text",
    "location" "text",
    "postcode" "text",
    "price" numeric,
    "yield_percent" numeric,
    "roi_percent" numeric,
    "source" "text",
    "notes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrichment_jobs" (
    "id" bigint NOT NULL,
    "property_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "run_after" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enrichment_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."enrichment_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."enrichment_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."enrichment_jobs_id_seq" OWNED BY "public"."enrichment_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."investor_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "label" "text" DEFAULT 'Deal alert'::"text" NOT NULL,
    "search_query" "text",
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "min_discovery_score" integer,
    "include_tiers" "text"[] DEFAULT ARRAY['prime'::"text", 'strong'::"text"] NOT NULL,
    "frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_sent_at" timestamp with time zone
);


ALTER TABLE "public"."investor_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "text" NOT NULL,
    "user_id" "text",
    "custom_field" "text",
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."off_market_deals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "location" "text",
    "price" numeric,
    "bedrooms" integer,
    "bathrooms" integer,
    "investment_type" "text",
    "contact" "text",
    "source" "text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "image_url" "text"
);


ALTER TABLE "public"."off_market_deals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."off_market_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "address" "text",
    "location" "text" NOT NULL,
    "postcode" "text",
    "bedrooms" integer,
    "bathrooms" integer,
    "property_type" "text",
    "investment_type" "text",
    "asking_price" numeric,
    "estimated_value" numeric,
    "discount_percent" numeric,
    "refurb_cost" numeric,
    "rent_estimate" numeric,
    "yield_percent" numeric,
    "roi_percent" numeric,
    "lat" double precision,
    "lng" double precision,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_id" "text",
    "url" "text",
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "imageurl" "text",
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "score" integer DEFAULT 0 NOT NULL,
    "image_url" "text",
    CONSTRAINT "off_market_leads_asking_price_check" CHECK ((("asking_price" IS NULL) OR ("asking_price" >= (0)::numeric))),
    CONSTRAINT "off_market_leads_bathrooms_check" CHECK ((("bathrooms" IS NULL) OR ("bathrooms" >= 0))),
    CONSTRAINT "off_market_leads_bedrooms_check" CHECK ((("bedrooms" IS NULL) OR ("bedrooms" >= 0))),
    CONSTRAINT "off_market_leads_discount_percent_check" CHECK ((("discount_percent" IS NULL) OR ("discount_percent" >= (0)::numeric))),
    CONSTRAINT "off_market_leads_estimated_value_check" CHECK ((("estimated_value" IS NULL) OR ("estimated_value" >= (0)::numeric))),
    CONSTRAINT "off_market_leads_refurb_cost_check" CHECK ((("refurb_cost" IS NULL) OR ("refurb_cost" >= (0)::numeric))),
    CONSTRAINT "off_market_leads_rent_estimate_check" CHECK ((("rent_estimate" IS NULL) OR ("rent_estimate" >= (0)::numeric))),
    CONSTRAINT "off_market_leads_roi_percent_check" CHECK ((("roi_percent" IS NULL) OR ("roi_percent" >= (0)::numeric))),
    CONSTRAINT "off_market_leads_yield_percent_check" CHECK ((("yield_percent" IS NULL) OR ("yield_percent" >= (0)::numeric)))
);


ALTER TABLE "public"."off_market_leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."off_market_leads" IS 'User-created/imported off-market leads (manual + generator + future imports).';



CREATE TABLE IF NOT EXISTS "public"."postcode_geo_cache" (
    "postcode" "text" NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "source" "text" DEFAULT 'postcodes.io'::"text" NOT NULL,
    "raw" "jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."postcode_geo_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ppd_sales" (
    "id" bigint NOT NULL,
    "transaction_id" "text",
    "price" integer,
    "date_of_transfer" "date",
    "postcode" "text",
    "property_type" "text",
    "new_build" boolean,
    "tenure" "text",
    "paon" "text",
    "saon" "text",
    "street" "text",
    "locality" "text",
    "town_city" "text",
    "district" "text",
    "county" "text",
    "latitude" double precision,
    "longitude" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ppd_sales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ppd_sales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ppd_sales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ppd_sales_id_seq" OWNED BY "public"."ppd_sales"."id";



CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text",
    "location" "text",
    "price" numeric,
    "imageurl" "text",
    "description" "text",
    "source" "text",
    "yield_percent" numeric,
    "roi_percent" numeric,
    "bedrooms" numeric,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "latitude" numeric,
    "longitude" numeric,
    "propertyType" "text",
    "investment_type" "text",
    "bathrooms" numeric,
    "external_id" "text",
    "source_id" "text",
    "property_type" "text",
    "address" "text",
    "postcode" "text",
    "url" "text",
    "image_urls" "text"[],
    "data" "jsonb",
    "score" integer DEFAULT 0 NOT NULL,
    "score_updated_at" timestamp with time zone,
    "score_breakdown" "jsonb",
    "deal_reasons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "deal_signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "deal_signals_meta" "jsonb",
    "raw_property_type" "text",
    "image_count" integer DEFAULT 0,
    "source_url" "text",
    "listing_url" "text",
    "original_listing_url" "text",
    "agent_name" "text",
    "agency_name" "text",
    "agent_phone" "text",
    "agent_email" "text",
    "first_seen_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone,
    "initial_price" numeric,
    "previous_price" numeric,
    "last_price_change_at" timestamp with time zone,
    "price_change_count" integer DEFAULT 0 NOT NULL,
    "price_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "property_url" "text",
    "external_url" "text",
    "original_url" "text",
    "rightmove_url" "text",
    "zoopla_url" "text",
    "onthemarket_url" "text",
    "branch_name" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "top_deal_score" integer,
    "top_deal_tier" "text",
    "top_deal_reasons" "jsonb" DEFAULT '[]'::"jsonb",
    "search_metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."properties"."score" IS 'Deterministic deal score (0-100) computed server-side and stored';



COMMENT ON COLUMN "public"."properties"."score_updated_at" IS 'Timestamp when score was last computed';



COMMENT ON COLUMN "public"."properties"."score_breakdown" IS 'JSON breakdown for deterministic scoring';



COMMENT ON COLUMN "public"."properties"."top_deal_score" IS 'Deterministic scrape/discovery ranking score, separate from AI Deal Score.';



COMMENT ON COLUMN "public"."properties"."top_deal_reasons" IS 'Evidence-backed explanations for why the listing was surfaced.';



COMMENT ON COLUMN "public"."properties"."search_metadata" IS 'Portal search pass metadata used to find the listing.';



CREATE TABLE IF NOT EXISTS "public"."property_enrichment_cache" (
    "property_id" "uuid" NOT NULL,
    "postcode" "text",
    "payload" "jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_enrichment_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_deals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "property_id" "text",
    "saved_at" timestamp without time zone DEFAULT "now"(),
    "title" "text",
    "location" "text",
    "price" numeric,
    "bedrooms" integer,
    "bathrooms" integer,
    "yield_percent" numeric,
    "roi_percent" numeric,
    "imageurl" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "clerk_user_id" "text",
    "deal_status" "text" DEFAULT 'not_contacted'::"text" NOT NULL,
    "contacted_at" timestamp with time zone,
    "last_action_at" timestamp with time zone,
    "action_notes" "text",
    CONSTRAINT "saved_deals_deal_status_check" CHECK (("deal_status" = ANY (ARRAY['not_contacted'::"text", 'contacted'::"text", 'viewing_booked'::"text", 'offer_prepared'::"text", 'offer_made'::"text", 'rejected'::"text", 'archived'::"text"]))),
    CONSTRAINT "saved_deals_requires_identity" CHECK ((("user_id" IS NOT NULL) OR ("clerk_user_id" IS NOT NULL)))
);


ALTER TABLE "public"."saved_deals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scrape_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "location" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "status" "text" NOT NULL,
    "items_ingested" integer DEFAULT 0 NOT NULL,
    "duration_ms" integer,
    "error_summary" "text",
    "meta" "jsonb",
    "mode" "text",
    "properties_imported" integer DEFAULT 0,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "count_inserted" integer,
    "error" "text",
    "data" "jsonb"
);


ALTER TABLE "public"."scrape_runs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scrape_runs"."mode" IS 'Scraper mode: direct, scraperapi, or smart';



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "stripe_subscription_id" "text",
    "status" "text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price_id" "text",
    "user_id" "uuid"
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tradesmen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "trade_type" "text" NOT NULL,
    "company_name" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "service_radius_km" integer DEFAULT 20 NOT NULL,
    "rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "review_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tradesmen_trade_type_check" CHECK (("trade_type" = ANY (ARRAY['builder'::"text", 'plumber'::"text", 'electrician'::"text", 'roofer'::"text", 'surveyor'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."tradesmen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tradesmen_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tradesman_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "user_email" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tradesmen_leads_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'read'::"text", 'replied'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."tradesmen_leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."tradesmen_leads" IS 'Tracks contact attempts from investors to tradespeople';



COMMENT ON COLUMN "public"."tradesmen_leads"."property_id" IS 'Optional reference to the property being discussed';



COMMENT ON COLUMN "public"."tradesmen_leads"."status" IS 'Lead status: sent, read, replied, archived';



CREATE TABLE IF NOT EXISTS "public"."tradesmen_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tradesman_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "rating" integer NOT NULL,
    "review" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tradesmen_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."tradesmen_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."tradesmen_reviews" IS 'User reviews and ratings for tradespeople';



COMMENT ON COLUMN "public"."tradesmen_reviews"."rating" IS 'Rating from 1 to 5 stars';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "stripe_customer_id" "text",
    "plan" "text" DEFAULT 'free'::"text",
    "stripe_subscription_id" "text",
    "stripe_subscription_status" "text",
    "stripe_current_period_end" timestamp with time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "source_page" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."area_intel_cache" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."area_intel_cache_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."comps_cache" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."comps_cache_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."enrichment_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."enrichment_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ppd_sales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ppd_sales_id_seq"'::"regclass");



ALTER TABLE ONLY "analytics"."search_clicks"
    ADD CONSTRAINT "search_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."area_intel_cache"
    ADD CONSTRAINT "area_intel_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comps_cache"
    ADD CONSTRAINT "comps_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_property_id_key" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."enrichment_jobs"
    ADD CONSTRAINT "enrichment_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrichment_jobs"
    ADD CONSTRAINT "enrichment_jobs_property_id_key" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."investor_alerts"
    ADD CONSTRAINT "investor_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."off_market_deals"
    ADD CONSTRAINT "off_market_deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."off_market_leads"
    ADD CONSTRAINT "off_market_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."postcode_geo_cache"
    ADD CONSTRAINT "postcode_geo_cache_pkey" PRIMARY KEY ("postcode");



ALTER TABLE ONLY "public"."ppd_sales"
    ADD CONSTRAINT "ppd_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_enrichment_cache"
    ADD CONSTRAINT "property_enrichment_cache_pkey" PRIMARY KEY ("property_id");



ALTER TABLE ONLY "public"."saved_deals"
    ADD CONSTRAINT "saved_deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_deals"
    ADD CONSTRAINT "saved_deals_unique_clerk_property" UNIQUE ("clerk_user_id", "property_id");



ALTER TABLE ONLY "public"."saved_deals"
    ADD CONSTRAINT "saved_deals_unique_user_property" UNIQUE ("clerk_user_id", "property_id");



ALTER TABLE ONLY "public"."scrape_runs"
    ADD CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."tradesmen_leads"
    ADD CONSTRAINT "tradesmen_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tradesmen"
    ADD CONSTRAINT "tradesmen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tradesmen_reviews"
    ADD CONSTRAINT "tradesmen_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_search_clicks_dedupe" ON "analytics"."search_clicks" USING "btree" ("session_id", "query", "property_id", "created_at" DESC);



CREATE INDEX "area_intel_cache_area_key_idx" ON "public"."area_intel_cache" USING "btree" ("area_key");



CREATE INDEX "area_intel_cache_fetched_at_idx" ON "public"."area_intel_cache" USING "btree" ("fetched_at");



CREATE INDEX "comps_cache_fetched_at_idx" ON "public"."comps_cache" USING "btree" ("fetched_at");



CREATE INDEX "comps_cache_postcode_idx" ON "public"."comps_cache" USING "btree" ("postcode");



CREATE INDEX "idx_area_intel_cache_fetched_at" ON "public"."area_intel_cache" USING "btree" ("fetched_at" DESC);



CREATE INDEX "idx_area_intel_cache_source" ON "public"."area_intel_cache" USING "btree" ("source");



CREATE INDEX "idx_comps_cache_fetched_at" ON "public"."comps_cache" USING "btree" ("fetched_at" DESC);



CREATE INDEX "idx_comps_cache_source" ON "public"."comps_cache" USING "btree" ("source");



CREATE INDEX "idx_enrichment_jobs_run_after" ON "public"."enrichment_jobs" USING "btree" ("run_after");



CREATE INDEX "idx_enrichment_jobs_status" ON "public"."enrichment_jobs" USING "btree" ("status");



CREATE INDEX "idx_investor_alerts_frequency" ON "public"."investor_alerts" USING "btree" ("frequency") WHERE "active";



CREATE INDEX "idx_investor_alerts_user_active" ON "public"."investor_alerts" USING "btree" ("user_id", "active");



CREATE INDEX "idx_leads_created" ON "public"."tradesmen_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_property" ON "public"."tradesmen_leads" USING "btree" ("property_id");



CREATE INDEX "idx_leads_status" ON "public"."tradesmen_leads" USING "btree" ("status");



CREATE INDEX "idx_leads_tradesman" ON "public"."tradesmen_leads" USING "btree" ("tradesman_id");



CREATE INDEX "idx_leads_user_email" ON "public"."tradesmen_leads" USING "btree" ("user_email");



CREATE INDEX "idx_off_market_leads_created_at" ON "public"."off_market_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_off_market_leads_location" ON "public"."off_market_leads" USING "btree" ("location");



CREATE INDEX "idx_off_market_leads_source" ON "public"."off_market_leads" USING "btree" ("source");



CREATE INDEX "idx_off_market_leads_user_id" ON "public"."off_market_leads" USING "btree" ("user_id");



CREATE INDEX "idx_postcode_geo_cache_fetched_at" ON "public"."postcode_geo_cache" USING "btree" ("fetched_at" DESC);



CREATE INDEX "idx_ppd_sales_date" ON "public"."ppd_sales" USING "btree" ("date_of_transfer" DESC);



CREATE INDEX "idx_ppd_sales_postcode_date" ON "public"."ppd_sales" USING "btree" ("postcode", "date_of_transfer" DESC);



CREATE UNIQUE INDEX "idx_ppd_sales_transaction_id" ON "public"."ppd_sales" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_ppd_sales_transaction_id_unique" ON "public"."ppd_sales" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "idx_properties_id" ON "public"."properties" USING "btree" ("id");



CREATE INDEX "idx_properties_last_price_change_at" ON "public"."properties" USING "btree" ("last_price_change_at" DESC NULLS LAST);



CREATE INDEX "idx_properties_location_trgm" ON "public"."properties" USING "gin" ("lower"("location") "public"."gin_trgm_ops");



CREATE INDEX "idx_properties_original_listing_url" ON "public"."properties" USING "btree" ("original_listing_url") WHERE ("original_listing_url" IS NOT NULL);



CREATE INDEX "idx_properties_postcode" ON "public"."properties" USING "btree" ("postcode");



CREATE INDEX "idx_properties_postcode_trgm" ON "public"."properties" USING "gin" ("lower"("postcode") "public"."gin_trgm_ops");



CREATE INDEX "idx_properties_price_change_count" ON "public"."properties" USING "btree" ("price_change_count" DESC);



CREATE INDEX "idx_properties_source" ON "public"."properties" USING "btree" ("source");



CREATE INDEX "idx_properties_source_url" ON "public"."properties" USING "btree" ("source_url") WHERE ("source_url" IS NOT NULL);



CREATE INDEX "idx_properties_top_deal_score" ON "public"."properties" USING "btree" ("top_deal_score" DESC NULLS LAST, "created_at" DESC NULLS LAST);



CREATE INDEX "idx_properties_top_deal_tier" ON "public"."properties" USING "btree" ("top_deal_tier") WHERE ("top_deal_tier" IS NOT NULL);



CREATE INDEX "idx_property_enrichment_cache_fetched_at" ON "public"."property_enrichment_cache" USING "btree" ("fetched_at" DESC);



CREATE INDEX "idx_property_enrichment_cache_postcode" ON "public"."property_enrichment_cache" USING "btree" ("postcode");



CREATE INDEX "idx_reviews_created" ON "public"."tradesmen_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reviews_tradesman" ON "public"."tradesmen_reviews" USING "btree" ("tradesman_id");



CREATE INDEX "idx_reviews_user" ON "public"."tradesmen_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_saved_deals_clerk_user_id" ON "public"."saved_deals" USING "btree" ("clerk_user_id");



CREATE INDEX "idx_saved_deals_deal_status" ON "public"."saved_deals" USING "btree" ("deal_status");



CREATE INDEX "idx_saved_deals_last_action_at" ON "public"."saved_deals" USING "btree" ("last_action_at" DESC);



CREATE INDEX "idx_saved_deals_saved_at" ON "public"."saved_deals" USING "btree" ("saved_at" DESC);



CREATE INDEX "idx_scrape_runs_mode" ON "public"."scrape_runs" USING "btree" ("mode");



CREATE INDEX "idx_scrape_runs_started_at" ON "public"."scrape_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_subscriptions_price_id" ON "public"."subscriptions" USING "btree" ("price_id");



CREATE INDEX "idx_tradesmen_earth" ON "public"."tradesmen" USING "gist" ("public"."ll_to_earth"("latitude", "longitude"));



CREATE UNIQUE INDEX "notes_unique_idx" ON "public"."notes" USING "btree" (COALESCE("user_id", ''::"text"), "property_id");



CREATE INDEX "off_market_leads_created_at_desc_idx" ON "public"."off_market_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "off_market_leads_created_at_idx" ON "public"."off_market_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "off_market_leads_investment_type_idx" ON "public"."off_market_leads" USING "btree" ("investment_type");



CREATE INDEX "off_market_leads_location_idx" ON "public"."off_market_leads" USING "btree" ("location");



CREATE INDEX "off_market_leads_score_desc_idx" ON "public"."off_market_leads" USING "btree" ("score" DESC);



CREATE INDEX "properties_score_desc_idx" ON "public"."properties" USING "btree" ("score" DESC);



CREATE UNIQUE INDEX "properties_source_external_id_key" ON "public"."properties" USING "btree" ("source", "external_id");



CREATE UNIQUE INDEX "properties_source_key" ON "public"."properties" USING "btree" ("source", "source_id");



CREATE INDEX "scrape_runs_created_at_idx" ON "public"."scrape_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "scrape_runs_data_gin_idx" ON "public"."scrape_runs" USING "gin" ("data");



CREATE INDEX "scrape_runs_source_created_at_idx" ON "public"."scrape_runs" USING "btree" ("source", "created_at" DESC);



CREATE UNIQUE INDEX "uq_properties_source_external" ON "public"."properties" USING "btree" ("source", "external_id");



CREATE INDEX "waitlist_created_at_idx" ON "public"."waitlist" USING "btree" ("created_at" DESC);



CREATE OR REPLACE TRIGGER "set_updated_at_off_market_leads" BEFORE UPDATE ON "public"."off_market_leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "t_set_updated_at" BEFORE UPDATE ON "public"."deals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_off_market_leads_updated_at" BEFORE UPDATE ON "public"."off_market_leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_properties_listing_history_guard" BEFORE INSERT OR UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."properties_listing_history_guard"();



CREATE OR REPLACE TRIGGER "trg_sync_property_images" BEFORE INSERT OR UPDATE OF "imageurl", "image_urls" ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."sync_property_images"();



CREATE OR REPLACE TRIGGER "trigger_update_tradesman_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."tradesmen_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_tradesman_rating"();



ALTER TABLE ONLY "public"."saved_deals"
    ADD CONSTRAINT "saved_deals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tradesmen_leads"
    ADD CONSTRAINT "tradesmen_leads_tradesman_id_fkey" FOREIGN KEY ("tradesman_id") REFERENCES "public"."tradesmen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tradesmen_reviews"
    ADD CONSTRAINT "tradesmen_reviews_tradesman_id_fkey" FOREIGN KEY ("tradesman_id") REFERENCES "public"."tradesmen"("id") ON DELETE CASCADE;



CREATE POLICY "Allow inserts to properties" ON "public"."properties" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow read for anon" ON "public"."subscriptions" FOR SELECT USING (true);



CREATE POLICY "Allow read for anon" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Read deals" ON "public"."deals" FOR SELECT USING (true);



CREATE POLICY "Saved deals: delete own" ON "public"."saved_deals" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Saved deals: insert own" ON "public"."saved_deals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Saved deals: select own" ON "public"."saved_deals" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Saved deals: update own" ON "public"."saved_deals" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own notes" ON "public"."notes" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can update their own notes" ON "public"."notes" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view their own notes" ON "public"."notes" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



ALTER TABLE "public"."area_intel_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comps_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrichment_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert off_market public" ON "public"."off_market_deals" FOR INSERT WITH CHECK (true);



CREATE POLICY "insert saved_deals for all" ON "public"."saved_deals" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."investor_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investor_alerts_owner_delete" ON "public"."investor_alerts" FOR DELETE USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "investor_alerts_owner_insert" ON "public"."investor_alerts" FOR INSERT WITH CHECK (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "investor_alerts_owner_select" ON "public"."investor_alerts" FOR SELECT USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "investor_alerts_owner_update" ON "public"."investor_alerts" FOR UPDATE USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text"))) WITH CHECK (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "leads_service_policy" ON "public"."tradesmen_leads" TO "service_role" USING (true);



CREATE POLICY "leads_user_insert" ON "public"."tradesmen_leads" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "leads_user_select" ON "public"."tradesmen_leads" FOR SELECT USING ((("auth"."jwt"() ->> 'email'::"text") = "user_email"));



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."off_market_deals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."off_market_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "off_market_leads_delete_own" ON "public"."off_market_leads" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "off_market_leads_insert_own" ON "public"."off_market_leads" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "off_market_leads_select_own" ON "public"."off_market_leads" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "off_market_leads_update_own" ON "public"."off_market_leads" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."postcode_geo_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ppd_sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "properties_read_anon" ON "public"."properties" FOR SELECT TO "anon" USING (true);



CREATE POLICY "properties_read_auth" ON "public"."properties" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."property_enrichment_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read properties" ON "public"."properties" FOR SELECT TO "anon" USING (true);



CREATE POLICY "read off_market public" ON "public"."off_market_deals" FOR SELECT USING (true);



CREATE POLICY "read own customer" ON "public"."customers" FOR SELECT USING (("email" = ("auth"."jwt"() ->> 'email'::"text")));



CREATE POLICY "read own subs" ON "public"."subscriptions" FOR SELECT USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "read saved_deals for all" ON "public"."saved_deals" FOR SELECT USING (true);



CREATE POLICY "reviews_public_read" ON "public"."tradesmen_reviews" FOR SELECT USING (true);



CREATE POLICY "reviews_service_policy" ON "public"."tradesmen_reviews" TO "service_role" USING (true);



CREATE POLICY "reviews_user_insert" ON "public"."tradesmen_reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."saved_deals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scrape_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tradesmen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tradesmen_admin_full_access" ON "public"."tradesmen" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."tradesmen_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tradesmen_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tradesmen_select_public" ON "public"."tradesmen" FOR SELECT USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "analytics" TO "service_role";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."earth"() TO "postgres";
GRANT ALL ON FUNCTION "public"."earth"() TO "anon";
GRANT ALL ON FUNCTION "public"."earth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "anon";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."properties_listing_history_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."properties_listing_history_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."properties_listing_history_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_property_images"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_property_images"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_property_images"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tradesman_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tradesman_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tradesman_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT SELECT,INSERT ON TABLE "analytics"."search_clicks" TO "service_role";



GRANT UPDATE("clerk_user_id") ON TABLE "analytics"."search_clicks" TO "service_role";









GRANT ALL ON TABLE "public"."area_intel_cache" TO "anon";
GRANT ALL ON TABLE "public"."area_intel_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."area_intel_cache" TO "service_role";



GRANT ALL ON SEQUENCE "public"."area_intel_cache_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."area_intel_cache_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."area_intel_cache_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comps_cache" TO "anon";
GRANT ALL ON TABLE "public"."comps_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."comps_cache" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comps_cache_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comps_cache_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comps_cache_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."deals" TO "anon";
GRANT ALL ON TABLE "public"."deals" TO "authenticated";
GRANT ALL ON TABLE "public"."deals" TO "service_role";



GRANT ALL ON TABLE "public"."enrichment_jobs" TO "anon";
GRANT ALL ON TABLE "public"."enrichment_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."enrichment_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."enrichment_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."enrichment_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."enrichment_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."investor_alerts" TO "anon";
GRANT ALL ON TABLE "public"."investor_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."investor_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."off_market_deals" TO "anon";
GRANT ALL ON TABLE "public"."off_market_deals" TO "authenticated";
GRANT ALL ON TABLE "public"."off_market_deals" TO "service_role";



GRANT ALL ON TABLE "public"."off_market_leads" TO "anon";
GRANT ALL ON TABLE "public"."off_market_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."off_market_leads" TO "service_role";



GRANT ALL ON TABLE "public"."postcode_geo_cache" TO "anon";
GRANT ALL ON TABLE "public"."postcode_geo_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."postcode_geo_cache" TO "service_role";



GRANT ALL ON TABLE "public"."ppd_sales" TO "anon";
GRANT ALL ON TABLE "public"."ppd_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."ppd_sales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ppd_sales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ppd_sales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ppd_sales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."property_enrichment_cache" TO "anon";
GRANT ALL ON TABLE "public"."property_enrichment_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."property_enrichment_cache" TO "service_role";



GRANT ALL ON TABLE "public"."saved_deals" TO "anon";
GRANT ALL ON TABLE "public"."saved_deals" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_deals" TO "service_role";



GRANT ALL ON TABLE "public"."scrape_runs" TO "anon";
GRANT ALL ON TABLE "public"."scrape_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."scrape_runs" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tradesmen" TO "anon";
GRANT ALL ON TABLE "public"."tradesmen" TO "authenticated";
GRANT ALL ON TABLE "public"."tradesmen" TO "service_role";



GRANT ALL ON TABLE "public"."tradesmen_leads" TO "anon";
GRANT ALL ON TABLE "public"."tradesmen_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."tradesmen_leads" TO "service_role";



GRANT ALL ON TABLE "public"."tradesmen_reviews" TO "anon";
GRANT ALL ON TABLE "public"."tradesmen_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."tradesmen_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































  create policy "Anon can upload to off-market"
  on "storage"."objects"
  as permissive
  for insert
  to anon
with check (((bucket_id = 'off-market'::text) AND (lower(storage.extension(name)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text, 'gif'::text]))));



  create policy "Public read off-market"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'off-market'::text));



