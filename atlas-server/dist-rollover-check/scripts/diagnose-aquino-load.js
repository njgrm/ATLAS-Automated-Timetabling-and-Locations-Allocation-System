import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const faculty = await prisma.facultyMirror.findMany({
        where: {
            OR: [
                { lastName: { contains: 'AQUINO', mode: 'insensitive' } },
                { firstName: { contains: 'ELPIDIO', mode: 'insensitive' } },
                { contactInfo: { contains: 'aquino', mode: 'insensitive' } },
            ],
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            maxHoursPerWeek: true,
            ancillaryMinutesPerWeek: true,
            isActiveForScheduling: true,
        },
    });
    console.log('Matched faculty records:');
    console.log(JSON.stringify(faculty, null, 2));
    const latest = await prisma.generationRun.findFirst({
        where: { schoolId: 1, schoolYearId: 55, status: 'COMPLETED' },
        orderBy: { id: 'desc' },
    });
    if (!latest) {
        console.log('No completed generation run found.');
        return;
    }
    const entries = Array.isArray(latest.draftEntries) ? latest.draftEntries : [];
    console.log(`Latest run: ${latest.id} with ${entries.length} draft entries`);
    for (const member of faculty) {
        const assignedMinutes = entries
            .filter((entry) => entry.facultyId === member.id)
            .reduce((sum, entry) => sum + (Number(entry.durationMinutes) || 0), 0);
        const maxMinutes = Math.round((member.maxHoursPerWeek || 0) * 60);
        const ancillary = Math.max(0, Math.round(member.ancillaryMinutesPerWeek || 0));
        const effectiveMinutes = Math.max(0, maxMinutes - ancillary);
        console.log(`${member.lastName}, ${member.firstName} (id=${member.id}) assigned=${assignedMinutes} max=${maxMinutes} effective=${effectiveMinutes}`);
    }
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
