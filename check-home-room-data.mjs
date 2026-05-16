import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.sectionMirror.findMany({
    where: {
      id: {
        in: [2747, 2750, 2755, 2756, 2758]
      }
    },
    select: {
      id: true,
      name: true,
      homeRoomId: true,
      buildingZoneId: true,
      enrolledCount: true,
    }
  });

  console.log('=== Section Home-Room Data ===');
  sections.forEach(s => {
    console.log(`Section ${s.id} (${s.name}): homeRoomId=${s.homeRoomId}, buildingZoneId=${s.buildingZoneId}`);
  });

  const withHomeRooms = sections.filter(s => s.homeRoomId != null).length;
  console.log(`\nTotal with homeRoomId: ${withHomeRooms}/${sections.length}`);

  // Check a recent generation run's summary
  const latestRun = await prisma.generationRun.findFirst({
    where: {
      status: 'COMPLETED'
    },
    orderBy: {
      finishedAt: 'desc'
    }
  });

  if (latestRun) {
    console.log(`\n=== Latest Generation Run (${latestRun.id}) Summary ===`);
    const summary = latestRun.summary;
    console.log(`roomerStrategy: ${summary?.roomerStrategy}`);
    console.log(`homeRoomAttemptedCount: ${summary?.homeRoomAttemptedCount}`);
    console.log(`homeRoomAssignedCount: ${summary?.homeRoomAssignedCount}`);
    console.log(`homeRoomSuccessRate: ${summary?.homeRoomSuccessRate}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
