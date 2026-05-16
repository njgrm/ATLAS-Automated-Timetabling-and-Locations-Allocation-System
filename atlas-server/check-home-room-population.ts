import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Use Prisma's type-safe method instead of raw SQL
  const sections = await prisma.sectionMirror.findMany({
    where: {
      schoolId: 1,
      schoolYearId: 55,
      isStale: false
    },
    select: {
      id: true,
      name: true,
      homeRoomId: true,
      buildingZoneId: true,
      externalId: true
    },
    take: 10
  });

  console.log('=== Sample Sections ===');
  let withHomeRoom = 0;
  sections.forEach(s => {
    if (s.homeRoomId != null) withHomeRoom++;
    console.log(`${s.externalId} ${s.name}: homeRoomId=${s.homeRoomId}, buildingZoneId=${s.buildingZoneId}`);
  });

  console.log(`\nTotal with homeRoomId: ${withHomeRoom}/${sections.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
