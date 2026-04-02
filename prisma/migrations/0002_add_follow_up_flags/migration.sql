-- CreateTable
CREATE TABLE "follow_up_flags" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "entry_id" TEXT NOT NULL,
    "note" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_flags_run_id_entry_id_key" ON "follow_up_flags"("run_id", "entry_id");

-- CreateIndex
CREATE INDEX "follow_up_flags_run_id_idx" ON "follow_up_flags"("run_id");
