import { prisma } from '../lib/prisma.js';
import { buildSectionRosterIndex } from './faculty-assignment-scope.service.js';
import { sectionAdapter } from './section-adapter.js';
import { ensureDefaultSubjects } from './subject.service.js';
const SUBJECT_PRIORITY = new Map([
    ['FIL', 1],
    ['ENG', 2],
    ['MATH', 3],
    ['SCI', 4],
    ['AP', 5],
    ['MAPEH', 6],
    ['VE', 7],
    ['TLE', 8],
    ['HG', 9],
]);
const JHS_DEPT_KEYWORDS = {
    mathematics: ['math', 'mathematics', 'algebra', 'geometry', 'statistics'],
    science: ['sci', 'science', 'biology', 'chemistry', 'physics', 'earth'],
    english: ['eng', 'english', 'reading', 'literature', 'oral'],
    filipino: ['fil', 'filipino', 'wika'],
    'araling panlipunan': ['ap', 'araling', 'panlipunan', 'social'],
    mapeh: ['mapeh', 'music', 'arts', 'pe', 'physical', 'health'],
    'technology and livelihood education': ['tle', 'technology', 'livelihood', 'cookery', 'ict', 'agri', 'industrial', 'home economics'],
    'edukasyon sa pagpapakatao': ['values', 'edukasyon', 'pagpapakatao', 'esp', 've'],
    'homeroom guidance': ['homeroom', 'guidance', 'hg'],
};
const DEPARTMENT_ALIASES = {
    'social studies': 'araling panlipunan',
    ap: 'araling panlipunan',
    theology: 'edukasyon sa pagpapakatao',
    'values education': 'edukasyon sa pagpapakatao',
    esp: 'edukasyon sa pagpapakatao',
    tleb: 'technology and livelihood education',
    tle: 'technology and livelihood education',
};
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function containsTerm(haystack, needle) {
    if (!needle.includes(' ')) {
        return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`, 'i').test(haystack);
    }
    return haystack.includes(needle);
}
function normalizeDepartment(department) {
    const lowered = department?.trim().toLowerCase() ?? '';
    if (!lowered)
        return null;
    for (const [alias, canonical] of Object.entries(DEPARTMENT_ALIASES)) {
        if (containsTerm(lowered, alias)) {
            return canonical;
        }
    }
    for (const key of Object.keys(JHS_DEPT_KEYWORDS)) {
        if (containsTerm(lowered, key)) {
            return key;
        }
    }
    return null;
}
function isHomeroomSubject(subject) {
    const code = subject.code.trim().toLowerCase();
    const name = subject.name.trim().toLowerCase();
    return code === 'hg' || code.includes('homeroom') || name.includes('homeroom guidance') || name.includes('homeroom');
}
function matchesFacultySubject(department, subject) {
    if (isHomeroomSubject(subject)) {
        return normalizeDepartment(department) === 'homeroom guidance';
    }
    const normalizedDepartment = normalizeDepartment(department);
    if (!normalizedDepartment)
        return false;
    const code = subject.code.trim().toLowerCase();
    const name = subject.name.trim().toLowerCase();
    const keywords = JHS_DEPT_KEYWORDS[normalizedDepartment] ?? [];
    return keywords.some((keyword) => code.includes(keyword) || name.includes(keyword));
}
function supportsSecondaryCoverage(department, subject) {
    const normalizedDepartment = normalizeDepartment(department);
    if (normalizedDepartment !== 'homeroom guidance') {
        return false;
    }
    const code = subject.code.trim().toLowerCase();
    const name = subject.name.trim().toLowerCase();
    return code === 've' || name.includes('values education');
}
function subjectSort(left, right) {
    const leftPriority = SUBJECT_PRIORITY.get(left.code) ?? 99;
    const rightPriority = SUBJECT_PRIORITY.get(right.code) ?? 99;
    return leftPriority - rightPriority || left.code.localeCompare(right.code) || left.name.localeCompare(right.name) || left.id - right.id;
}
function sectionSort(left, right) {
    return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id - right.id;
}
function pairSort(left, right) {
    return left.candidateIds.length - right.candidateIds.length || sectionSort(left.section, right.section) || subjectSort(left.subject, right.subject);
}
function percentile(values, ratio) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return Number(sorted[index].toFixed(2));
}
function buildLoadStats(loadHours) {
    if (loadHours.length === 0) {
        return { min: 0, p50: 0, p95: 0, max: 0, mean: 0 };
    }
    const sorted = [...loadHours].sort((left, right) => left - right);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    return {
        min: Number(sorted[0].toFixed(2)),
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        max: Number(sorted[sorted.length - 1].toFixed(2)),
        mean: Number((total / sorted.length).toFixed(2)),
    };
}
async function loadGradeLevels(input) {
    if (input.gradeLevels) {
        return { gradeLevels: input.gradeLevels, source: 'provided' };
    }
    const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(input.schoolYearId, input.schoolId, input.authToken);
    return { gradeLevels: sectionResult.gradeLevels, source: sectionResult.source };
}
async function loadSeedInputs(input) {
    await ensureDefaultSubjects(input.schoolId);
    const [{ gradeLevels, source }, faculty, subjects] = await Promise.all([
        loadGradeLevels(input),
        prisma.facultyMirror.findMany({
            where: { schoolId: input.schoolId, isStale: false, isActiveForScheduling: true },
            select: {
                id: true,
                externalId: true,
                firstName: true,
                lastName: true,
                department: true,
                canTeachOutsideDepartment: true,
                maxHoursPerWeek: true,
                advisedSectionId: true,
                isClassAdviser: true,
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        }),
        prisma.subject.findMany({
            where: { schoolId: input.schoolId, isActive: true },
            select: { id: true, code: true, name: true, minMinutesPerWeek: true, gradeLevels: true },
            orderBy: [{ isSeedable: 'desc' }, { code: 'asc' }, { id: 'asc' }],
        }),
    ]);
    const sections = buildSectionRosterIndex(gradeLevels).sectionMap;
    return {
        gradeLevels,
        sectionSource: source,
        sections: [...sections.values()].sort(sectionSort),
        faculty: faculty,
        subjects: subjects.sort(subjectSort),
    };
}
function buildPairDefinitions(sections, subjects, faculty) {
    const facultyIdsByAdvisedSection = new Map();
    for (const member of faculty) {
        if (member.advisedSectionId) {
            facultyIdsByAdvisedSection.set(member.advisedSectionId, member.id);
        }
    }
    const pairDefinitions = [];
    for (const section of sections) {
        const gradeSubjects = subjects.filter((subject) => subject.gradeLevels.includes(section.displayOrder));
        for (const subject of gradeSubjects) {
            let candidateIds = [];
            if (isHomeroomSubject(subject)) {
                const adviserId = facultyIdsByAdvisedSection.get(section.id);
                candidateIds = adviserId ? [adviserId] : [];
            }
            else {
                const direct = faculty.filter((member) => matchesFacultySubject(member.department, subject)).map((member) => member.id);
                const secondary = faculty.filter((member) => supportsSecondaryCoverage(member.department, subject)).map((member) => member.id);
                candidateIds = direct.length > 0 || secondary.length > 0
                    ? [...new Set([...direct, ...secondary])]
                    : faculty.filter((member) => member.canTeachOutsideDepartment).map((member) => member.id);
            }
            pairDefinitions.push({
                key: `${subject.id}:${section.id}`,
                section,
                subject,
                candidateIds,
                minutes: subject.minMinutesPerWeek,
            });
        }
    }
    return pairDefinitions.sort(pairSort);
}
function getFacultyCapacityMinutes(member, maxWeeklyHoursCap) {
    return Math.min(member.maxHoursPerWeek, maxWeeklyHoursCap) * 60;
}
function printSeedDiagnostics(diagnostics) {
    console.log('[seed-realistic] Teaching-load coverage diagnostics');
    console.log(`  - Faculty mirrored: ${diagnostics.facultyCount}`);
    console.log(`  - Sections covered: ${diagnostics.sectionCount}`);
    console.log(`  - Required section-subject pairs: ${diagnostics.requiredPairCount}`);
    console.log(`  - Assigned section-subject pairs: ${diagnostics.assignedPairCount}`);
    console.log(`  - Unassigned section-subject pairs: ${diagnostics.unassignedSectionSubjectCount}`);
    console.log(`  - Faculty without assignments: ${diagnostics.facultyWithoutAssignmentsCount}`);
    console.log(`  - Adviser homeroom matches: ${diagnostics.adviserHomeroomMatchCount}/${diagnostics.adviserCount}`);
    console.log(`  - Max assigned hours: ${diagnostics.maxAssignedHours}`);
    console.log(`  - MTB-specialized faculty mirrored: ${diagnostics.mtbFacultyCount}`);
    console.log(`  - Duplicate ownership pairs: ${diagnostics.duplicateOwnershipCount}`);
    console.log(`  - Load hours min/p50/p95/max: ${diagnostics.loadStats.min}/${diagnostics.loadStats.p50}/${diagnostics.loadStats.p95}/${diagnostics.loadStats.max}`);
    if (diagnostics.highestLoadFaculty.length > 0) {
        console.log('  - Highest-load faculty:');
        for (const row of diagnostics.highestLoadFaculty) {
            console.log(`      * ${row.facultyName} (${row.department ?? 'Unassigned'}) -> ${row.loadHours}h across ${row.assignedSections} sections (${row.assignedSubjects} subjects, ${row.utilization}% util)`);
        }
    }
    if (diagnostics.unassignedPairs.length > 0) {
        console.log('  - Unassigned pair sample:');
        for (const pair of diagnostics.unassignedPairs.slice(0, 10)) {
            console.log(`      * ${pair.sectionName} :: ${pair.subjectCode} ${pair.subjectName}`);
        }
    }
    if (diagnostics.facultyWithoutAssignments.length > 0) {
        console.log('  - Faculty without assignment sample:');
        for (const member of diagnostics.facultyWithoutAssignments.slice(0, 10)) {
            console.log(`      * ${member.facultyName} (${member.department ?? 'No department'})`);
        }
    }
}
export async function collectSeededTeachingLoadDiagnostics(input) {
    const { sections, faculty, subjects } = await loadSeedInputs(input);
    const assignments = await prisma.facultySubject.findMany({
        where: { schoolId: input.schoolId },
        select: {
            facultyId: true,
            subjectId: true,
            sectionIds: true,
            gradeLevels: true,
            faculty: {
                select: { firstName: true, lastName: true, department: true, maxHoursPerWeek: true },
            },
            subject: { select: { code: true, name: true, minMinutesPerWeek: true } },
        },
        orderBy: [{ facultyId: 'asc' }, { subjectId: 'asc' }],
    });
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const loadMinutes = new Map();
    const assignmentCount = new Map();
    const sectionCounts = new Map();
    const pairOwners = new Map();
    let duplicateOwnershipCount = 0;
    for (const assignment of assignments) {
        const subject = subjectById.get(assignment.subjectId);
        if (!subject)
            continue;
        const currentMinutes = loadMinutes.get(assignment.facultyId) ?? 0;
        loadMinutes.set(assignment.facultyId, currentMinutes + subject.minMinutesPerWeek * assignment.sectionIds.length);
        assignmentCount.set(assignment.facultyId, (assignmentCount.get(assignment.facultyId) ?? 0) + assignment.sectionIds.length);
        const facultySections = sectionCounts.get(assignment.facultyId) ?? new Set();
        for (const sectionId of assignment.sectionIds) {
            facultySections.add(sectionId);
            const key = `${assignment.subjectId}:${sectionId}`;
            if (pairOwners.has(key)) {
                duplicateOwnershipCount += 1;
            }
            else {
                pairOwners.set(key, assignment.facultyId);
            }
        }
        sectionCounts.set(assignment.facultyId, facultySections);
    }
    const pairDefinitions = buildPairDefinitions(sections, subjects, faculty);
    const unassignedPairs = pairDefinitions
        .filter((pair) => !pairOwners.has(pair.key))
        .map((pair) => ({
        sectionId: pair.section.id,
        sectionName: pair.section.name,
        subjectCode: pair.subject.code,
        subjectName: pair.subject.name,
    }));
    const facultyRows = faculty.map((member) => {
        const memberLoadHours = Number(((loadMinutes.get(member.id) ?? 0) / 60).toFixed(2));
        const maxHours = member.maxHoursPerWeek;
        return {
            facultyId: member.id,
            facultyName: `${member.lastName}, ${member.firstName}`,
            department: member.department,
            assignedSections: (sectionCounts.get(member.id) ?? new Set()).size,
            assignedSubjects: assignmentCount.get(member.id) ?? 0,
            loadHours: memberLoadHours,
            maxHours,
            utilization: maxHours > 0 ? Number(((memberLoadHours / maxHours) * 100).toFixed(1)) : 0,
        };
    });
    const adviserCount = faculty.filter((member) => member.advisedSectionId != null).length;
    const homeroomSubject = subjects.find((subject) => isHomeroomSubject(subject));
    const adviserHomeroomMatchCount = homeroomSubject
        ? faculty.filter((member) => member.advisedSectionId != null && pairOwners.get(`${homeroomSubject.id}:${member.advisedSectionId}`) === member.id).length
        : 0;
    const loadHours = facultyRows.map((row) => row.loadHours);
    return {
        facultyCount: faculty.length,
        sectionCount: sections.length,
        requiredPairCount: pairDefinitions.length,
        assignedPairCount: pairOwners.size,
        unassignedSectionSubjectCount: unassignedPairs.length,
        facultyWithoutAssignmentsCount: facultyRows.filter((row) => row.assignedSubjects === 0).length,
        adviserCount,
        adviserHomeroomMatchCount,
        maxAssignedHours: Number(Math.max(0, ...loadHours).toFixed(2)),
        duplicateOwnershipCount,
        mtbFacultyCount: faculty.filter((member) => (member.department ?? '').toLowerCase().includes('mother tongue')).length,
        loadStats: buildLoadStats(loadHours),
        highestLoadFaculty: [...facultyRows].sort((left, right) => right.loadHours - left.loadHours || left.facultyName.localeCompare(right.facultyName)).slice(0, 10),
        unassignedPairs,
        facultyWithoutAssignments: facultyRows
            .filter((row) => row.assignedSubjects === 0)
            .map((row) => ({ facultyId: row.facultyId, facultyName: row.facultyName, department: row.department })),
    };
}
export async function seedTeachingLoadBaseline(input) {
    const maxWeeklyHoursCap = input.maxWeeklyHoursCap ?? 40;
    const { sections, faculty, subjects, sectionSource } = await loadSeedInputs(input);
    if (faculty.length === 0) {
        throw new Error('Cannot seed teaching loads because no active faculty mirrors were found.');
    }
    if (sections.length === 0) {
        throw new Error('Cannot seed teaching loads because no active sections were found.');
    }
    if (subjects.length === 0) {
        throw new Error('Cannot seed teaching loads because no active subjects were found.');
    }
    const facultyById = new Map(faculty.map((member) => [member.id, member]));
    const pairDefinitions = buildPairDefinitions(sections, subjects, faculty);
    const assignedPairs = new Set();
    const loadMinutes = new Map();
    const assignmentPairCounts = new Map();
    const sectionsByFacultySubject = new Map();
    function canFit(facultyId, minutes) {
        const member = facultyById.get(facultyId);
        if (!member)
            return false;
        return (loadMinutes.get(facultyId) ?? 0) + minutes <= getFacultyCapacityMinutes(member, maxWeeklyHoursCap);
    }
    function assignPair(facultyId, pair) {
        assignedPairs.add(pair.key);
        loadMinutes.set(facultyId, (loadMinutes.get(facultyId) ?? 0) + pair.minutes);
        assignmentPairCounts.set(facultyId, (assignmentPairCounts.get(facultyId) ?? 0) + 1);
        const groupingKey = `${facultyId}:${pair.subject.id}`;
        const existing = sectionsByFacultySubject.get(groupingKey) ?? {
            facultyId,
            subjectId: pair.subject.id,
            sectionIds: new Set(),
            gradeLevels: new Set(),
        };
        existing.sectionIds.add(pair.section.id);
        existing.gradeLevels.add(pair.section.displayOrder);
        sectionsByFacultySubject.set(groupingKey, existing);
    }
    for (const pair of pairDefinitions.filter((entry) => isHomeroomSubject(entry.subject))) {
        const adviserId = pair.candidateIds[0];
        if (adviserId && canFit(adviserId, pair.minutes)) {
            assignPair(adviserId, pair);
        }
    }
    const remainingPairs = pairDefinitions.filter((pair) => !assignedPairs.has(pair.key));
    for (const member of faculty.filter((candidate) => (assignmentPairCounts.get(candidate.id) ?? 0) === 0)) {
        const eligiblePair = remainingPairs
            .filter((pair) => !assignedPairs.has(pair.key) && pair.candidateIds.includes(member.id) && canFit(member.id, pair.minutes))
            .sort(pairSort)[0];
        if (eligiblePair) {
            assignPair(member.id, eligiblePair);
        }
    }
    for (const pair of pairDefinitions.filter((entry) => !assignedPairs.has(entry.key))) {
        const candidate = pair.candidateIds
            .filter((facultyId) => canFit(facultyId, pair.minutes))
            .sort((left, right) => {
            const leftLoad = loadMinutes.get(left) ?? 0;
            const rightLoad = loadMinutes.get(right) ?? 0;
            const leftPairs = assignmentPairCounts.get(left) ?? 0;
            const rightPairs = assignmentPairCounts.get(right) ?? 0;
            return leftLoad - rightLoad || leftPairs - rightPairs || left - right;
        })[0];
        if (candidate != null) {
            assignPair(candidate, pair);
        }
    }
    const rows = [...sectionsByFacultySubject.values()].map((entry) => ({
        facultyId: entry.facultyId,
        subjectId: entry.subjectId,
        schoolId: input.schoolId,
        gradeLevels: [...entry.gradeLevels].sort((left, right) => left - right),
        sectionIds: [...entry.sectionIds].sort((left, right) => left - right),
        assignedBy: input.assignedBy,
    }));
    await prisma.$transaction(async (tx) => {
        await tx.facultySubject.deleteMany({ where: { schoolId: input.schoolId } });
        if (rows.length > 0) {
            await tx.facultySubject.createMany({ data: rows });
        }
    });
    const diagnostics = await collectSeededTeachingLoadDiagnostics(input);
    printSeedDiagnostics(diagnostics);
    return {
        diagnostics,
        createdAssignmentRows: rows.length,
        sectionSource,
        subjectCount: subjects.length,
    };
}
//# sourceMappingURL=seeded-teaching-load.service.js.map