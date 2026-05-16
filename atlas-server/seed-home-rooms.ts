/**
 * Seed homeRoomId and buildingZoneId for sections
 * This simulates the data that would come from EnrollPro in production
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding homeRoomId and buildingZoneId for sections...');

  try {
    // Get all teaching rooms that can serve as home rooms, grouped by building zone
    const homeRoomsRaw = await prisma.room.findMany({
      where: {
        isTeachingSpace: true,
        building: { schoolId: 1, isTeachingBuilding: true }
      },
      select: {
        id: true,
        buildingZoneId: true,
        buildingId: true,
        type: true,
      },
      orderBy: [{ buildingZoneId: 'asc' }, { id: 'asc' }]
    });

    const roomsByZone = new Map<string | null, number[]>();
    for (const room of homeRoomsRaw) {
      const zone = room.buildingZoneId || 'DEFAULT';
      if (!roomsByZone.has(zone)) {
        roomsByZone.set(zone, []);
      }
      roomsByZone.get(zone)!.push(room.id);
    }

    console.log(`📍 Found ${homeRoomsRaw.length} potential home rooms across ${roomsByZone.size} zones`);

    // Get all sections for this school year, grouped by grade level
    const sectionsByGrade = await prisma.sectionMirror.findMany({
      where: {
        schoolId: 1,
        schoolYearId: 55,
        isStale: false
      },
      select: {
        id: true,
        name: true,
        gradeLevelId: true,
        externalId: true
      },
      orderBy: [{ gradeLevelId: 'asc' }, { id: 'asc' }]
    });

    console.log(`📚 Found ${sectionsByGrade.length} sections to assign`);

    // Assign home rooms in round-robin fashion per grade level
    const gradeGroups = new Map<number, typeof sectionsByGrade>();
    for (const section of sectionsByGrade) {
      if (!gradeGroups.has(section.gradeLevelId)) {
        gradeGroups.set(section.gradeLevelId, []);
      }
      gradeGroups.get(section.gradeLevelId)!.push(section);
    }

    // Create assignment batches
    const updates: Array<{
      id: number;
      homeRoomId: number;
      buildingZoneId: string | null;
    }> = [];

    let assignedCount = 0;
    for (const [gradeLevel, sections] of gradeGroups) {
      // For each grade, cycle through zones, then cycle through rooms in each zone
      let zoneIndex = 0;
      let roomIndex = 0;

      const zones = Array.from(roomsByZone.keys());
      if (zones.length === 0) {
        console.warn('⚠️  No zones found, cannot assign home rooms');
        break;
      }

      for (const section of sections) {
        const currentZone = zones[zoneIndex % zones.length];
        const roomList = roomsByZone.get(currentZone) || [];

        if (roomList.length === 0) {
          console.warn(`⚠️  No rooms in zone ${currentZone}`);
          continue;
        }

        const homeRoomId = roomList[roomIndex % roomList.length];

        updates.push({
          id: section.id,
          homeRoomId,
          buildingZoneId: currentZone === 'DEFAULT' ? null : currentZone
        });

        roomIndex++;
        if (roomIndex % roomList.length === 0) {
          zoneIndex++;
          roomIndex = 0;
        }

        assignedCount++;
      }
    }

    // Apply updates in batches
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      for (const update of batch) {
        await prisma.sectionMirror.update({
          where: { id: update.id },
          data: {
            homeRoomId: update.homeRoomId,
            buildingZoneId: update.buildingZoneId
          }
        });
      }
      console.log(`✅ Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length} sections`);
    }

    console.log(`\n✅ Seeding complete! Assigned ${assignedCount} sections to home rooms`);

    // Verify
    const verify = await prisma.sectionMirror.findMany({
      where: {
        schoolId: 1,
        schoolYearId: 55,
        isStale: false,
        homeRoomId: { not: null }
      },
      select: { id: true },
      take: 1
    });

    if (verify.length > 0) {
      console.log('✅ Verification: Sample sections now have homeRoomId assigned');
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
