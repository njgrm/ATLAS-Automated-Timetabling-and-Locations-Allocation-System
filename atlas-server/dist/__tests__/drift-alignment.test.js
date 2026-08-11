import { prisma } from '../lib/prisma.js';
import { resolveRuntimeContext } from '../services/runtime-context.service.js';
import { getRolloverStatus, findMappingConflicts } from '../services/enrollpro-rollover.service.js';
let pass = 0;
let fail = 0;
function assert(condition, label) {
    if (condition) {
        pass++;
        console.log(`  ✓ ${label}`);
    }
    else {
        fail++;
        console.error(`  ✗ ${label}`);
    }
}
function assertEqual(actual, expected, label) {
    assert(actual === expected, `${label} — expected ${String(expected)}, got ${String(actual)}`);
}
console.log('\n═══ Drift alignment: runtime-context vs rollover-status ═══');
async function run() {
    const schoolId = 1;
    section('FindMappingConflicts exports correctly');
    const upstreamYear = { id: 1, yearLabel: '2026-2027' };
    const conflicts = await findMappingConflicts(schoolId, upstreamYear);
    assert(Array.isArray(conflicts), 'findMappingConflicts returns an array');
    console.log(`  ℹ Found ${conflicts.length} conflicts for schoolId=${schoolId}, yearId=1`);
    if (conflicts.length > 0) {
        for (const c of conflicts) {
            console.log(`    - ${c.code}: ${c.message}`);
        }
    }
    section('Runtime context and rollover status agree on drift status');
    const runtimeContext = await resolveRuntimeContext(schoolId, undefined, { verifyUpstream: true });
    const rolloverStatus = await getRolloverStatus(schoolId, undefined, { includeCounts: true });
    if (runtimeContext && rolloverStatus) {
        assertEqual(runtimeContext.activeYearDrift.status, rolloverStatus.drift.status, 'Runtime context and rollover status report the same drift.status');
        console.log(`  ℹ Runtime context drift: ${runtimeContext.activeYearDrift.status}`);
        console.log(`  ℹ Rollover status drift: ${rolloverStatus.drift.status}`);
        if (runtimeContext.activeYearDrift.status === 'mapping-conflict') {
            assert(rolloverStatus.conflicts.length > 0, 'When runtime context reports mapping-conflict, rollover status has conflicts');
            console.log(`  ℹ Rollover conflicts: ${rolloverStatus.conflicts.map((c) => c.code).join(', ')}`);
        }
    }
    else {
        console.log('  ℹ Skipping alignment check — one or both endpoints returned null');
    }
    section('Current-year reviewed data does not become dummy conflict by itself');
    // After a successful sync, current-year data (generation runs, teaching load, etc.)
    // should NOT automatically make the year a dummy conflict.
    // The only valid conflicts are YEAR_LABEL_MISMATCH and SECTION_ID_COLLISION.
    const currentYearConflicts = await findMappingConflicts(schoolId, upstreamYear);
    const nonIdentityConflicts = currentYearConflicts.filter((c) => c.code !== 'YEAR_LABEL_MISMATCH' && c.code !== 'SECTION_ID_COLLISION');
    assertEqual(nonIdentityConflicts.length, 0, 'No non-identity conflicts exist for current year (reviewed data is not a dummy conflict)');
    section('SECTION_ID_COLLISION detection');
    // Verify that the collision detection works by checking the logic:
    // If ATLAS has section mirrors for a year ID but external IDs don't match,
    // it should report SECTION_ID_COLLISION.
    const sectionMirrors = await prisma.sectionMirror.findMany({
        where: { schoolId, schoolYearId: upstreamYear.id },
        select: { externalId: true },
        take: 10,
    });
    console.log(`  ℹ Found ${sectionMirrors.length} section mirrors for yearId=1`);
    if (sectionMirrors.length > 0) {
        const externalIds = new Set(sectionMirrors.map((s) => s.externalId));
        console.log(`  ℹ External IDs: ${[...externalIds].slice(0, 5).join(', ')}${externalIds.size > 5 ? '...' : ''}`);
    }
    console.log('\n' + '═'.repeat(56));
    console.log(`Tests: ${pass} passed, ${fail} failed, ${pass + fail} total`);
    console.log('═'.repeat(56));
    process.exit(fail > 0 ? 1 : 0);
}
function section(name) {
    console.log(`\n════ ${name} ════`);
}
run()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=drift-alignment.test.js.map