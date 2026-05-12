const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  // Check pre-generation drafts
  const drafts = await p.preGenerationDraft.findMany({ 
    where: { schoolId: 1 },
    select: { id: true, subjectId: true, facultyId: true, sectionId: true, status: true }
  });
  console.log('Pre-generation drafts count:', drafts.length);
  if (drafts.length > 0) {
    const bySub = {};
    drafts.forEach(d => { bySub[d.subjectId] = (bySub[d.subjectId] || 0) + 1; });
    console.log('By subject:', JSON.stringify(bySub));
    console.log('First 3:', JSON.stringify(drafts.slice(0,3)));
  }
  
  // Check demand items generated for isSeedable=false subjects
  // Look at GenerationRun 5 draftEntries for subjectId 10
  const run = await p.generationRun.findUnique({ where: { id: 5 }, select: { draftEntries: true } });
  const entries = run?.draftEntries || [];
  const ict_entries = entries.filter(e => e.subjectId === 10);
  console.log('ICT sessions in run 5:', ict_entries.length);
  if (ict_entries.length > 0) {
    console.log('Sample ICT entry:', JSON.stringify(ict_entries[0]));
  }
  
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
