-- Convert ai_summary from text to jsonb (multilingual: {he, en, ar, ru})
-- Preserve any existing Hebrew-only text values
ALTER TABLE "bills"
  ALTER COLUMN "ai_summary" TYPE jsonb
  USING CASE
    WHEN "ai_summary" IS NOT NULL THEN jsonb_build_object('he', "ai_summary")
    ELSE NULL
  END;

-- Add ai_topics as jsonb (multilingual: {he: [...], en: [...], ar: [...], ru: [...]})
ALTER TABLE "bills" ADD COLUMN "ai_topics" jsonb;
