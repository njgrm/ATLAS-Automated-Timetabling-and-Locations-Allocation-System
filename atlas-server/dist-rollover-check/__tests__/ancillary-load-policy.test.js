import { computeEffectiveWeeklyTeachingMinutes } from '../services/scheduling-policy.service.js';
let passCount = 0;
let failCount = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label} — expected ${expected}, got ${actual}`);
}
function run() {
    console.log('\n═══ ANCILLARY-LOAD-POLICY ═══');
    assertEqual(computeEffectiveWeeklyTeachingMinutes(30, null), 1800, 'No ancillary deduction keeps full weekly minutes');
    assertEqual(computeEffectiveWeeklyTeachingMinutes(30, 120), 1680, 'Ancillary minutes are deducted from weekly capacity');
    assertEqual(computeEffectiveWeeklyTeachingMinutes(5, 9999), 0, 'Effective weekly minutes never go negative');
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
