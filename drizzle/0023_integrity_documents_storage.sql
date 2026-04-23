-- ═══════════════════════════════════════════════════════════════════
-- 0023: Integrity – document storage + multiple submitter sources
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add storage_path to integrity_documents
--    (Supabase Storage bucket path, e.g. "integrity-documents/123/ruling.pdf")
ALTER TABLE integrity_documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 2. Add submitter_sources to integrity_cases
--    JSONB array of URLs submitted by the public via the ethics-request form.
--    Format: [{ "url": "https://...", "label": "optional label" }]
ALTER TABLE integrity_cases
  ADD COLUMN IF NOT EXISTS submitter_sources JSONB DEFAULT '[]'::jsonb;
