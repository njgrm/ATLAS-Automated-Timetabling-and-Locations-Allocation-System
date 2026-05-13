/**
 * Pass 4A — Backfill: subject_section_ownerships from FacultySubject.sectionIds
 *
 * Reads every FacultySubject row and inserts one SubjectSectionOwnership row per
 * sectionId in the array. This populates the new normalized table from the existing
 * denormalized array column so it is ready for the service-layer guardrail added in
 * Pass 4B.
 *
 * Design decisions
 * ──────────────────────────────────────────────────────────────────────────────
 * - Skip-duplicates mode is the default: if a (schoolId, subjectId, sectionId)
 *   triple already exists in the table (from a previous partial backfill run) the
 *   row is silently skipped. This makes the script safe to re-run idempotently.
 *
 * - Conflict detection: after insertion, the script checks whether the unique
 *   constraint would have been violated by looking for triples that appear in MORE
 *   than one FacultySubject row. Any such collision is reported in the ledger as a
 *   "DB conflict" (the earlier-assigned row wins because INSERT order is sorted by
 *   assignedAt ASC; the skipped duplicates are logged).
 *
 * - Faculty subjects with sectionIds=[] are legitimately skipped (nothing to index).
 *
 * CLI flags
 * ──────────────────────────────────────────────────────────────────────────────
 *   --schoolId=N     (default: 1) scope to a single school
 *   --all-schools    process every school in the DB
 *   --dry-run        (default) show what would be inserted; no DB changes
 *   --apply          commit inserts
 *   --output=path    ledger output path (default: qa-artifacts/...)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';
// ─── Helpers ──────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../../../qa-artifacts/subject-section-ownership-backfill-ledger.json');
function parseArgs(argv) {
    let schoolIds = [1];
    let allSchools = false;
    let apply = false;
    let outputPath = DEFAULT_OUTPUT_PATH;
    for (const arg of argv) {
        if (arg.startsWith('--schoolId=')) {
            schoolIds = [Number.parseInt(arg.split('=')[1] ?? '1', 10) || 1];
        }
        else if (arg === '--all-schools') {
            allSchools = true;
        }
        else if (arg === '--apply') {
            apply = true;
        }
        else if (arg.startsWith('--output=')) {
            const raw = arg.split('=')[1]?.trim();
            if (raw) {
                outputPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
            }
        }
    }
    return { schoolIds, allSchools, apply, outputPath };
}
// ─── Per-school backfill ──────────────────────────────────────────────────────
async function backfillSchool(schoolId, apply) {
    const rows = await prisma.facultySubject.findMany({
        where: { schoolId },
        select: {
            id: true,
            facultyId: true,
            subjectId: true,
            schoolId: true,
            sectionIds: true,
            assignedAt: true,
            faculty: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ assignedAt: 'asc' }, { facultyId: 'asc' }],
    });
    const insertRows = [];
    let emptyArraysSkipped = 0;
    // Build the full set of planned inserts, ordered by assignedAt so that in the
    // case of a duplicate the earliest-assigned row is attempted first.
    for (const row of rows) {
        if (row.sectionIds.length === 0) {
            emptyArraysSkipped++;
            continue;
        }
        for (const sectionId of row.sectionIds) {
            insertRows.push({
                schoolId: row.schoolId,
                facultySubjectId: row.id,
                facultyId: row.facultyId,
                subjectId: row.subjectId,
                sectionId,
                assignedAt: row.assignedAt,
            });
        }
    }
    // Detect collisions pre-flight (same triple, different facultySubjectId)
    const tripleOwnerMap = new Map();
    for (const row of insertRows) {
        const key = `${row.schoolId}:${row.subjectId}:${row.sectionId}`;
        const list = tripleOwnerMap.get(key) ?? [];
        list.push(row);
        tripleOwnerMap.set(key, list);
    }
    const conflicts = [];
    const conflictedFsIds = new Set();
    for (const [, owners] of tripleOwnerMap) {
        if (owners.length <= 1)
            continue;
        // First owner (earliest assignedAt / lowest facultyId) = winner; rest = duplicates
        const [winner, ...losers] = owners;
        for (const loser of losers) {
            conflictedFsIds.add(loser.facultySubjectId);
        }
        const facultyNameCache = new Map();
        for (const row of rows) {
            facultyNameCache.set(row.facultyId, `${row.faculty.lastName}, ${row.faculty.firstName}`);
        }
        conflicts.push({
            schoolId: owners[0].schoolId,
            subjectId: owners[0].subjectId,
            sectionId: owners[0].sectionId,
            owners: owners.map((o, idx) => ({
                facultySubjectId: o.facultySubjectId,
                facultyId: o.facultyId,
                facultyName: facultyNameCache.get(o.facultyId) ?? String(o.facultyId),
                assignedAt: o.assignedAt.toISOString(),
                action: idx === 0 ? 'inserted' : 'skipped-duplicate',
            })),
        });
    }
    // Non-duplicate rows = safe inserts; duplicate losers = will be skipped
    const safeRows = insertRows.filter((r) => !conflictedFsIds.has(r.facultySubjectId) ||
        // Still include the winning row even if its facultySubjectId appears in conflicts
        tripleOwnerMap
            .get(`${r.schoolId}:${r.subjectId}:${r.sectionId}`)
            .findIndex((o) => o.facultySubjectId === r.facultySubjectId) === 0);
    let rowsInserted = 0;
    let rowsSkippedDuplicate = insertRows.length - safeRows.length;
    if (apply && safeRows.length > 0) {
        // Insert in batches of 500; skipDuplicates handles any residual re-run overlaps
        const BATCH = 500;
        for (let i = 0; i < safeRows.length; i += BATCH) {
            const batch = safeRows.slice(i, i + BATCH);
            const result = await prisma.subjectSectionOwnership.createMany({
                data: batch.map((r) => ({
                    schoolId: r.schoolId,
                    facultySubjectId: r.facultySubjectId,
                    facultyId: r.facultyId,
                    subjectId: r.subjectId,
                    sectionId: r.sectionId,
                    assignedAt: r.assignedAt,
                })),
                skipDuplicates: true,
            });
            rowsInserted += result.count;
        }
    }
    else if (!apply) {
        rowsInserted = safeRows.length; // simulated
    }
    return {
        schoolId,
        facultySubjectRowsScanned: rows.length,
        emptyArraysSkipped,
        rowsPlanned: insertRows.length,
        rowsInserted,
        rowsSkippedDuplicate,
        conflicts,
    };
}
// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
    const options = parseArgs(process.argv.slice(2));
    let targetSchoolIds = options.schoolIds;
    if (options.allSchools) {
        const schools = await prisma.school.findMany({ select: { id: true } });
        targetSchoolIds = schools.map((s) => s.id);
    }
    console.log(`\n${'─'.repeat(60)}`);
    console.log('  Pass 4A — subject_section_ownerships backfill');
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Mode     : ${options.apply ? '⚠  APPLY (DB writes enabled)' : 'DRY-RUN (no writes)'}`);
    console.log(`  Schools  : ${targetSchoolIds.join(', ')}`);
    console.log(`${'─'.repeat(60)}\n`);
    const results = [];
    for (const schoolId of targetSchoolIds) {
        console.log(`Processing school ${schoolId}...`);
        const result = await backfillSchool(schoolId, options.apply);
        results.push(result);
        console.log(`  Faculty-subject rows scanned : ${result.facultySubjectRowsScanned}`);
        console.log(`  Empty sectionIds skipped     : ${result.emptyArraysSkipped}`);
        console.log(`  Ownership rows planned       : ${result.rowsPlanned}`);
        console.log(`  Ownership rows ${options.apply ? 'inserted' : 'would insert'}: ${result.rowsInserted}`);
        if (result.rowsSkippedDuplicate > 0) {
            console.log(`  ⚠  Duplicate rows skipped    : ${result.rowsSkippedDuplicate}`);
        }
        if (result.conflicts.length > 0) {
            console.log(`  ⚠  Ownership conflicts       : ${result.conflicts.length}`);
            for (const c of result.conflicts.slice(0, 5)) {
                const ownerSummary = c.owners
                    .map((o) => `${o.facultyName}(fs#${o.facultySubjectId}) → ${o.action}`)
                    .join(' | ');
                console.log(`       subject=${c.subjectId}, section=${c.sectionId}: ${ownerSummary}`);
            }
            if (result.conflicts.length > 5) {
                console.log(`       ... and ${result.conflicts.length - 5} more (see ledger).`);
            }
        }
        else {
            console.log('  ✓  No ownership conflicts');
        }
        console.log();
    }
    // Verify post-backfill row count (live DB if applied, simulated if dry-run)
    let postCount = 0;
    if (options.apply) {
        const agg = await prisma.subjectSectionOwnership.count({
            where: { schoolId: { in: targetSchoolIds } },
        });
        postCount = agg;
    }
    else {
        postCount = results.reduce((sum, r) => sum + r.rowsInserted, 0);
    }
    const totalConflicts = results.reduce((sum, r) => sum + r.conflicts.length, 0);
    // Write ledger
    const ledger = {
        generatedAt: new Date().toISOString(),
        mode: options.apply ? 'applied' : 'dry-run',
        schools: targetSchoolIds,
        summary: {
            postTableRowCount: postCount,
            totalOwnershipConflictsDetected: totalConflicts,
            note: options.apply
                ? 'postTableRowCount is the live count after insertion'
                : 'postTableRowCount is simulated (safe rows only)',
        },
        results,
    };
    mkdirSync(path.dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    console.log(`${'─'.repeat(60)}`);
    console.log('  Summary');
    console.log(`${'─'.repeat(60)}`);
    console.log(`  subject_section_ownerships ${options.apply ? 'count' : 'would-be count'}: ${postCount}`);
    console.log(`  Ownership conflicts: ${totalConflicts}${totalConflicts === 0 ? ' ✓' : ' ✗  (see ledger for details)'}`);
    console.log(`  Ledger: ${options.outputPath}\n`);
    if (!options.apply && results.some((r) => r.rowsPlanned > 0)) {
        const totalPlanned = results.reduce((sum, r) => sum + r.rowsInserted, 0);
        console.log(`  Re-run with --apply to insert ${totalPlanned} ownership row(s).\n`);
    }
}
run()
    .catch((error) => {
    console.error('\nBackfill script failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=backfill-subject-section-ownership.js.map