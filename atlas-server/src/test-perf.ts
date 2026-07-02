import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const schoolId = 1;
  const schoolYearId = 1;
  
  console.time('findMany runs');
  const runCandidates = await prisma.generationRun.findMany({
    where: { schoolId, schoolYearId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      schoolYearId: true,
      status: true,
      createdAt: true,
      summary: true,
    },
  });
  console.timeEnd('findMany runs');
  
  console.log('Total runs found:', runCandidates.length);

  await prisma.$disconnect();
}

test().catch(console.error);
