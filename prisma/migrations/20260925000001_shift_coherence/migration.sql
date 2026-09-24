-- D11 — shift-coherence guard policy switches (additive, safe defaults).
-- `enable_shift_coherence_guard` defaults ON so the advisory is visible;
-- `enforce_shift_coherence_guard` defaults OFF so auto-fill only warns until an
-- operator makes it a hard auto-fill filter. Additive only: two columns, no
-- data change, no destructive statement. This migration is NOT applied by this
-- candidate; it is schema/SQL validated (`prisma validate`).
--
-- Generated with:
--   prisma migrate diff --from-schema-datamodel <base> --to-schema-datamodel prisma/schema.prisma --script
ALTER TABLE "scheduling_policies"
    ADD COLUMN "enable_shift_coherence_guard" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "enforce_shift_coherence_guard" BOOLEAN NOT NULL DEFAULT false;
