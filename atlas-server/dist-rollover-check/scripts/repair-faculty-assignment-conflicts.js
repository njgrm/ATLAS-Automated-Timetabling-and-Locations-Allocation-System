/**
 * Pass 3 — Data repair: legacy duplicate ownership & malformed scopes.
 *
 * What this script does:
 *  1. Detects duplicate ownership tuples (same subjectId+sectionId owned by
 *     multiple faculty in the DB) that bypassed the transaction guardrails.
 *  2. Resolves each conflict deterministically: earliest `assignedAt` wins;
 *     tiebreak is lower `facultyId`. The loser's sectionId is removed from
 *     their sectionIds array.
 *  3. Normalises every FacultySubject row's `gradeLevels` to match what the
 *     current sectionIds derive to via SectionMirror (scope = section-based
 *     source-of-truth).
 *  4. Handles legacy rows where sectionIds=[] but gradeLevels is populated:
 *     expands sectionIds from the most-recent school year's SectionMirror
 *     sections at those grade levels, then re-derives gradeLevels.
 *  5. Deletes rows that become empty after all removals (and cannot be expanded).
 *  6. Writes a JSON conflict ledger to qa-artifacts/.
 *  7. Runs post-repair validation and prints a summary.
 *
 * Safety flags:
 *   --dry-run   (default) — produce ledger, make no DB changes.
 *   --apply     — commit all repair ops in a serializable transaction.
 *   --schoolId=N
 *   --output=path
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { detectDuplicateOwnershipTuples, computeTeachingLoadMinutes, } from '../services/faculty-assignment.service.js';
import { deriveGradeLevelsFromSectionIds, expandGradeLevelsToSectionIds, } from '../services/faculty-assignment-scope.service.js';
// ─── Helpers ──────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../../../qa-artifacts/faculty-assignment-repair-ledger.json');
function parseArgs(argv) {
    let schoolId = 1;
    let outputPath = DEFAULT_OUTPUT_PATH;
    let apply = false;
    for (const arg of argv) {
        if (arg.startsWith('--schoolId=')) {
            schoolId = Number.parseInt(arg.split('=')[1] ?? '1', 10) || 1;
        }
        else if (arg.startsWith('--output=')) {
            const raw = arg.split('=')[1]?.trim();
            if (raw) {
                outputPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
            }
        }
        else if (arg === '--apply') {
            apply = true;
        }
    }
    return { schoolId, outputPath, apply };
}
function formatFullName(firstName, lastName) {
    return `${lastName}, ${firstName}`;
}
function sortedInts(values) {
    return [...values].sort((a, b) => a - b);
}
function arraysEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
    const options = parseArgs(process.argv.slice(2));
    console.log(`\n${'─'.repeat(60)}`);
    console.log('  Pass 3 — Faculty Assignment Repair');
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Mode     : ${options.apply ? '⚠  APPLY (DB writes enabled)' : 'DRY-RUN (no writes)'}`);
    console.log(`  School ID: ${options.schoolId}`);
    console.log(`${'─'.repeat(60)}\n`);
    // ── 1. Load FacultySubject rows ────────────────────────────────────────────
    const rows = await prisma.facultySubject.findMany({
        where: { schoolId: options.schoolId },
        select: {
            id: true,
            facultyId: true,
            subjectId: true,
            schoolId: true,
            gradeLevels: true,
            sectionIds: true,
            assignedAt: true,
            version: true,
            faculty: { select: { firstName: true, lastName: true } },
            subject: { select: { code: true, name: true, minMinutesPerWeek: true } },
        },
        orderBy: [{ facultyId: 'asc' }, { subjectId: 'asc' }],
    });
    console.log(`Loaded ${rows.length} FacultySubject rows.`);
    // ── 2. Build SectionMirror lookup maps ────────────────────────────────────
    // displayOrder map: sectionId → gradeLevel number
    const allMirrors = await prisma.sectionMirror.findMany({
        where: { schoolId: options.schoolId, isStale: false },
        select: { id: true, externalId: true, name: true, displayOrder: true, schoolYearId: true },
        orderBy: [{ schoolYearId: 'desc' }, { displayOrder: 'asc' }],
    });
    const sectionDisplayOrderMap = new Map(allMirrors.map((m) => [m.externalId, m.displayOrder]));
    // For legacy expansion, use the most recent school year
    const latestSchoolYearId = allMirrors[0]?.schoolYearId ?? null;
    const latestMirrors = allMirrors.filter((m) => m.schoolYearId === latestSchoolYearId);
    const sectionsByGradeLatestSY = new Map();
    for (const mirror of latestMirrors) {
        const list = sectionsByGradeLatestSY.get(mirror.displayOrder) ?? [];
        list.push(mirror.externalId);
        sectionsByGradeLatestSY.set(mirror.displayOrder, list);
    }
    console.log(`Loaded ${allMirrors.length} SectionMirror rows (${[...new Set(allMirrors.map((m) => m.schoolYearId))].length} school years).`);
    console.log(`Latest school year for legacy expansion: ${latestSchoolYearId ?? 'NONE'}\n`);
    // ── 3. Detect duplicate ownership ─────────────────────────────────────────
    const ownershipInputs = rows.map((row) => ({
        facultyId: row.facultyId,
        facultyName: formatFullName(row.faculty.firstName, row.faculty.lastName),
        subjectId: row.subjectId,
        sectionIds: sortedInts(row.sectionIds),
    }));
    const duplicateTuples = detectDuplicateOwnershipTuples(ownershipInputs);
    console.log(`Duplicate ownership tuples detected: ${duplicateTuples.length}`);
    // ── 4. Resolve conflicts (earliest assignedAt wins; tiebreak: lower facultyId)
    // Build fast lookup: (facultyId, subjectId) → row
    const rowByKey = new Map(rows.map((row) => [`${row.facultyId}:${row.subjectId}`, row]));
    const removalsByRowId = new Map();
    const conflictResolutions = [];
    for (const tuple of duplicateTuples) {
        // Sort owners: earlier assignedAt first, then lower facultyId
        const rankedOwners = tuple.owners
            .map((owner) => {
            const row = rowByKey.get(`${owner.facultyId}:${tuple.subjectId}`);
            return { ...owner, assignedAt: row?.assignedAt ?? new Date(0), rowId: row?.id ?? -1 };
        })
            .sort((a, b) => {
            const timeDiff = a.assignedAt.getTime() - b.assignedAt.getTime();
            if (timeDiff !== 0)
                return timeDiff;
            return a.facultyId - b.facultyId;
        });
        const [winner, ...losers] = rankedOwners;
        conflictResolutions.push({
            subjectId: tuple.subjectId,
            sectionId: tuple.sectionId,
            winner: {
                facultyId: winner.facultyId,
                facultyName: winner.facultyName,
                assignedAt: winner.assignedAt.toISOString(),
            },
            losers: losers.map((loser) => ({
                facultyId: loser.facultyId,
                facultyName: loser.facultyName,
                assignedAt: loser.assignedAt.toISOString(),
            })),
            policy: 'earliest-assignedAt-wins; tiebreak=lower-facultyId',
        });
        for (const loser of losers) {
            const removals = removalsByRowId.get(loser.rowId) ?? new Set();
            removals.add(tuple.sectionId);
            removalsByRowId.set(loser.rowId, removals);
        }
    }
    // ── 5. Plan repair ops per row ────────────────────────────────────────────
    const repairOps = [];
    for (const row of rows) {
        const facultyName = formatFullName(row.faculty.firstName, row.faculty.lastName);
        const removalSet = removalsByRowId.get(row.id) ?? new Set();
        const reasons = [];
        // Apply conflict removals to compute effective sectionIds
        let effectiveSectionIds = sortedInts(row.sectionIds.filter((sid) => !removalSet.has(sid)));
        if (removalSet.size > 0) {
            reasons.push(`conflict-removal: stripped ${removalSet.size} sectionId(s) [${[...removalSet].sort((a, b) => a - b).join(',')}] — lost ownership to earlier-assigned faculty`);
        }
        // Legacy expansion: sectionIds empty but gradeLevels populated
        if (effectiveSectionIds.length === 0 && row.gradeLevels.length > 0) {
            if (latestSchoolYearId !== null) {
                const expanded = expandGradeLevelsToSectionIds(row.gradeLevels, sectionsByGradeLatestSY);
                if (expanded.length > 0) {
                    effectiveSectionIds = expanded;
                    reasons.push(`legacy-expand: populated sectionIds from gradeLevels [${row.gradeLevels.join(',')}] via schoolYear ${latestSchoolYearId} (${expanded.length} sections)`);
                }
                else {
                    repairOps.push({
                        type: 'DELETE',
                        rowId: row.id,
                        facultyId: row.facultyId,
                        facultyName,
                        subjectId: row.subjectId,
                        subjectCode: row.subject.code,
                        sectionIds: row.sectionIds,
                        gradeLevels: row.gradeLevels,
                        reason: `legacy-expand-failed: gradeLevels [${row.gradeLevels.join(',')}] have no active sections in schoolYear ${latestSchoolYearId}`,
                    });
                    continue;
                }
            }
            else {
                // No school year data at all — can't expand, delete the orphan
                repairOps.push({
                    type: 'DELETE',
                    rowId: row.id,
                    facultyId: row.facultyId,
                    facultyName,
                    subjectId: row.subjectId,
                    subjectCode: row.subject.code,
                    sectionIds: row.sectionIds,
                    gradeLevels: row.gradeLevels,
                    reason: 'orphan: sectionIds empty and no SectionMirror data available for legacy expansion',
                });
                continue;
            }
        }
        // Fully empty after all removals
        if (effectiveSectionIds.length === 0) {
            repairOps.push({
                type: 'DELETE',
                rowId: row.id,
                facultyId: row.facultyId,
                facultyName,
                subjectId: row.subjectId,
                subjectCode: row.subject.code,
                sectionIds: row.sectionIds,
                gradeLevels: row.gradeLevels,
                reason: removalSet.size > 0
                    ? 'conflict-emptied: all sectionIds removed by conflict resolution'
                    : 'orphan: sectionIds and gradeLevels both empty',
            });
            continue;
        }
        // Derive expected gradeLevels from effective sectionIds
        const derivedGradeLevels = deriveGradeLevelsFromSectionIds(effectiveSectionIds, sectionDisplayOrderMap);
        const gradeLevelsDiffer = !arraysEqual(sortedInts(row.gradeLevels), sortedInts(derivedGradeLevels));
        const sectionIdsDiffer = !arraysEqual(sortedInts(row.sectionIds), effectiveSectionIds);
        if (gradeLevelsDiffer && reasons.every((r) => !r.startsWith('legacy-expand'))) {
            reasons.push(`grade-normalise: stored [${sortedInts(row.gradeLevels).join(',')}] → derived [${derivedGradeLevels.join(',')}]`);
        }
        if (sectionIdsDiffer || gradeLevelsDiffer) {
            repairOps.push({
                type: 'UPDATE',
                rowId: row.id,
                facultyId: row.facultyId,
                facultyName,
                subjectId: row.subjectId,
                subjectCode: row.subject.code,
                oldSectionIds: sortedInts(row.sectionIds),
                newSectionIds: effectiveSectionIds,
                oldGradeLevels: sortedInts(row.gradeLevels),
                newGradeLevels: derivedGradeLevels,
                reasons,
            });
        }
    }
    const updateOps = repairOps.filter((op) => op.type === 'UPDATE');
    const deleteOps = repairOps.filter((op) => op.type === 'DELETE');
    console.log(`Repair plan:`);
    console.log(`  Updates : ${updateOps.length}`);
    console.log(`  Deletes : ${deleteOps.length}`);
    console.log(`  Total   : ${repairOps.length}\n`);
    // ── 6. Apply repairs ──────────────────────────────────────────────────────
    if (options.apply && repairOps.length > 0) {
        console.log('Applying repairs in serializable transaction...');
        await prisma.$transaction(async (tx) => {
            for (const op of updateOps) {
                await tx.facultySubject.update({
                    where: { id: op.rowId },
                    data: {
                        sectionIds: op.newSectionIds,
                        gradeLevels: op.newGradeLevels,
                        version: { increment: 1 },
                    },
                });
            }
            for (const op of deleteOps) {
                await tx.facultySubject.delete({ where: { id: op.rowId } });
            }
        }, { isolationLevel: 'Serializable' });
        console.log(`Applied: ${updateOps.length} update(s), ${deleteOps.length} delete(s).\n`);
    }
    else if (!options.apply && repairOps.length > 0) {
        console.log('Dry-run mode — no DB changes made. Pass --apply to commit.\n');
    }
    else {
        console.log('No repair ops needed.\n');
    }
    // ── 7. Post-repair validation ─────────────────────────────────────────────
    // Re-query rows as they stand now (post-apply or same as before for dry-run)
    const postRows = await prisma.facultySubject.findMany({
        where: { schoolId: options.schoolId },
        select: {
            facultyId: true,
            subjectId: true,
            sectionIds: true,
            gradeLevels: true,
            subject: { select: { minMinutesPerWeek: true } },
            faculty: { select: { firstName: true, lastName: true } },
        },
    });
    // If dry-run, simulate what the post state would look like
    const validationRows = options.apply
        ? postRows
        : postRows.map((row) => {
            const op = repairOps.find((o) => o.facultyId === row.facultyId && o.subjectId === row.subjectId);
            if (!op)
                return row;
            if (op.type === 'DELETE')
                return null;
            return { ...row, sectionIds: op.newSectionIds, gradeLevels: op.newGradeLevels };
        }).filter((r) => r !== null);
    const postDuplicates = detectDuplicateOwnershipTuples(validationRows.map((row) => ({
        facultyId: row.facultyId,
        facultyName: formatFullName(row.faculty.firstName, row.faculty.lastName),
        subjectId: row.subjectId,
        sectionIds: sortedInts(row.sectionIds),
    })));
    // Compute per-faculty load mismatch count post-repair
    const postByFaculty = new Map();
    for (const row of validationRows) {
        const list = postByFaculty.get(row.facultyId) ?? [];
        list.push(row);
        postByFaculty.set(row.facultyId, list);
    }
    let postMismatchCount = 0;
    for (const assignments of postByFaculty.values()) {
        const sectionMins = computeTeachingLoadMinutes(assignments, 'section');
        const gradeMins = computeTeachingLoadMinutes(assignments, 'grade');
        if (sectionMins !== gradeMins)
            postMismatchCount++;
    }
    const postValidation = {
        remainingDuplicateOwnershipTuples: postDuplicates.length,
        remainingMismatchedLoadFaculty: postMismatchCount,
        note: options.apply
            ? 'computed from live DB post-apply'
            : 'simulated — based on planned ops applied to pre-repair data',
    };
    // ── 8. Write ledger ───────────────────────────────────────────────────────
    const ledger = {
        generatedAt: new Date().toISOString(),
        schoolId: options.schoolId,
        mode: options.apply ? 'applied' : 'dry-run',
        priorState: {
            totalRows: rows.length,
            duplicateOwnershipTuples: duplicateTuples.length,
        },
        conflictResolution: {
            totalConflictingTuples: duplicateTuples.length,
            entries: conflictResolutions,
        },
        repairOps: {
            updates: updateOps.length,
            deletes: deleteOps.length,
            ops: repairOps,
        },
        postRepairValidation: postValidation,
    };
    mkdirSync(path.dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    // ── 9. Console summary ────────────────────────────────────────────────────
    console.log(`${'─'.repeat(60)}`);
    console.log('  Post-repair validation');
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Remaining duplicate ownership tuples : ${postValidation.remainingDuplicateOwnershipTuples}${postValidation.remainingDuplicateOwnershipTuples === 0 ? ' ✓' : ' ✗'}`);
    console.log(`  Faculty with section≠grade load mismatch: ${postValidation.remainingMismatchedLoadFaculty}`);
    console.log(`  (${postValidation.note})`);
    console.log(`${'─'.repeat(60)}\n`);
    if (postDuplicates.length > 0) {
        console.log('  Unresolved duplicate tuples (manual review required):');
        for (const t of postDuplicates) {
            const owners = t.owners.map((o) => `${o.facultyName}(#${o.facultyId})`).join(' | ');
            console.log(`    subjectId=${t.subjectId}, sectionId=${t.sectionId} → ${owners}`);
        }
        console.log();
    }
    if (conflictResolutions.length > 0 && !options.apply) {
        console.log('  Conflict resolutions planned (top 10):');
        for (const entry of conflictResolutions.slice(0, 10)) {
            console.log(`    subject=${entry.subjectId}, section=${entry.sectionId} → winner=#${entry.winner.facultyId} ${entry.winner.facultyName}`);
        }
        if (conflictResolutions.length > 10) {
            console.log(`    ... and ${conflictResolutions.length - 10} more (see ledger).`);
        }
        console.log();
    }
    console.log(`  Ledger written to: ${options.outputPath}\n`);
    if (!options.apply && repairOps.length > 0) {
        console.log(`  Re-run with --apply to commit ${repairOps.length} repair op(s).\n`);
    }
}
run()
    .catch((error) => {
    console.error('\nRepair script failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
