-- Check if home_room_id and building_zone_id columns exist
SELECT column_name FROM information_schema.columns WHERE table_name='section_mirrors' AND column_name IN ('home_room_id', 'building_zone_id');
