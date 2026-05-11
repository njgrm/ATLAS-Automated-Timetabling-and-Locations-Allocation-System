/**
 * Faculty service - Wave 3.5 Source-of-Truth Hardening
 *
 * Features:
 * - Full reconciliation with optional prune mode
 * - Durable cache with auto-save and auto-fallback
 * - Stale teachers hidden by default
 * - Adviser mapping support
 */

import crypto from 'crypto';

import { prisma } from '../lib/prisma.js';
import { createFacultyAdapter, type ExternalFaculty, type FacultyFetchResult } from './faculty-adapter.js';
import { invalidateStaleCompletedRuns } from './generation.service.js';
import { seedQualifiedAssignments } from './assignment-seed.service.js';
import { sectionAdapter } from './section-adapter.js';

const adapter = createFacultyAdapter();

export type FacultySourceLabel = 'enrollpro' | 'cached-enrollpro' | 'stub';
export type FacultySyncMode = 'reconcile' | 'prune';

export interface FacultyReconciliationSummary {
inserted: number;
updated: number;
removed: number;
skipped: number;
deactivated: number;
}

export interface AssignmentScopePruneSummary {
updated: number;
removed: number;
unchanged: number;
}

export interface FacultySyncOptions {
mode?: FacultySyncMode;
pruneSectionAssignments?: boolean;
invalidateRuns?: boolean;
}

export interface FacultySyncResult {
synced: boolean;
error?: string;
source: FacultySourceLabel;
fetchedAt: Date;
activeCount: number;
staleCount: number;
deactivatedCount: number;
mode: FacultySyncMode;
reconciliation: FacultyReconciliationSummary;
assignmentPrune: AssignmentScopePruneSummary;
invalidatedRuns: { invalidatedCount: number; staleRunIds: number[] };
seededAssignments: { created: number; skipped: number };
isStale?: boolean;
staleReason?: string;
}

export interface FacultyListResult {
faculty: Awaited<ReturnType<typeof prisma.facultyMirror.findMany>>;
source: FacultySourceLabel;
fetchedAt: Date | null;
isStale: boolean;
staleReason?: string;
activeCount: number;
staleCount: number;
}

interface LocalMirrorComparable {
id: number;
externalId: number;
firstName: string;
lastName: string;
department: string | null;
specialization: string | null;
employmentStatus: string;
isClassAdviser: boolean;
advisoryEquivalentHours: number;
canTeachOutsideDepartment: boolean;
contactInfo: string | null;
advisedSectionId: number | null;
advisedSectionName: string | null;
isStale: boolean;
}

export interface AssignmentScopeSnapshot {
id: number;
sectionIds: number[];
gradeLevels: number[];
}

export interface AssignmentScopeReconcileDecision {
id: number;
action: 'skip' | 'update' | 'remove';
sectionIds: number[];
gradeLevels: number[];
}

function computeChecksum(payload: unknown): string {
return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function saveSnapshot(schoolId: number, schoolYearId: number, data: FacultyFetchResult): Promise<void> {
const checksum = computeChecksum(data.teachers);
await prisma.facultySnapshot.upsert({
where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
update: {
payload: data.teachers as any,
source: data.source,
fetchedAt: data.fetchedAt,
checksum,
},
create: {
schoolId,
schoolYearId,
payload: data.teachers as any,
source: data.source,
fetchedAt: data.fetchedAt,
checksum,
},
});
}

async function loadSnapshot(
schoolId: number,
schoolYearId: number,
): Promise<{ teachers: ExternalFaculty[]; fetchedAt: Date } | null> {
const snapshot = await prisma.facultySnapshot.findUnique({
where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
});
if (!snapshot) return null;
return {
teachers: snapshot.payload as unknown as ExternalFaculty[],
fetchedAt: snapshot.fetchedAt,
};
}

function toExternalComparable(faculty: ExternalFaculty) {
return {
firstName: faculty.firstName,
lastName: faculty.lastName,
department: faculty.department ?? null,
specialization: faculty.specialization ?? null,
employmentStatus: faculty.employmentStatus ?? 'PERMANENT',
isClassAdviser: faculty.isClassAdviser ?? false,
advisoryEquivalentHours: faculty.advisoryEquivalentHours ?? (faculty.isClassAdviser ? 5 : 0),
canTeachOutsideDepartment: faculty.canTeachOutsideDepartment ?? false,
contactInfo: faculty.contactInfo ?? null,
advisedSectionId: faculty.advisedSectionId ?? null,
advisedSectionName: faculty.advisedSectionName ?? null,
};
}

function isMirrorEquivalent(local: LocalMirrorComparable, external: ExternalFaculty): boolean {
const normalized = toExternalComparable(external);
return (
local.firstName === normalized.firstName
&& local.lastName === normalized.lastName
&& local.department === normalized.department
&& local.specialization === normalized.specialization
&& local.employmentStatus === normalized.employmentStatus
&& local.isClassAdviser === normalized.isClassAdviser
&& local.advisoryEquivalentHours === normalized.advisoryEquivalentHours
&& local.canTeachOutsideDepartment === normalized.canTeachOutsideDepartment
&& local.contactInfo === normalized.contactInfo
&& local.advisedSectionId === normalized.advisedSectionId
&& local.advisedSectionName === normalized.advisedSectionName
&& local.isStale === false
);
}

export function buildFacultyReconciliationSummary(
external: ExternalFaculty[],
localMirrors: LocalMirrorComparable[],
mode: FacultySyncMode,
): FacultyReconciliationSummary {
const localByExternalId = new Map(localMirrors.map((mirror) => [mirror.externalId, mirror]));
let inserted = 0;
let updated = 0;
let skipped = 0;

for (const faculty of external) {
const local = localByExternalId.get(faculty.id);
if (!local) {
inserted += 1;
continue;
}

if (isMirrorEquivalent(local, faculty)) {
skipped += 1;
} else {
updated += 1;
}
}

const externalIds = new Set(external.map((faculty) => faculty.id));
const missingCount = localMirrors.filter((mirror) => !externalIds.has(mirror.externalId)).length;

return {
inserted,
updated,
removed: mode === 'prune' ? missingCount : 0,
skipped,
deactivated: mode === 'reconcile' ? missingCount : 0,
};
}

export function reconcileAssignmentScopesToSections(
assignments: AssignmentScopeSnapshot[],
sectionDisplayOrderById: Map<number, number>,
): AssignmentScopeReconcileDecision[] {
return assignments.map((assignment) => {
const nextSectionIds = Array.from(
new Set((assignment.sectionIds ?? []).filter((sectionId) => sectionDisplayOrderById.has(sectionId))),
).sort((left, right) => left - right);

if (nextSectionIds.length === 0) {
return {
id: assignment.id,
action: 'remove',
sectionIds: [],
gradeLevels: [],
};
}

const nextGradeLevels = Array.from(
new Set(
nextSectionIds
.map((sectionId) => sectionDisplayOrderById.get(sectionId) ?? 0)
.filter((value) => value > 0),
),
).sort((left, right) => left - right);

const currentSectionIds = [...(assignment.sectionIds ?? [])].sort((left, right) => left - right);
const currentGradeLevels = [...(assignment.gradeLevels ?? [])].sort((left, right) => left - right);
const sameSections = JSON.stringify(nextSectionIds) === JSON.stringify(currentSectionIds);
const sameGrades = JSON.stringify(nextGradeLevels) === JSON.stringify(currentGradeLevels);

return {
id: assignment.id,
action: sameSections && sameGrades ? 'skip' : 'update',
sectionIds: nextSectionIds,
gradeLevels: nextGradeLevels,
};
});
}

async function pruneFacultyAssignmentScopes(
schoolId: number,
schoolYearId: number,
authToken?: string,
): Promise<AssignmentScopePruneSummary> {
const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
const sectionDisplayOrderById = new Map<number, number>();
for (const gradeLevel of sectionResult.gradeLevels) {
for (const section of gradeLevel.sections) {
sectionDisplayOrderById.set(section.id, gradeLevel.displayOrder);
}
}

const assignments = await prisma.facultySubject.findMany({
where: { schoolId },
select: { id: true, sectionIds: true, gradeLevels: true },
});

const decisions = reconcileAssignmentScopesToSections(assignments, sectionDisplayOrderById);
const updates = decisions.filter((decision) => decision.action === 'update');
const removals = decisions.filter((decision) => decision.action === 'remove').map((decision) => decision.id);

await prisma.$transaction(async (tx) => {
if (removals.length > 0) {
await tx.facultySubject.deleteMany({ where: { id: { in: removals } } });
}

for (const decision of updates) {
await tx.facultySubject.update({
where: { id: decision.id },
data: {
sectionIds: decision.sectionIds,
gradeLevels: decision.gradeLevels,
},
});
}
});

return {
updated: updates.length,
removed: removals.length,
unchanged: decisions.filter((decision) => decision.action === 'skip').length,
};
}

export async function syncFacultyFromExternal(
schoolId: number,
schoolYearId: number,
authToken?: string,
options: FacultySyncOptions = {},
): Promise<FacultySyncResult> {
const mode: FacultySyncMode = options.mode ?? 'reconcile';
let fetchResult: FacultyFetchResult;
let isStale = false;
let staleReason: string | undefined;
let sourceLabel: FacultySourceLabel;

try {
fetchResult = await adapter.fetchFacultyBySchoolYear(schoolId, schoolYearId, authToken);
sourceLabel = fetchResult.source === 'stub' ? 'stub' : 'enrollpro';
await saveSnapshot(schoolId, schoolYearId, fetchResult);
} catch (err) {
const cached = await loadSnapshot(schoolId, schoolYearId);
if (cached) {
fetchResult = {
teachers: cached.teachers,
source: 'enrollpro',
fetchedAt: cached.fetchedAt,
};
sourceLabel = 'cached-enrollpro';
isStale = true;
staleReason = err instanceof Error ? err.message : 'Upstream unavailable';
} else {
return {
synced: false,
error: 'UPSTREAM_UNAVAILABLE: Faculty source unreachable and no cached snapshot exists.',
source: 'enrollpro',
fetchedAt: new Date(),
activeCount: 0,
staleCount: 0,
deactivatedCount: 0,
mode,
reconciliation: { inserted: 0, updated: 0, removed: 0, skipped: 0, deactivated: 0 },
assignmentPrune: { updated: 0, removed: 0, unchanged: 0 },
invalidatedRuns: { invalidatedCount: 0, staleRunIds: [] },
seededAssignments: { created: 0, skipped: 0 },
isStale: true,
staleReason: 'No upstream and no cache',
};
}
}

const external = fetchResult.teachers;
const externalIds = new Set(external.map((f) => f.id));

const localTeachers = await prisma.facultyMirror.findMany({
where: { schoolId },
select: {
id: true,
externalId: true,
firstName: true,
lastName: true,
department: true,
specialization: true,
employmentStatus: true,
isClassAdviser: true,
advisoryEquivalentHours: true,
canTeachOutsideDepartment: true,
contactInfo: true,
advisedSectionId: true,
advisedSectionName: true,
isStale: true,
},
});

const reconciliation = buildFacultyReconciliationSummary(external, localTeachers, mode);

for (const f of external) {
await prisma.facultyMirror.upsert({
where: { schoolId_externalId: { schoolId, externalId: f.id } },
update: {
firstName: f.firstName,
lastName: f.lastName,
department: f.department,
specialization: f.specialization ?? null,
employmentStatus: f.employmentStatus ?? 'PERMANENT',
isClassAdviser: f.isClassAdviser ?? false,
advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
contactInfo: f.contactInfo,
advisedSectionId: f.advisedSectionId ?? null,
advisedSectionName: f.advisedSectionName ?? null,
lastSyncedAt: new Date(),
isStale: false,
staleReason: null,
staleAt: null,
},
create: {
externalId: f.id,
schoolId,
firstName: f.firstName,
lastName: f.lastName,
department: f.department,
specialization: f.specialization ?? null,
employmentStatus: f.employmentStatus ?? 'PERMANENT',
isClassAdviser: f.isClassAdviser ?? false,
advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
contactInfo: f.contactInfo,
advisedSectionId: f.advisedSectionId ?? null,
advisedSectionName: f.advisedSectionName ?? null,
isActiveForScheduling: true,
maxHoursPerWeek: 30,
lastSyncedAt: new Date(),
isStale: false,
},
});
}

const missingLocal = localTeachers.filter((local) => !externalIds.has(local.externalId));
let deactivatedCount = 0;

if (mode === 'prune' && missingLocal.length > 0) {
const removedFacultyIds = missingLocal.map((local) => local.id);
await prisma.$transaction(async (tx) => {
await tx.atlasAuthAccount.deleteMany({ where: { facultyId: { in: removedFacultyIds } } });
await tx.facultyMirror.deleteMany({ where: { id: { in: removedFacultyIds } } });
});
} else {
for (const local of missingLocal) {
if (local.isStale) {
continue;
}

await prisma.facultyMirror.update({
where: { id: local.id },
data: {
isStale: true,
staleReason: 'Missing from upstream during reconciliation',
staleAt: new Date(),
},
});
deactivatedCount += 1;
}
}

const assignmentPrune = options.pruneSectionAssignments === false
? { updated: 0, removed: 0, unchanged: 0 }
: await pruneFacultyAssignmentScopes(schoolId, schoolYearId, authToken);

const shouldInvalidateRuns = options.invalidateRuns !== false
&& (
(mode === 'prune' && missingLocal.length > 0)
|| deactivatedCount > 0
|| assignmentPrune.updated > 0
|| assignmentPrune.removed > 0
);

const invalidatedRuns = shouldInvalidateRuns
? await invalidateStaleCompletedRuns(schoolId, schoolYearId)
: { invalidatedCount: 0, staleRunIds: [] as number[] };

const [activeCount, staleCount] = await Promise.all([
prisma.facultyMirror.count({ where: { schoolId, isStale: false } }),
prisma.facultyMirror.count({ where: { schoolId, isStale: true } }),
]);

// Auto-seed qualified assignments for faculty whose dept matches a subject's allowedSpecializations
const seededAssignments = await seedQualifiedAssignments(schoolId, schoolYearId);

return {
synced: true,
source: sourceLabel,
fetchedAt: fetchResult.fetchedAt,
activeCount,
staleCount,
deactivatedCount,
mode,
reconciliation: {
...reconciliation,
deactivated: mode === 'reconcile' ? deactivatedCount : 0,
removed: mode === 'prune' ? missingLocal.length : 0,
},
assignmentPrune,
invalidatedRuns,
seededAssignments,
isStale,
staleReason,
};
}

export interface GetFacultyOptions {
includeStale?: boolean;
}

export async function getFacultyBySchool(
schoolId: number,
options: GetFacultyOptions = {},
): Promise<FacultyListResult> {
const { includeStale = false } = options;

const whereClause: any = { schoolId };
if (!includeStale) {
whereClause.isStale = false;
}

const [faculty, lastSyncRecord, activeCount, staleCount] = await Promise.all([
prisma.facultyMirror.findMany({
where: whereClause,
include: {
facultySubjects: {
include: { subject: { select: { id: true, name: true, code: true, minMinutesPerWeek: true, programScopes: true } } },
},
},
orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
}),
prisma.facultyMirror.findFirst({
where: { schoolId },
orderBy: { lastSyncedAt: 'desc' },
select: { lastSyncedAt: true },
}),
prisma.facultyMirror.count({ where: { schoolId, isStale: false } }),
prisma.facultyMirror.count({ where: { schoolId, isStale: true } }),
]);

return {
faculty,
source: 'enrollpro',
fetchedAt: lastSyncRecord?.lastSyncedAt ?? null,
isStale: false,
activeCount,
staleCount,
};
}

export async function getFacultyById(id: number) {
return prisma.facultyMirror.findUnique({
where: { id },
include: {
facultySubjects: {
include: { subject: true },
},
},
});
}

export async function updateFacultyMirror(
id: number,
data: Partial<{
localNotes: string;
isActiveForScheduling: boolean;
maxHoursPerWeek: number;
employmentStatus: string;
isClassAdviser: boolean;
advisoryEquivalentHours: number;
canTeachOutsideDepartment: boolean;
}>,
expectedVersion: number,
) {
const existing = await prisma.facultyMirror.findUnique({ where: { id } });
if (!existing) return { success: false as const, error: 'Faculty not found.' };
if (existing.version !== expectedVersion) {
return { success: false as const, error: 'Version conflict. Please reload.' };
}

const updated = await prisma.facultyMirror.update({
where: { id },
data: {
...data,
version: { increment: 1 },
},
});
return { success: true as const, faculty: updated };
}

export async function getFacultyCountBySchool(schoolId: number): Promise<number> {
return prisma.facultyMirror.count({
where: { schoolId, isActiveForScheduling: true, isStale: false },
});
}

export async function getLastSyncTime(schoolId: number): Promise<Date | null> {
const latest = await prisma.facultyMirror.findFirst({
where: { schoolId },
orderBy: { lastSyncedAt: 'desc' },
select: { lastSyncedAt: true },
});
return latest?.lastSyncedAt ?? null;
}

export async function getFacultyWithAdviserInfo(schoolId: number) {
return prisma.facultyMirror.findMany({
where: { schoolId, isStale: false, isClassAdviser: true },
select: {
id: true,
firstName: true,
lastName: true,
advisedSectionId: true,
advisedSectionName: true,
},
orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
});
}

export async function getHomeroomRecommendation(facultyId: number) {
const faculty = await prisma.facultyMirror.findUnique({
where: { id: facultyId },
select: {
isClassAdviser: true,
advisedSectionId: true,
advisedSectionName: true,
},
});

if (!faculty || !faculty.isClassAdviser || !faculty.advisedSectionId) {
return null;
}

return {
hasAdviserMapping: true,
advisedSectionId: faculty.advisedSectionId,
advisedSectionName: faculty.advisedSectionName,
homeroomHint: `Configure homeroom for ${faculty.advisedSectionName}`,
};
}
