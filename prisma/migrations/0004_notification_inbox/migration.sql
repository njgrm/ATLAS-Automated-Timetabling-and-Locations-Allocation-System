-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "domain" VARCHAR(32) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "resource_type" VARCHAR(48),
    "resource_id" VARCHAR(64),
    "data" JSONB,
    "dedupe_key" VARCHAR(255) NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "idx_notifications_actor_read_created" ON "notifications"("actor_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_actor_created" ON "notifications"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "atlas_auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
