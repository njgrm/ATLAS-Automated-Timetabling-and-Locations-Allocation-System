-- Add teacher-move policy toggle to scheduling policies
ALTER TABLE "scheduling_policies"
ADD COLUMN "teacher_move_enabled" BOOLEAN NOT NULL DEFAULT false;
