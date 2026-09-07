-- Wave 2: Session pattern preference, consecutive lab toggle, capacity-aware hardening

-- Create session_pattern enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_pattern') THEN
    CREATE TYPE "session_pattern" AS ENUM ('MWF', 'TTH', 'ANY');
  END IF;
END
$$;

-- Add sessionPattern to subjects (default ANY preserves existing behavior)
ALTER TABLE "subjects"
ADD COLUMN IF NOT EXISTS "session_pattern" "session_pattern" NOT NULL DEFAULT 'ANY';

-- Add allowConsecutiveLabSessions to scheduling_policies (default false = strict)
ALTER TABLE "scheduling_policies"
ADD COLUMN IF NOT EXISTS "allow_consecutive_lab_sessions" BOOLEAN NOT NULL DEFAULT false;
