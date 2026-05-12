const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  const run = await p.generationRun.findUnique({
    where: { id: 5 },
    select: { id: true, status: true, summary: true }
  });
  if (!run) { console.log('Run 5 not found'); return; }
  const summary = run.summary;
  console.log('Run 5 status:', run.status);
  console.log('Hard violations:', summary.hardViolationCount);
  console.log('Violation breakdown:', JSON.stringify(summary.violationCounts, null, 2));
  console.log('Unassigned by subject:', JSON.stringify((summary.unassignedBySubjectGrade || []).slice(0, 10), null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
