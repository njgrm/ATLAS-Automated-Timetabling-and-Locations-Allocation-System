/**
 * Wave 3.5.2 Realistic Seeder — EnrollPro-first by default, fixture mode by explicit opt-in.
 *
 * Default behavior mirrors live EnrollPro contracts into ATLAS caches and mirrors.
 * The legacy ATLAS-owned fixture dataset remains available only for explicit dev-only use.
 * Optional campus-map seeding remains supported in both modes.
 *
 * Usage:
 *   npx tsx src/scripts/seed-realistic.ts --schoolId=1 --schoolYearId=1 --reset
 *   npx tsx src/scripts/seed-realistic.ts --schoolId=1 --schoolYearId=1 --mode=atlas-fixture --confirmFixtureBypass=true --withCachedSnapshots
 *   npx tsx src/scripts/seed-realistic.ts --schoolId=1 --schoolYearId=1 --seedMap=true --resetMap=true
 */
export {};
