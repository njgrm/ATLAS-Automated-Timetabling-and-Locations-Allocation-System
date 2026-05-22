-- Phase 3 subject contract reset: remove day-pattern persistence

ALTER TABLE subjects
  DROP COLUMN IF EXISTS session_pattern;

DROP TYPE IF EXISTS session_pattern;
