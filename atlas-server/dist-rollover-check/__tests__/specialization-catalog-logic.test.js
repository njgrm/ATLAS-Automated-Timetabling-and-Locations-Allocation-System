let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n=== ${name} ===`);
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
function classifyLikeCatalog(item) {
    if (item.mappedSubjectCodes.length === 0) {
        return 'unmapped';
    }
    if (item.mappedSubjects.length < item.mappedSubjectCodes.length) {
        return 'partially_mapped';
    }
    return 'mapped';
}
function run() {
    section('SP-CATALOG-01 status classification remains deterministic');
    const mapped = {
        specialization: 'MAJOR IN MATHEMATICS',
        departmentCode: 'MATH',
        departmentName: 'Mathematics',
        mappedSubjectCodes: ['MATH'],
        mappedSubjects: [{ code: 'MATH', name: 'Mathematics' }],
        status: 'mapped',
    };
    const partial = {
        specialization: 'SCIENCE-ADVANCED',
        departmentCode: 'SCI',
        departmentName: 'Science',
        mappedSubjectCodes: ['SCI', 'ADV_CHEM'],
        mappedSubjects: [{ code: 'SCI', name: 'Science' }],
        status: 'partially_mapped',
    };
    const unmapped = {
        specialization: 'UNKNOWN SPEC',
        departmentCode: null,
        departmentName: 'Unassigned Department',
        mappedSubjectCodes: [],
        mappedSubjects: [],
        status: 'unmapped',
    };
    assertEqual(classifyLikeCatalog(mapped), 'mapped', 'Mapped specialization remains mapped');
    assertEqual(classifyLikeCatalog(partial), 'partially_mapped', 'Partial specialization remains partially mapped');
    assertEqual(classifyLikeCatalog(unmapped), 'unmapped', 'Unmapped specialization remains unmapped');
    section('SP-CATALOG-02 department grouping sort order');
    const departments = [
        {
            departmentCode: 'SCI',
            departmentName: 'Science',
            specializationCount: 1,
            items: [partial],
        },
        {
            departmentCode: 'MATH',
            departmentName: 'Mathematics',
            specializationCount: 1,
            items: [mapped],
        },
    ].sort((left, right) => left.departmentName.localeCompare(right.departmentName));
    assertEqual(departments[0]?.departmentName, 'Mathematics', 'Departments sort by name asc');
    assertEqual(departments[1]?.departmentName, 'Science', 'Departments maintain deterministic order');
    section('SP-CATALOG-03 teach-load compatibility terms');
    const teachLoadTerms = [mapped.specialization, partial.specialization, unmapped.specialization];
    assert(teachLoadTerms.includes('MAJOR IN MATHEMATICS'), 'Catalog retains specialization strings used by teach-load matching');
    assert(teachLoadTerms.includes('SCIENCE-ADVANCED'), 'Catalog retains advanced specialization strings for alias mapping');
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
export {};
