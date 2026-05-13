import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const ALIAS_MAPPINGS = [
    { alias: 'Filipino', canonical: 'FIL' },
    { alias: 'English', canonical: 'ENG' },
    { alias: 'Mathematics', canonical: 'MATH' },
    { alias: 'Science', canonical: 'SCI' },
    { alias: 'Araling Panlipunan', canonical: 'AP' },
    { alias: 'MAPEH', canonical: 'MAPEH' },
    { alias: 'Edukasyon sa Pagpapakatao', canonical: 'ESP' },
    { alias: 'Technology and Livelihood Education', canonical: 'TLE' },
    { alias: 'Homeroom Guidance', canonical: 'HG' },
    { alias: 'Languages', canonical: 'ENG' }, // Extra example
    { alias: 'Social Studies', canonical: 'AP' }, // Extra example
    { alias: 'Values', canonical: 'ESP' }, // Fix: VE does not exist, ESP = Edukasyon sa Pagpapakatao
    { alias: 'Guidance', canonical: 'HG' } // Extra example
];
async function main() {
    const schoolId = 1;
    console.log('🌱 Seeding Specialization Aliases...');
    for (const mapping of ALIAS_MAPPINGS) {
        // First ensure the canonical subject actually exists
        const subject = await prisma.subject.findFirst({
            where: { schoolId, code: mapping.canonical }
        });
        if (!subject) {
            console.log(`⚠️  Skipping ${mapping.alias} -> ${mapping.canonical} (Subject ${mapping.canonical} not found)`);
            continue;
        }
        await prisma.specializationAlias.upsert({
            where: {
                schoolId_canonical_alias: {
                    schoolId,
                    canonical: mapping.canonical,
                    alias: mapping.alias
                }
            },
            update: {
                canonical: mapping.canonical
            },
            create: {
                schoolId,
                alias: mapping.alias,
                canonical: mapping.canonical
            }
        });
        console.log(`✅ Mapped "${mapping.alias}" -> ${mapping.canonical}`);
    }
    console.log('🎉 Specialization aliases seeded successfully!');
}
main()
    .catch((e) => {
    console.error('Failed to seed specialization aliases:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-specialization-aliases.js.map