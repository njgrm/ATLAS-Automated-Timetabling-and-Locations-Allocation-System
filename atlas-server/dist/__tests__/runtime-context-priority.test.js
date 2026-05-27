import { pickBestRuntimeYear } from '../services/runtime-context.service.js';
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
function isoDaysAgo(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
console.log('\n═══ Runtime context year-priority regression ═══');
{
    const evidence = [
        { yearId: 1, type: 'scheduling-policy', timestamp: isoDaysAgo(0.1), source: 'atlas.scheduling_policy' },
        { yearId: 55, type: 'section-mirror', timestamp: isoDaysAgo(0.2), source: 'atlas.section_mirror' },
        { yearId: 55, type: 'section-snapshot', timestamp: isoDaysAgo(0.2), source: 'atlas.section_snapshot:enrollpro' },
        { yearId: 55, type: 'faculty-snapshot', timestamp: isoDaysAgo(0.3), source: 'atlas.faculty_snapshot:enrollpro' },
    ];
    const selected = pickBestRuntimeYear(evidence);
    assert(selected?.yearId === 55, 'Mirror/snapshot evidence outranks single scheduling-policy row when both are fresh');
}
{
    const evidence = [
        { yearId: 55, type: 'section-mirror', timestamp: isoDaysAgo(50), source: 'atlas.section_mirror' },
        { yearId: 1, type: 'scheduling-policy', timestamp: isoDaysAgo(0.05), source: 'atlas.scheduling_policy' },
    ];
    const selected = pickBestRuntimeYear(evidence);
    assert(selected?.yearId === 1, 'Fresh policy wins when mirror evidence is far outside freshness window');
}
{
    const evidence = [
        { yearId: 77, type: 'section-snapshot', timestamp: isoDaysAgo(3), source: 'atlas.section_snapshot:enrollpro' },
        { yearId: 77, type: 'generation-run', timestamp: isoDaysAgo(3.1), source: 'atlas.generation_run' },
        { yearId: 55, type: 'section-snapshot', timestamp: isoDaysAgo(3), source: 'atlas.section_snapshot:enrollpro' },
        { yearId: 55, type: 'generation-run', timestamp: isoDaysAgo(3.1), source: 'atlas.generation_run' },
        { yearId: 55, type: 'faculty-snapshot', timestamp: isoDaysAgo(0.05), source: 'atlas.faculty_snapshot:enrollpro' },
    ];
    const selected = pickBestRuntimeYear(evidence);
    assert(selected?.yearId === 55, 'Additional fresh corroborating evidence breaks ties between similar year candidates');
}
console.log('\n' + '═'.repeat(56));
console.log(`Tests: ${pass} passed, ${fail} failed, ${pass + fail} total`);
console.log('═'.repeat(56));
process.exit(fail > 0 ? 1 : 0);
//# sourceMappingURL=runtime-context-priority.test.js.map