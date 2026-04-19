-- Migration 007: AI call telemetry
-- Purely additive. No existing table is altered.
-- Safe to run multiple times (all IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS ai_calls (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  action          TEXT NOT NULL,           -- coaching-insight | assessment-summary | ...
  route_tier      TEXT,                    -- small | mid | frontier | local
  provider        TEXT NOT NULL,           -- cloud | ollama
  model           TEXT NOT NULL,
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  cost_cents      NUMERIC(10,4),           -- fractional cents, 4dp
  latency_ms      INTEGER,
  contact_id      INTEGER,                 -- nullable; no FK to avoid coupling
  status          TEXT NOT NULL DEFAULT 'ok', -- ok | error | fallback
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_calls_created_at ON ai_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_calls_action     ON ai_calls (action);
CREATE INDEX IF NOT EXISTS idx_ai_calls_model      ON ai_calls (model);
CREATE INDEX IF NOT EXISTS idx_ai_calls_tier       ON ai_calls (route_tier);
