import { buildFacultySeedAccounts } from '../services/local-auth.service.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label}`);
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}
function run() {
    const sample = [
        { id: 1, externalId: 1001, firstName: 'Maria', lastName: 'Santos' },
        { id: 2, externalId: 1002, firstName: 'Juan', lastName: 'Dela Cruz' },
        { id: 3, externalId: 1003, firstName: 'Maria', lastName: 'Santos' },
    ];
    section('SEED-EMAIL-01 base format rule');
    const output = buildFacultySeedAccounts(sample);
    const juan = output.find((row) => row.facultyId === 2);
    assert(Boolean(juan), 'Unique name account exists');
    if (juan) {
        assertEqual(juan.email, 'juan.dela@deped.edu.ph', 'Unique faculty uses firstname.lastname format');
    }
    section('SEED-EMAIL-02 duplicate fallback rule');
    const mariaRows = output.filter((row) => row.email.startsWith('maria.') && row.email.endsWith('.santos@deped.edu.ph'));
    assertEqual(mariaRows.length, 2, 'Duplicate names use firstname.m.lastname fallback');
    assert(mariaRows.every((row) => row.email.split('@')[0].split('.').length === 3), 'Duplicate emails include middle initial segment');
    section('SEED-EMAIL-03 deterministic output');
    const firstPass = buildFacultySeedAccounts(sample).map((row) => `${row.facultyId}:${row.email}`).join('|');
    const secondPass = buildFacultySeedAccounts(sample).map((row) => `${row.facultyId}:${row.email}`).join('|');
    assertEqual(firstPass, secondPass, 'Same seed input generates same email mapping');
    section('SEED-EMAIL-04 deped domain enforcement');
    assert(output.every((row) => row.email.endsWith('@deped.edu.ph')), 'All generated faculty emails use @deped.edu.ph domain');
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
//# sourceMappingURL=seed-email-rules.test.js.map