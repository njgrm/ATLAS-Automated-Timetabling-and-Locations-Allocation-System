-- Phase 1a-2 completion: Add homeRoomId FK and buildingZoneId to section_mirrors.
-- These fields enable the Phase 2 Home-Room-First algorithm to assign sections
-- to their designated home room and zone before running generation.
ALTER TABLE "section_mirrors"
  ADD COLUMN "home_room_id" INTEGER REFERENCES "rooms"("id") ON DELETE SET NULL,
  ADD COLUMN "building_zone_id" VARCHAR(32);

CREATE INDEX "section_mirrors_home_room_id_idx"
  ON "section_mirrors"("home_room_id");

CREATE INDEX "section_mirrors_building_zone_id_idx"
  ON "section_mirrors"("building_zone_id");
