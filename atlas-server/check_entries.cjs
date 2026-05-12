const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  const run = await p.generationRun.findUnique({ where: { id: 5 }, select: { draftEntries: true } });
  const entries = Array.isArray(run?.draftEntries) ? run.draftEntries : [];
  console.log('Total entries in run 5:', entries.length);
  
  // Count by subjectId
  const bySub = {};
  for (const e of entries) {
    bySub[e.subjectId] = (bySub[e.subjectId] || 0) + 1;
  }
  // Show subjects with unexpected violations
  const violSubjects = [10,11,12,13,14,15,17,20,36,47];
  console.log('Entries for violation subjects:', JSON.stringify(
    Object.fromEntries(violSubjects.map(s => [s, bySub[s] || 0]))
  ));
  
  // Show one entry for subject 10
  const s10 = entries.find(e => e.subjectId === 10);
  if (s10) console.log('Sample subject-10 entry:', JSON.stringify(s10));
  
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
