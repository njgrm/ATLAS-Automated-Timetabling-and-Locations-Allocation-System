import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check rooms that can serve as home rooms
  const homeRoomEligible = await prisma.room.findMany({
    where: {
      isTeachingSpace: true,
      building: { schoolId: 1, isTeachingBuilding: true }
    },
    select: {
      id: true,
      buildingId: true,
      buildingZoneId: true,
      type: true,
      capacity: true,
      name: true
    },
    take: 20
  });

  console.log('=== Eligible Home Rooms (first 20) ===');
  homeRoomEligible.forEach(r => {
    console.log(`Room ${r.id}: ${r.name} (type=${r.type}, capacity=${r.capacity}, zone=${r.buildingZoneId})`);
  });

  // Check sections by grade level
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
      gradeLevelName: true,
      enrolledCount: true,
      homeRoomId: true,
      buildingZoneId: true
    },
    orderBy: { gradeLevelId: 'asc' },
    take: 20
  });

  console.log('\n=== Sections (first 20) ===');
  sectionsByGrade.forEach(s => {
    console.log(`Section ${s.id}: ${s.name} (grade=${s.gradeLevelName}, enrolled=${s.enrolledCount}, homeRoom=${s.homeRoomId})`);
  });

  // Count sections by grade
  const gradeCount = await prisma.sectionMirror.groupBy({
    by: ['gradeLevelId', 'gradeLevelName'],
    where: { schoolId: 1, schoolYearId: 55, isStale: false },
    _count: { id: true }
  });

  console.log('\n=== Sections per Grade Level ===');
  gradeCount.forEach(g => {
    console.log(`Grade ${g.gradeLevelName}: ${g._count.id} sections`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
