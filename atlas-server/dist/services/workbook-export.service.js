import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
function formatTime12h(time24) {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
function getBreakLabel(eventName) {
    if (!eventName)
        return '';
    const upper = eventName.toUpperCase();
    if (upper.includes('RECESS') || upper.includes('BREAK'))
        return eventName.toUpperCase();
    if (upper.includes('LUNCH'))
        return 'LUNCH BREAK';
    if (upper.includes('FLAG'))
        return 'FLAG CEREMONY';
    return eventName;
}
function formatRoomLabel(room) {
    if (!room)
        return '';
    return `${room.buildingName} / ${room.name}`;
}
async function loadExportContext(options) {
    const { schoolId, schoolYearId, runId } = options;
    const [run, school, schoolYearMirror] = await Promise.all([
        prisma.generationRun.findFirst({
            where: { id: runId, schoolId, schoolYearId },
            select: { id: true, status: true, summary: true, draftEntries: true },
        }),
        prisma.school.findUnique({
            where: { id: schoolId },
            select: { name: true },
        }),
        prisma.enrollProSchoolYearMirror.findFirst({
            where: { schoolId, enrollProSchoolYearId: schoolYearId },
            select: { yearLabel: true },
        }),
    ]);
    if (!run)
        throw new Error('RUN_NOT_FOUND');
    if (run.status !== 'COMPLETED' && !run.summary?.isPublished) {
        throw new Error('RUN_NOT_COMPLETED');
    }
    const summary = run.summary;
    const displaySlots = summary?.timetableDisplaySlots ?? [];
    let entries = (run.draftEntries ?? []);
    // Term filtering for export
    if (options.termIndex !== undefined) {
        let resolvedTermIndex;
        if (options.termIndex === 'active') {
            try {
                const { fetchEnrollProActiveTerm } = await import('./active-term-adapter.service.js');
                const activeTermResult = await fetchEnrollProActiveTerm();
                if (!activeTermResult.verified || activeTermResult.termIndex === null) {
                    throw new Error('TERM_FILTER_NOT_READY');
                }
                resolvedTermIndex = activeTermResult.termIndex;
            }
            catch {
                throw new Error('TERM_FILTER_NOT_READY');
            }
        }
        else {
            resolvedTermIndex = options.termIndex;
        }
        entries = entries.filter((entry) => {
            const entryTermIndex = entry.termIndex;
            return entryTermIndex != null && entryTermIndex === resolvedTermIndex;
        });
    }
    // Collect unique room IDs from entries
    const roomIds = [...new Set(entries.map((e) => e.roomId).filter((id) => id != null && id > 0))];
    // Load all reference data in parallel
    const [sections, faculty, subjects, rooms] = await Promise.all([
        prisma.sectionMirror.findMany({
            where: { schoolId, schoolYearId },
            select: { id: true, externalId: true, name: true, gradeLevelId: true },
        }),
        prisma.facultyMirror.findMany({
            where: { schoolId },
            select: { id: true, lastName: true, firstName: true, advisedSectionId: true },
        }),
        prisma.subject.findMany({
            where: { schoolId },
            select: { id: true, name: true, code: true },
        }),
        roomIds.length > 0
            ? prisma.room.findMany({
                where: { id: { in: roomIds } },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    floor: true,
                    building: { select: { id: true, name: true } },
                },
            })
            : Promise.resolve([]),
    ]);
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const facultyMap = new Map(faculty.map((f) => [f.id, f]));
    const roomMap = new Map();
    for (const r of rooms) {
        roomMap.set(r.id, {
            id: r.id,
            name: r.name,
            type: r.type,
            floor: r.floor,
            buildingId: r.building.id,
            buildingName: r.building.name,
        });
    }
    const adviserMap = new Map();
    for (const f of faculty) {
        if (f.advisedSectionId)
            adviserMap.set(f.advisedSectionId, f.lastName ?? '');
    }
    return {
        schoolName: school?.name ?? '',
        yearLabel: schoolYearMirror?.yearLabel ?? '',
        runId,
        subjectMap,
        facultyMap,
        roomMap,
        adviserMap,
        displaySlots,
        entries,
    };
}
function buildEntryGrid(entries, subjectMap, facultyMap, roomMap) {
    const grid = new Map();
    for (const entry of entries) {
        const key = `${entry.sectionId}-${entry.startTime}-${entry.endTime}`;
        if (grid.has(key))
            continue;
        const subj = subjectMap.get(entry.subjectId);
        const fac = entry.facultyId ? facultyMap.get(entry.facultyId) : null;
        const room = entry.roomId ? roomMap.get(entry.roomId) : undefined;
        grid.set(key, {
            teacher: fac?.lastName ? (fac.firstName ? `${fac.lastName}, ${fac.firstName}` : fac.lastName) : 'Unassigned',
            subject: subj?.name ?? subj?.code ?? `Subject #${entry.subjectId}`,
            room: formatRoomLabel(room),
        });
    }
    return grid;
}
function interleaveSlots(periodSlots, breakSlots) {
    const result = [];
    let periodIdx = 0;
    let breakIdx = 0;
    while (periodIdx < periodSlots.length || breakIdx < breakSlots.length) {
        const nextPeriod = periodSlots[periodIdx];
        const nextBreak = breakSlots[breakIdx];
        if (!nextPeriod) {
            result.push({ type: 'break', slot: nextBreak });
            breakIdx++;
        }
        else if (!nextBreak) {
            result.push({ type: 'period', slot: nextPeriod });
            periodIdx++;
        }
        else if (nextPeriod.startTime <= nextBreak.startTime) {
            result.push({ type: 'period', slot: nextPeriod });
            periodIdx++;
        }
        else {
            result.push({ type: 'break', slot: nextBreak });
            breakIdx++;
        }
    }
    return result;
}
function addReportHeader(sheet, ctx, title) {
    const headerRow = sheet.getRow(1);
    headerRow.getCell(1).value = title;
    headerRow.getCell(1).font = { bold: true, size: 14 };
    const metaRow = sheet.getRow(2);
    metaRow.getCell(1).value = `School: ${ctx.schoolName}`;
    metaRow.getCell(1).font = { italic: true };
    metaRow.getCell(2).value = `Year: ${ctx.yearLabel}`;
    metaRow.getCell(2).font = { italic: true };
    metaRow.getCell(3).value = `Run: ${ctx.runId}`;
    metaRow.getCell(3).font = { italic: true };
    metaRow.getCell(4).value = `Generated: ${new Date().toISOString().split('T')[0]}`;
    metaRow.getCell(4).font = { italic: true };
}
export async function exportSummaryWorkbook(options) {
    const ctx = await loadExportContext(options);
    const allSlots = [...ctx.displaySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const periodSlots = allSlots.filter((s) => !s.isSpecialEvent);
    const breakSlots = allSlots.filter((s) => s.isSpecialEvent);
    const sections = await prisma.sectionMirror.findMany({
        where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId },
        select: { id: true, externalId: true, name: true, gradeLevelId: true },
    });
    const sortedSections = [...sections].sort((a, b) => {
        if (a.gradeLevelId !== b.gradeLevelId)
            return a.gradeLevelId - b.gradeLevelId;
        return a.name.localeCompare(b.name);
    });
    const entryGrid = buildEntryGrid(ctx.entries, ctx.subjectMap, ctx.facultyMap, ctx.roomMap);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ATLAS';
    const MAX_SECTIONS = 12;
    const bands = [];
    for (let i = 0; i < sortedSections.length; i += MAX_SECTIONS) {
        bands.push(sortedSections.slice(i, i + MAX_SECTIONS));
    }
    const sheet = workbook.addWorksheet('SUMMARY');
    addReportHeader(sheet, ctx, 'CLASS-MONITORING SUMMARY');
    const orderedSlots = interleaveSlots(periodSlots, breakSlots);
    for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
        const band = bands[bandIdx];
        // header(1) + meta(1) + blank(1) + section(1) + adviser(1) + data rows
        const dataStartRow = 4 + bandIdx * (orderedSlots.reduce((sum, item) => sum + (item.type === 'break' ? 1 : 2), 0) + 3);
        const startRow = bandIdx === 0 ? 4 : dataStartRow;
        // Section header
        const headerRow = sheet.getRow(startRow);
        headerRow.getCell(1).value = 'TIME';
        headerRow.getCell(1).font = { bold: true };
        band.forEach((sec, col) => {
            headerRow.getCell(col + 2).value = sec.name;
            headerRow.getCell(col + 2).font = { bold: true };
        });
        // Adviser row
        const adviserRow = sheet.getRow(startRow + 1);
        adviserRow.getCell(1).value = 'ADVISER';
        adviserRow.getCell(1).font = { bold: true };
        band.forEach((sec, col) => {
            adviserRow.getCell(col + 2).value = ctx.adviserMap.get(sec.externalId) ?? '';
        });
        let row = startRow + 2;
        for (const item of orderedSlots) {
            if (item.type === 'break') {
                const label = getBreakLabel(item.slot.eventName);
                const r = sheet.getRow(row);
                r.getCell(1).value = label;
                r.getCell(1).font = { bold: true };
                band.forEach((_, col) => { r.getCell(col + 2).value = label; });
                row++;
            }
            else {
                // Teacher row
                const teacherRow = sheet.getRow(row);
                teacherRow.getCell(1).value = `${formatTime12h(item.slot.startTime)}-${formatTime12h(item.slot.endTime)}`;
                band.forEach((sec, col) => {
                    const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
                    teacherRow.getCell(col + 2).value = entry?.teacher ?? '';
                });
                row++;
                // Subject row
                const subjectRow = sheet.getRow(row);
                subjectRow.getCell(1).value = '';
                band.forEach((sec, col) => {
                    const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
                    subjectRow.getCell(col + 2).value = entry?.subject ?? '';
                });
                row++;
            }
        }
    }
    sheet.columns.forEach((col) => { col.width = 18; });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
export async function exportClassProgramWorkbook(options) {
    const ctx = await loadExportContext(options);
    const allSlots = [...ctx.displaySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const periodSlots = allSlots.filter((s) => !s.isSpecialEvent);
    const breakSlots = allSlots.filter((s) => s.isSpecialEvent);
    const sections = await prisma.sectionMirror.findMany({
        where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId },
        select: { id: true, externalId: true, name: true, gradeLevelId: true },
    });
    const sortedSections = [...sections].sort((a, b) => {
        if (a.gradeLevelId !== b.gradeLevelId)
            return a.gradeLevelId - b.gradeLevelId;
        return a.name.localeCompare(b.name);
    });
    const entryGrid = buildEntryGrid(ctx.entries, ctx.subjectMap, ctx.facultyMap, ctx.roomMap);
    // Build section -> home room lookup for BLDG./RM. band
    // Use the most common room from entries for each section as the "home room"
    const sectionRoomMap = new Map();
    const roomCounts = new Map(); // sectionExternalId -> roomId -> count
    for (const entry of ctx.entries) {
        if (!entry.roomId)
            continue;
        const sec = sections.find((s) => s.externalId === entry.sectionId);
        if (!sec)
            continue;
        if (!roomCounts.has(sec.externalId))
            roomCounts.set(sec.externalId, new Map());
        const counts = roomCounts.get(sec.externalId);
        counts.set(entry.roomId, (counts.get(entry.roomId) ?? 0) + 1);
    }
    for (const [secExtId, counts] of roomCounts) {
        let maxCount = 0;
        let bestRoomId = 0;
        for (const [roomId, count] of counts) {
            if (count > maxCount) {
                maxCount = count;
                bestRoomId = roomId;
            }
        }
        const room = ctx.roomMap.get(bestRoomId);
        if (room)
            sectionRoomMap.set(secExtId, room);
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ATLAS';
    const MAX_SECTIONS = 7;
    const bands = [];
    for (let i = 0; i < sortedSections.length; i += MAX_SECTIONS) {
        bands.push(sortedSections.slice(i, i + MAX_SECTIONS));
    }
    const sheet = workbook.addWorksheet('CLASS PROGRAM');
    addReportHeader(sheet, ctx, 'CLASS PROGRAM');
    const orderedSlots = interleaveSlots(periodSlots, breakSlots);
    for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
        const band = bands[bandIdx];
        // header(1) + meta(1) + blank(1) + section(1) + adviser(1) + bldg_rm(1) + data rows
        const dataStartRow = 5 + bandIdx * (orderedSlots.reduce((sum, item) => sum + (item.type === 'break' ? 1 : 2), 0) + 4);
        const startRow = bandIdx === 0 ? 5 : dataStartRow;
        // SECTION header
        const secRow = sheet.getRow(startRow);
        secRow.getCell(1).value = 'SECTION';
        secRow.getCell(1).font = { bold: true };
        band.forEach((sec, col) => {
            secRow.getCell(col + 2).value = sec.name;
            secRow.getCell(col + 2).font = { bold: true };
        });
        // ADVISER row
        const advRow = sheet.getRow(startRow + 1);
        advRow.getCell(1).value = 'ADVISER';
        advRow.getCell(1).font = { bold: true };
        band.forEach((sec, col) => {
            advRow.getCell(col + 2).value = ctx.adviserMap.get(sec.externalId) ?? '';
        });
        // BLDG./RM. row
        const bldgRow = sheet.getRow(startRow + 2);
        bldgRow.getCell(1).value = 'BLDG./RM.';
        bldgRow.getCell(1).font = { bold: true };
        band.forEach((sec, col) => {
            const room = sectionRoomMap.get(sec.externalId);
            bldgRow.getCell(col + 2).value = formatRoomLabel(room);
        });
        let row = startRow + 3;
        for (const item of orderedSlots) {
            if (item.type === 'break') {
                const label = getBreakLabel(item.slot.eventName);
                const r = sheet.getRow(row);
                r.getCell(1).value = label;
                r.getCell(1).font = { bold: true };
                band.forEach((_, col) => { r.getCell(col + 2).value = label; });
                row++;
            }
            else {
                // Teacher row
                const teacherRow = sheet.getRow(row);
                teacherRow.getCell(1).value = `${formatTime12h(item.slot.startTime)}-${formatTime12h(item.slot.endTime)}`;
                band.forEach((sec, col) => {
                    const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
                    teacherRow.getCell(col + 2).value = entry?.teacher ?? '';
                });
                row++;
                // Subject row
                const subjectRow = sheet.getRow(row);
                subjectRow.getCell(1).value = '';
                band.forEach((sec, col) => {
                    const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
                    subjectRow.getCell(col + 2).value = entry?.subject ?? '';
                });
                row++;
            }
        }
    }
    sheet.columns.forEach((col) => { col.width = 20; });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
//# sourceMappingURL=workbook-export.service.js.map