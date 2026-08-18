import { prisma } from '../lib/prisma.js';
async function main() {
    const run = await prisma.generationRun.findFirst({
        where: { schoolId: 1, status: 'COMPLETED', schoolYearId: 5 },
        select: { draftEntries: true },
    });
    if (run && run.draftEntries) {
        const entries = run.draftEntries;
        console.log('Total entries:', entries.length);
        console.log('First 5 entries:', entries.slice(0, 5).map(e => ({ sectionId: e.sectionId, type: typeof e.sectionId })));
        const sectionIds = [...new Set(entries.map(e => e.sectionId))];
        console.log('Unique sectionIds:', sectionIds.slice(0, 10));
    }
    await prisma.$disconnect();
}
main();
//# sourceMappingURL=check-section-ids.js.map