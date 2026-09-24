-- D9 — teacher lunch window policy switches (additive, safe defaults).
-- `enable_teacher_lunch_window` defaults ON; `enforce_teacher_lunch_window`
-- defaults OFF so the constraint is a SOFT warning until an operator makes it a
-- hard publication blocker. No migration is applied by this candidate.
ALTER TABLE "scheduling_policies"
    ADD COLUMN "enable_teacher_lunch_window" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "enforce_teacher_lunch_window" BOOLEAN NOT NULL DEFAULT false;
