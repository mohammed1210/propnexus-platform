-- Migration: Add unique index on properties(source, external_id)
-- Date: 2025-11-10
-- Purpose: Prevent duplicate properties from the same source with the same external_id
-- This ensures data integrity when scrapers import properties multiple times

create unique index if not exists uq_properties_source_external
on properties (source, external_id);
