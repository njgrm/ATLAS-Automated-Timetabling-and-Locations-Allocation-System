/**
 * preference-lifecycle-lock.test.ts
 *
 * Unit tests for checkPreferenceWindow() in preference.service.ts.
 *
 * The ATLAS lifecycle phase is a module-level constant in the preference router
 * (process.env.ATLAS_LIFECYCLE_PHASE read once at import time), so the lock
 * behaviour is best verified by testing the service function directly.
 *
 * Covers:
 *  - PREFERENCE_COLLECTION → null (editable)
 *  - SETUP                 → null (editable, pre-collection window)
 *  - GENERATION            → PREFERENCE_LOCKED (hard lock)
 *  - REVIEW                → PREFERENCE_LOCKED
 *  - PUBLISHED             → PREFERENCE_LOCKED
 *  - ARCHIVED              → PREFERENCE_LOCKED
 */
import { checkPreferenceWindow } from '../services/preference.service.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
    }
    else {
        failCount += 1;
        console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
    }
}
function assertNull(value, label) {
    assertEqual(value, null, label);
}
function run() {
    /* ── Editable phases ── */
    section('Editable phases return null (window open)');
    assertNull(checkPreferenceWindow('PREFERENCE_COLLECTION'), 'PREFERENCE_COLLECTION → null');
    assertNull(checkPreferenceWindow('SETUP'), 'SETUP → null');
    /* ── Locked phases ── */
    section('Post-collection phases return PREFERENCE_LOCKED (422)');
    const lockedPhases = ['GENERATION', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];
    for (const phase of lockedPhases) {
        const result = checkPreferenceWindow(phase);
        assertEqual(result?.statusCode, 422, `${phase} → statusCode 422`);
        assertEqual(result?.code, 'PREFERENCE_LOCKED', `${phase} → code PREFERENCE_LOCKED`);
    }
    /* ── Message specificity ── */
    section('Lock message includes the current phase name');
    const genResult = checkPreferenceWindow('GENERATION');
    const hasPhaseInMessage = genResult?.message?.includes('GENERATION') ?? false;
    assertEqual(hasPhaseInMessage, true, 'GENERATION lock message mentions GENERATION phase');
    console.log(`\n─── Results: ${passCount} passed, ${failCount} failed ───`);
    if (failCount > 0)
        process.exitCode = 1;
}
run();
//# sourceMappingURL=preference-lifecycle-lock.test.js.map