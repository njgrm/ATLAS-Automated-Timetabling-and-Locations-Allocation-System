import { prisma } from '../lib/prisma.js';
import type { ScheduledEntry } from './constraint-validator.js';
import { buildSpecialEventSlots } from './schedule-constructor.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
import { reconcileInvalidPublishedRunStates } from './generation.service.js';

type PublishedRunSource = {
	runId: number;
	schoolId: number;
	schoolYearId: number;
	schoolYearLabel: string | null;
	isActiveSchoolYear: boolean;
	isHistorical: boolean;
	publishedAt: string | null;
	generatedAt: string | null;
	requestedDate: string | null;
	resolvedForDate: string;
	activeRevisionId: number | null;
	activeRevisionEffectiveDate: string | null;
	appliedRevisionIds: number[];
	revisionMarker: string;
};

type PublishedScheduleReadOptions = {
	requestedDate?: string | Date | null;
};

type RevisionCandidate = {
	id: number;
	effectiveDate: Date;
	changeSet: unknown;
};

type SectionReference = {
	atlasId: number | null;
	name: string;
	gradeLevel: number | null;
	gradeLevelName: string | null;
	programType: string | null;
	programCode: string | null;
	programName: string | null;
};

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

function readPublishedAt(summary: unknown): string | null {
	if (!summary || typeof summary !== 'object') return null;
	const value = (summary as Record<string, unknown>).publishedAt;
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRunPublished(summary: unknown): boolean {
	if (!summary || typeof summary !== 'object') return false;
	return (summary as Record<string, unknown>).isPublished === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveReadDate(value: string | Date | null | undefined): { readDate: Date; requestedDate: string | null } {
	if (value == null || value === '') {
		return { readDate: new Date(), requestedDate: null };
	}

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw err(400, 'PUBLISHED_SCHEDULE_DATE_INVALID', 'Published schedule date must be a valid date.');
		}
		return { readDate: value, requestedDate: value.toISOString() };
	}

	const requestedDate = value.trim();
	if (!requestedDate) return { readDate: new Date(), requestedDate: null };

	const readDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
		? new Date(`${requestedDate}T12:00:00.000Z`)
		: new Date(requestedDate);

	if (Number.isNaN(readDate.getTime())) {
		throw err(400, 'PUBLISHED_SCHEDULE_DATE_INVALID', 'Published schedule date must be a valid date or ISO date string.');
	}

	return { readDate, requestedDate };
}

function readRevisionChanges(changeSet: unknown): Array<{ entryId: string; next: Record<string, unknown> }> {
	if (!Array.isArray(changeSet)) return [];

	return changeSet.flatMap((change) => {
		if (!isRecord(change)) return [];
		const entryId = typeof change.entryId === 'string' ? change.entryId.trim() : '';
		if (!entryId || !isRecord(change.next)) return [];
		return [{ entryId, next: change.next }];
	});
}

const REVISION_ENTRY_FIELDS = new Set([
	'facultyId',
	'roomId',
	'subjectId',
	'subjectCode',
	'sectionId',
	'day',
	'startTime',
	'endTime',
	'durationMinutes',
	'termIndex',
	'entryKind',
	'programType',
	'programCode',
	'programName',
	'cohortCode',
	'cohortName',
	'specializationCode',
	'specializationName',
	'cohortMemberSectionIds',
	'cohortExpectedEnrollment',
	'adviserId',
	'adviserName',
	'metadata',
]);

function applyRevisionValues(entry: ScheduledEntry, nextValues: Record<string, unknown>): ScheduledEntry {
	const nextEntry = { ...entry } as Record<string, unknown>;
	for (const [key, value] of Object.entries(nextValues)) {
		if (!REVISION_ENTRY_FIELDS.has(key) || value === undefined) continue;
		nextEntry[key] = value;
	}
	return nextEntry as unknown as ScheduledEntry;
}

function applyPublishedRevisions(entries: ScheduledEntry[], revisions: RevisionCandidate[]): ScheduledEntry[] {
	if (revisions.length === 0) return entries;

	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	let changed = false;

	for (const revision of revisions) {
		for (const change of readRevisionChanges(revision.changeSet)) {
			const current = entriesById.get(change.entryId);
			if (!current) continue;
			entriesById.set(change.entryId, applyRevisionValues(current, change.next));
			changed = true;
		}
	}

	return changed ? entries.map((entry) => entriesById.get(entry.entryId) ?? entry) : entries;
}

function buildRevisionMarker(params: {
	runId: number;
	publishedAt: string | null;
	activeRevisionId: number | null;
	activeRevisionEffectiveDate: string | null;
	resolvedForDate: string;
}): string {
	return [
		`run=${params.runId}`,
		`published=${params.publishedAt ?? 'none'}`,
		`revision=${params.activeRevisionId ?? 'base'}`,
		`effective=${params.activeRevisionEffectiveDate ?? 'none'}`,
		`date=${params.resolvedForDate.slice(0, 10)}`,
	].join('|');
}

async function resolvePublishedRun(
	schoolId: number,
	schoolYearId?: number,
	options?: PublishedScheduleReadOptions,
	filter?: { sectionId?: number; facultyId?: number; roomId?: number },
	activeSchoolYearId?: number | null,
) {
	await reconcileInvalidPublishedRunStates(schoolId, {
		schoolYearId,
		reason: 'PUBLISHED_ENDPOINT_INTEGRITY_RECONCILIATION',
	});

	const { readDate, requestedDate } = resolveReadDate(options?.requestedDate);

	const candidates = await prisma.generationRun.findMany({
		where: {
			schoolId,
			status: 'COMPLETED',
			...(schoolYearId ? { schoolYearId } : {}),
		},
		orderBy: [{ createdAt: 'desc' }],
		select: {
			id: true,
			schoolId: true,
			schoolYearId: true,
			summary: true,
			finishedAt: true,
			createdAt: true,
		},
		take: 200,
	});

	const publishedRunMeta = candidates.find((candidate) => isRunPublished(candidate.summary));
	if (!publishedRunMeta) {
		throw err(404, 'PUBLISHED_RUN_NOT_FOUND', 'No published schedule is available for the requested scope.');
	}

	const applicableRevisions = await prisma.publishedScheduleRevision.findMany({
		where: {
			schoolId: publishedRunMeta.schoolId,
			schoolYearId: publishedRunMeta.schoolYearId,
			sourceRunId: publishedRunMeta.id,
			status: { in: ['SCHEDULED', 'SUPERSEDED'] },
			effectiveDate: { lte: readDate },
		},
		orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
		select: {
			id: true,
			effectiveDate: true,
			changeSet: true,
		},
	});

	let draftEntries: ScheduledEntry[] = [];

	if (filter && (filter.sectionId !== undefined || filter.facultyId !== undefined || filter.roomId !== undefined)) {
		const filterConds: string[] = [];
		const params: any[] = [publishedRunMeta.id];
		let paramIdx = 2;

		if (filter.sectionId !== undefined) {
			filterConds.push(`(elem->>'sectionId')::int = $${paramIdx++}`);
			params.push(filter.sectionId);
		}
		if (filter.facultyId !== undefined) {
			filterConds.push(`(elem->>'facultyId')::int = $${paramIdx++}`);
			params.push(filter.facultyId);
		}
		if (filter.roomId !== undefined) {
			filterConds.push(`(elem->>'roomId')::int = $${paramIdx++}`);
			params.push(filter.roomId);
		}

		const rawQuery = `
			SELECT elem
			FROM "generation_runs" r,
				jsonb_array_elements(r."draft_entries") WITH ORDINALITY AS entry(elem, ord)
			WHERE r.id = $1 AND (${filterConds.join(' AND ')})
			ORDER BY entry.ord ASC
		`;

		const rows = await prisma.$queryRawUnsafe<{ elem: unknown }[]>(rawQuery, ...params);
		draftEntries = rows.map((row) => row.elem) as ScheduledEntry[];
	} else {
		const publishedRunEntries = await prisma.generationRun.findUnique({
			where: { id: publishedRunMeta.id },
			select: { draftEntries: true },
		});
		draftEntries = (publishedRunEntries?.draftEntries ?? []) as unknown as ScheduledEntry[];
	}

	const activeRevision = applicableRevisions.at(-1) ?? null;
	const publishedAt = readPublishedAt(publishedRunMeta.summary);
	const generatedAt = publishedRunMeta.finishedAt?.toISOString() ?? publishedRunMeta.createdAt.toISOString();
	const resolvedForDate = readDate.toISOString();
	const activeRevisionEffectiveDate = activeRevision?.effectiveDate.toISOString() ?? null;

	// Resolve school year label and active/historical status
	const isActiveYear = activeSchoolYearId != null && publishedRunMeta.schoolYearId === activeSchoolYearId;
	let schoolYearLabel: string | null = null;
	if (activeSchoolYearId != null && publishedRunMeta.schoolYearId === activeSchoolYearId) {
		const mirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, enrollProSchoolYearId: publishedRunMeta.schoolYearId },
			select: { yearLabel: true },
		});
		schoolYearLabel = mirror?.yearLabel ?? null;
	} else {
		const mirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, enrollProSchoolYearId: publishedRunMeta.schoolYearId },
			select: { yearLabel: true },
		});
		schoolYearLabel = mirror?.yearLabel ?? null;
	}

	return {
		source: {
			runId: publishedRunMeta.id,
			schoolId: publishedRunMeta.schoolId,
			schoolYearId: publishedRunMeta.schoolYearId,
			schoolYearLabel,
			isActiveSchoolYear: isActiveYear,
			isHistorical: !isActiveYear,
			publishedAt,
			generatedAt,
			requestedDate,
			resolvedForDate,
			activeRevisionId: activeRevision?.id ?? null,
			activeRevisionEffectiveDate,
			appliedRevisionIds: applicableRevisions.map((revision) => revision.id),
			revisionMarker: buildRevisionMarker({
				runId: publishedRunMeta.id,
				publishedAt,
				activeRevisionId: activeRevision?.id ?? null,
				activeRevisionEffectiveDate,
				resolvedForDate,
			}),
		} satisfies PublishedRunSource,
		entries: applyPublishedRevisions(draftEntries, applicableRevisions),
		summary: (publishedRunMeta.summary ?? null) as Record<string, unknown> | null,
	};
}

async function loadReferenceMaps(
	schoolId: number,
	schoolYearId: number,
	sectionIds: number[],
	subjectIds: number[],
	facultyIds: number[],
	roomIds: number[]
) {
	const [subjects, faculty, rooms, sectionMirrors, cohorts, ownershipRows] = await Promise.all([
		prisma.subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true, name: true },
		}),
		prisma.facultyMirror.findMany({
			where: { schoolId, id: { in: facultyIds } },
			select: { id: true, externalId: true, employeeId: true, firstName: true, lastName: true, isPlaceholder: true },
		}),
		prisma.room.findMany({
			where: { building: { schoolId }, id: { in: roomIds } },
			select: { id: true, name: true, type: true, floor: true, building: { select: { id: true, name: true } } },
		}),
		prisma.sectionMirror.findMany({
			where: {
				schoolId,
				schoolYearId,
				externalId: { in: sectionIds },
			},
			select: {
				id: true,
				externalId: true,
				name: true,
				gradeLevelId: true,
				gradeLevelName: true,
				programType: true,
				programCode: true,
				programName: true,
			},
		}),
		prisma.instructionalCohort.findMany({
			where: { schoolId, schoolYearId, isActive: true },
			select: {
				cohortCode: true,
				specializationCode: true,
				specializationName: true,
			},
		}),
		sectionIds.length > 0 && subjectIds.length > 0
			? prisma.subjectSectionOwnership.findMany({
				where: {
					schoolId,
					sectionId: { in: sectionIds },
					subjectId: { in: subjectIds },
					OR: [
						{ specializationCode: { not: null } },
						{ specializationLabel: { not: null } },
					],
				},
				select: {
					subjectId: true,
					sectionId: true,
					specializationCode: true,
					specializationLabel: true,
				},
			})
			: Promise.resolve([]),
	]);

	const sectionNameById = new Map<number, string>();
	const sectionById = new Map<number, SectionReference>();

	for (const section of sectionMirrors) {
		sectionNameById.set(section.externalId, section.name);
		sectionById.set(section.externalId, {
			atlasId: section.id,
			name: section.name,
			gradeLevel: section.gradeLevelId,
			gradeLevelName: section.gradeLevelName,
			programType: section.programType,
			programCode: section.programCode,
			programName: section.programName,
		});
	}

	// Only load sectionSnapshot payload if there are sectionIds missing from the mirrors
	const missingSectionIds = sectionIds.filter((id) => !sectionNameById.has(id));
	if (missingSectionIds.length > 0) {
		const sectionSnapshot = await prisma.sectionSnapshot.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { payload: true },
		});

		if (sectionSnapshot?.payload && Array.isArray(sectionSnapshot.payload)) {
			for (const grade of sectionSnapshot.payload as Array<{ sections?: Array<{ id?: number; name?: string }> }>) {
				for (const section of grade.sections ?? []) {
					if (typeof section.id === 'number' && typeof section.name === 'string') {
						if (!sectionNameById.has(section.id)) {
							sectionNameById.set(section.id, section.name);
						}
					}
				}
			}
		}
	}

	const specializationBySubjectSection = new Map<string, { specializationCode: string | null; specializationLabel: string | null }>();
	for (const row of ownershipRows) {
		const key = `${row.subjectId}:${row.sectionId}`;
		if (specializationBySubjectSection.has(key)) continue;
		specializationBySubjectSection.set(key, {
			specializationCode: row.specializationCode ?? null,
			specializationLabel: row.specializationLabel ?? null,
		});
	}

	const cohortByCode = new Map(
		cohorts.map((cohort) => [cohort.cohortCode, {
			specializationCode: cohort.specializationCode,
			specializationName: cohort.specializationName,
		}]),
	);

	return {
		subjectById: new Map(subjects.map((subject) => [subject.id, subject])),
		facultyById: new Map(faculty.map((member) => [member.id, {
			atlasId: member.id,
			externalId: member.externalId,
			employeeId: member.employeeId ?? null,
			name: `${member.lastName}, ${member.firstName}`,
			isPlaceholder: member.isPlaceholder,
		}])),
		roomById: new Map(rooms.map((room) => [room.id, room])),
		sectionById,
		sectionNameById,
		cohortByCode,
		specializationBySubjectSection,
	};
}

function buildSpecialEventsPayload(policy: Awaited<ReturnType<typeof getOrCreatePolicy>>) {
	const specialEvents = buildSpecialEventSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: policy.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: policy.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay,
		earliestStartTime: policy.earliestStartTime,
		latestEndTime: policy.latestEndTime,
		lunchStartTime: policy.lunchStartTime ?? undefined,
		lunchEndTime: policy.lunchEndTime ?? undefined,
		enforceLunchWindow: policy.enforceLunchWindow ?? undefined,
		enableLunchWindow: policy.enableLunchWindow ?? undefined,
		enableFlagCeremony: policy.enableFlagCeremony ?? undefined,
		flagCeremonyStartTime: policy.flagCeremonyStartTime ?? undefined,
		flagCeremonyEndTime: policy.flagCeremonyEndTime ?? undefined,
		enableRecess: policy.enableRecess ?? undefined,
		recessStartTime: policy.recessStartTime ?? undefined,
		recessEndTime: policy.recessEndTime ?? undefined,
	});

	return specialEvents.map((event) => ({
		eventName: event.eventName,
		startTime: event.startTime,
		endTime: event.endTime,
		days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
	}));
}

export async function getPublishedSchedulePayload(
	schoolId: number,
	schoolYearId?: number,
	options?: PublishedScheduleReadOptions,
	filter?: { sectionId?: number; facultyId?: number; roomId?: number },
	activeSchoolYearId?: number | null,
) {
	const resolved = await resolvePublishedRun(schoolId, schoolYearId, options, filter, activeSchoolYearId);

	const filteredEntries = filter
		? resolved.entries.filter((entry) => {
				if (filter.sectionId !== undefined && entry.sectionId !== filter.sectionId) return false;
				if (filter.facultyId !== undefined && entry.facultyId !== filter.facultyId) return false;
				if (filter.roomId !== undefined && entry.roomId !== filter.roomId) return false;
				return true;
		  })
		: resolved.entries;

	const policy = await getOrCreatePolicy(resolved.source.schoolId, resolved.source.schoolYearId);

	const sectionIds = Array.from(new Set(filteredEntries.map((entry) => entry.sectionId)));
	const subjectIds = Array.from(new Set(filteredEntries.map((entry) => entry.subjectId)));
	const facultyIds = Array.from(new Set(filteredEntries.map((entry) => entry.facultyId).filter((id): id is number => id != null)));
	const roomIds = Array.from(new Set(filteredEntries.map((entry) => entry.roomId)));

	const references = await loadReferenceMaps(
		resolved.source.schoolId,
		resolved.source.schoolYearId,
		sectionIds,
		subjectIds,
		facultyIds,
		roomIds
	);

	const entries = filteredEntries.map((entry) => {
		const subject = references.subjectById.get(entry.subjectId);
		const room = references.roomById.get(entry.roomId);
		const section = references.sectionById.get(entry.sectionId);
		const cohort = entry.cohortCode ? references.cohortByCode.get(entry.cohortCode) : null;
		const ownershipSpecialization = references.specializationBySubjectSection.get(`${entry.subjectId}:${entry.sectionId}`);
		const specializationCode = cohort?.specializationCode ?? ownershipSpecialization?.specializationCode ?? null;
		const specializationLabel = cohort?.specializationName ?? ownershipSpecialization?.specializationLabel ?? null;
		return {
			entryId: entry.entryId,
			day: entry.day,
			startTime: entry.startTime,
			endTime: entry.endTime,
			durationMinutes: entry.durationMinutes,
			subject: {
				id: entry.subjectId,
				code: subject?.code ?? `SUBJECT_${entry.subjectId}`,
				name: subject?.name ?? 'Unknown Subject',
			},
			section: {
				atlasId: section?.atlasId ?? null,
				externalId: entry.sectionId,
				id: entry.sectionId,
				name: section?.name ?? references.sectionNameById.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
				gradeLevel: section?.gradeLevel ?? null,
				gradeLevelName: section?.gradeLevelName ?? null,
				programType: section?.programType ?? null,
				programCode: section?.programCode ?? null,
				programName: section?.programName ?? null,
			},
			faculty: {
				atlasId: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.atlasId ?? entry.facultyId) : null,
				externalId: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.externalId ?? null) : null,
				employeeId: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.employeeId ?? null) : null,
				id: entry.facultyId,
				name: entry.facultyId != null
					? (references.facultyById.get(entry.facultyId)?.name ?? `Faculty #${entry.facultyId}`)
					: 'Unassigned Faculty',
				isPlaceholder: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.isPlaceholder ?? false) : false,
			},
			room: {
				id: entry.roomId,
				name: room?.name ?? `Room #${entry.roomId}`,
				type: room?.type ?? 'UNKNOWN',
				floor: room?.floor ?? null,
				buildingId: room?.building.id ?? null,
				buildingName: room?.building.name ?? null,
			},
			entryKind: entry.entryKind ?? 'SECTION',
			cohortCode: entry.cohortCode ?? null,
			cohortName: entry.cohortName ?? cohort?.specializationName ?? null,
			specializationCode,
			specializationLabel,
		};
	});

	const summaryDisplaySlots = Array.isArray(resolved.summary?.timetableDisplaySlots)
		? (resolved.summary?.timetableDisplaySlots as Array<{ startTime: string; endTime: string; eventName?: string; isSpecialEvent?: boolean }>)
		: [];
	const timeSlots = summaryDisplaySlots.length > 0
		? summaryDisplaySlots
		: Array.from(new Set(entries.map((entry) => `${entry.startTime}-${entry.endTime}`)))
			.map((key) => {
				const [startTime, endTime] = key.split('-');
				return { startTime, endTime };
			})
			.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

	return {
		source: resolved.source,
		timeSlots,
		specialEvents: buildSpecialEventsPayload(policy),
		entries,
	};
}

export async function getPublishedSectionSchedule(schoolId: number, sectionId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { sectionId });
}

export async function getPublishedFacultySchedule(schoolId: number, facultyId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { facultyId });
}

export async function getPublishedRoomSchedule(schoolId: number, roomId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { roomId });
}

export async function getPublishedFacultyScheduleByExternalId(schoolId: number, externalFacultyId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	const mirror = await prisma.facultyMirror.findFirst({
		where: { schoolId, externalId: externalFacultyId },
		select: { id: true },
	});
	if (!mirror) {
		const e = new Error(`No faculty mirror found for external ID ${externalFacultyId}.`) as Error & { statusCode: number; code: string };
		e.statusCode = 404;
		e.code = 'FACULTY_NOT_FOUND';
		throw e;
	}
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { facultyId: mirror.id });
}
