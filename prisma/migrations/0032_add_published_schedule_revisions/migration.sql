-- CreateEnum
CREATE TYPE "published_revision_status" AS ENUM ('DRAFT', 'SCHEDULED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "published_schedule_revisions" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "source_run_id" INTEGER NOT NULL,
    "source_revision_id" INTEGER,
    "status" "published_revision_status" NOT NULL DEFAULT 'SCHEDULED',
    "effective_date" TIMESTAMP(3) NOT NULL,
    "actor_id" INTEGER,
    "reason" VARCHAR(500) NOT NULL,
    "change_set" JSONB NOT NULL,
    "change_summary" JSONB,
    "previous_values" JSONB NOT NULL,
    "new_values" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_schedule_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "published_schedule_revisions_school_id_school_year_id_effective_date_idx" ON "published_schedule_revisions"("school_id", "school_year_id", "effective_date");

-- CreateIndex
CREATE INDEX "published_schedule_revisions_source_run_id_effective_date_idx" ON "published_schedule_revisions"("source_run_id", "effective_date");

-- CreateIndex
CREATE INDEX "published_schedule_revisions_source_revision_id_idx" ON "published_schedule_revisions"("source_revision_id");

-- CreateIndex
CREATE INDEX "published_schedule_revisions_status_idx" ON "published_schedule_revisions"("status");

-- AddForeignKey
ALTER TABLE "published_schedule_revisions" ADD CONSTRAINT "published_schedule_revisions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_schedule_revisions" ADD CONSTRAINT "published_schedule_revisions_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "generation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_schedule_revisions" ADD CONSTRAINT "published_schedule_revisions_source_revision_id_fkey" FOREIGN KEY ("source_revision_id") REFERENCES "published_schedule_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;