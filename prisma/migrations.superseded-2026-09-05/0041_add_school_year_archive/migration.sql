-- RR-09A: School-year archive lifecycle. Non-destructive: archived years keep
-- every row as read-only history and never win the active-year election.
ALTER TABLE "enrollpro_school_year_mirrors"
  ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_by" INTEGER,
  ADD COLUMN "archive_reason" VARCHAR(500);

CREATE INDEX "idx_enrollpro_school_year_mirror_archived"
  ON "enrollpro_school_year_mirrors"("school_id", "is_archived");
