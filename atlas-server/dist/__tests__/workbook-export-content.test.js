import { prisma } from '../lib/prisma.js';
import { exportSummaryWorkbook, exportClassProgramWorkbook } from '../services/workbook-export.service.js';
import ExcelJS from 'exceljs';
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
async function run() {
    section('Setup: find a completed generation run');
    const run = await prisma.generationRun.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, schoolId: true, schoolYearId: true, draftEntries: true, summary: true },
    });
    if (!run) {
        console.error('  ✗ No completed generation run found — skipping all tests');
        process.exit(1);
    }
    const schoolId = run.schoolId;
    const schoolYearId = run.schoolYearId;
    const runId = run.id;
    const entries = (run.draftEntries ?? []);
    console.log(`  Run #${runId} (school ${schoolId}, year ${schoolYearId}) — ${entries.length} entries`);
    // ─── Summary Workbook ───
    section('Summary Workbook: structure and content');
    const summaryBuffer = await exportSummaryWorkbook({ schoolId, schoolYearId, runId });
    assert(summaryBuffer.length > 0, 'Summary buffer is non-empty');
    const summaryWb = new ExcelJS.Workbook();
    await summaryWb.xlsx.load(summaryBuffer);
    const summarySheet = summaryWb.getWorksheet('SUMMARY');
    assert(summarySheet !== undefined, 'SUMMARY worksheet exists');
    if (!summarySheet) {
        process.exit(1);
    }
    // Check report header
    const titleCell = summarySheet.getRow(1).getCell(1).value;
    assert(typeof titleCell === 'string' && titleCell.includes('CLASS-MONITORING SUMMARY'), 'Report title header present');
    const metaRow = summarySheet.getRow(2);
    const schoolCell = metaRow.getCell(1).value;
    assert(typeof schoolCell === 'string' && schoolCell.startsWith('School:'), 'School name in header');
    const yearCell = metaRow.getCell(2).value;
    assert(typeof yearCell === 'string' && yearCell.startsWith('Year:'), 'Year label in header');
    const runCell = metaRow.getCell(3).value;
    assert(typeof runCell === 'string' && runCell.startsWith('Run:'), 'Run ID in header');
    // Scan all cells for content
    const allCellValues = [];
    summarySheet.eachRow((row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            const v = cell.value;
            if (typeof v === 'string')
                allCellValues.push(v);
        });
    });
    const joinedCells = allCellValues.join(' ');
    // Subject presence
    const subjects = await prisma.subject.findMany({
        where: { schoolId },
        select: { name: true, code: true },
    });
    const subjectNames = subjects.map((s) => s.name);
    const subjectCodes = subjects.map((s) => s.code);
    const hasSubject = subjectNames.some((n) => joinedCells.includes(n)) || subjectCodes.some((c) => joinedCells.includes(c));
    assert(hasSubject, 'At least one subject name/code appears in summary cells');
    // Teacher presence
    const faculty = await prisma.facultyMirror.findMany({
        where: { schoolId },
        select: { lastName: true },
    });
    const lastNames = faculty.map((f) => f.lastName).filter(Boolean);
    const hasTeacher = lastNames.some((n) => joinedCells.includes(n));
    assert(hasTeacher, 'At least one teacher last name appears in summary cells');
    // Break row presence
    const hasRecess = allCellValues.some((v) => v.toUpperCase().includes('RECESS') || v.toUpperCase().includes('BREAK'));
    assert(hasRecess, 'RECESS or BREAK row present in summary');
    const hasLunch = allCellValues.some((v) => v.toUpperCase().includes('LUNCH'));
    assert(hasLunch, 'LUNCH BREAK row present in summary');
    // Room/building presence — only checked in class-program BLDG./RM. row
    const entriesHaveRooms = entries.some((e) => e.roomId > 0);
    console.log(`  ⊘ Room/building in summary cells skipped — room data shown in class-program BLDG./RM. row only`);
    // No raw IDs in visible cells (except in header Run: row)
    const rawIdPattern = /Unknown .* \(#\d+\)/;
    const hasRawId = allCellValues.some((v) => rawIdPattern.test(v));
    assert(!hasRawId, 'No raw Unknown ... (#id) labels in summary');
    // ─── Class Program Workbook ───
    section('Class Program Workbook: structure and content');
    const classProgBuffer = await exportClassProgramWorkbook({ schoolId, schoolYearId, runId });
    assert(classProgBuffer.length > 0, 'Class program buffer is non-empty');
    const classProgWb = new ExcelJS.Workbook();
    await classProgWb.xlsx.load(classProgBuffer);
    const classProgSheet = classProgWb.getWorksheet('CLASS PROGRAM');
    assert(classProgSheet !== undefined, 'CLASS PROGRAM worksheet exists');
    if (!classProgSheet) {
        process.exit(1);
    }
    // Check BLDG./RM. row
    const cpAllCellValues = [];
    let hasBldgRmRow = false;
    classProgSheet.eachRow((row, rowNumber) => {
        const firstCell = row.getCell(1).value;
        if (typeof firstCell === 'string' && firstCell === 'BLDG./RM.') {
            hasBldgRmRow = true;
        }
        row.eachCell({ includeEmpty: false }, (cell) => {
            const v = cell.value;
            if (typeof v === 'string')
                cpAllCellValues.push(v);
        });
    });
    assert(hasBldgRmRow, 'BLDG./RM. row present in class program');
    // Check room/building data in BLDG./RM. row if entries have rooms
    if (entriesHaveRooms) {
        let bldgRowFound = false;
        classProgSheet.eachRow((row) => {
            if (bldgRowFound)
                return;
            const firstCell = row.getCell(1).value;
            if (typeof firstCell === 'string' && firstCell === 'BLDG./RM.') {
                bldgRowFound = true;
                const bldgCellValues = [];
                row.eachCell({ includeEmpty: false }, (cell) => {
                    const v = cell.value;
                    if (typeof v === 'string' && v !== 'BLDG./RM.')
                        bldgCellValues.push(v);
                });
                const hasBldgRoomData = bldgCellValues.some((v) => v.includes('/'));
                assert(hasBldgRoomData, 'BLDG./RM. row contains room/building labels');
            }
        });
        if (!bldgRowFound) {
            assert(false, 'BLDG./RM. row found for room data check');
        }
    }
    // Subject/teacher presence in class program
    const cpJoined = cpAllCellValues.join(' ');
    const cpHasSubject = subjectNames.some((n) => cpJoined.includes(n)) || subjectCodes.some((c) => cpJoined.includes(c));
    assert(cpHasSubject, 'At least one subject name/code in class program');
    const cpHasTeacher = lastNames.some((n) => cpJoined.includes(n));
    assert(cpHasTeacher, 'At least one teacher last name in class program');
    // Break rows in class program
    const cpHasBreak = cpAllCellValues.some((v) => v.toUpperCase().includes('RECESS') || v.toUpperCase().includes('BREAK'));
    assert(cpHasBreak, 'Break row present in class program');
    const cpHasLunch = cpAllCellValues.some((v) => v.toUpperCase().includes('LUNCH'));
    assert(cpHasLunch, 'Lunch row present in class program');
    // No raw IDs
    const cpHasRawId = cpAllCellValues.some((v) => rawIdPattern.test(v));
    assert(!cpHasRawId, 'No raw Unknown ... (#id) labels in class program');
    // ─── Per-subject sheets deferred ───
    section('Workbook parity: per-subject sheets');
    const hasPerSubjectSheets = summaryWb.worksheets.length > 1 || classProgWb.worksheets.length > 1;
    console.log(`  ⊘ Per-subject teacher schedule sheets: DEFERRED (summary has ${summaryWb.worksheets.length} sheet(s), class program has ${classProgWb.worksheets.length} sheet(s))`);
    // ─── Summary ───
    section('Results');
    console.log(`  Passed: ${passCount}`);
    console.log(`  Failed: ${failCount}`);
    if (failCount > 0) {
        process.exit(1);
    }
}
run();
//# sourceMappingURL=workbook-export-content.test.js.map