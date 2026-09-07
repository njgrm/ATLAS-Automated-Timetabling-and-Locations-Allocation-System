-- Make teacher move enabled by default and align existing records
ALTER TABLE "scheduling_policies"
ALTER COLUMN "teacher_move_enabled" SET DEFAULT true;

UPDATE "scheduling_policies"
SET "teacher_move_enabled" = true
WHERE "teacher_move_enabled" = false;