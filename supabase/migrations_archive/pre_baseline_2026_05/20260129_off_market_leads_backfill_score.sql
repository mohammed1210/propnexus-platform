-- Backfill score for legacy off-market leads.
-- Safe to run multiple times.

-- discount_percent derived if missing:
--   if estimated_value>0 and asking_price not null:
--     ((estimated_value - asking_price) / estimated_value)*100
--   else 0
-- score = clamp(round(discount*3 + yield*4 + bedrooms*3), 0..100)

UPDATE public.off_market_leads
SET
  discount_percent = COALESCE(
    discount_percent,
    CASE
      WHEN estimated_value IS NOT NULL
        AND estimated_value > 0
        AND asking_price IS NOT NULL
      THEN ((estimated_value - asking_price) / estimated_value) * 100
      ELSE 0
    END
  ),
  score = LEAST(
    100,
    GREATEST(
      0,
      ROUND(
        (
          COALESCE(
            COALESCE(
              discount_percent,
              CASE
                WHEN estimated_value IS NOT NULL
                  AND estimated_value > 0
                  AND asking_price IS NOT NULL
                THEN ((estimated_value - asking_price) / estimated_value) * 100
                ELSE 0
              END
            ),
            0
          ) * 3
        )
        + (COALESCE(yield_percent, 0) * 4)
        + (COALESCE(bedrooms, 0) * 3)
      )
    )
  )::int,
  updated_at = now()
WHERE COALESCE(score, 0) = 0;
