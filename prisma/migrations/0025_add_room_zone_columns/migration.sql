-- Phase 1a-2: Add zone metadata to rooms for future home-room routing.
ALTER TABLE "rooms"
  ADD COLUMN "floor_number" INTEGER,
  ADD COLUMN "building_zone_id" VARCHAR(32);

UPDATE "rooms"
SET "floor_number" = "floor"
WHERE "floor_number" IS NULL;

CREATE INDEX "rooms_building_zone_id_idx"
  ON "rooms"("building_zone_id");
