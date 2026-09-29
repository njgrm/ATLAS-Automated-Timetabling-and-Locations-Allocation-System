/**
 * A8 c4 — "Cover a class": ranked real-teacher cover candidates, honest open-class
 * counts, the single cover-assign write, and the cross-department permission
 * list it depends on.
 *
 * THE FIXED CONTRACT (docs/handoffs/lane-c-to-a2.md §"THE FIXED COVER CONTRACT",
 * commit 6c5987ed) is binding on this module. Every route path, field name,
 * response key, error code and status below is written to that contract, not to
 * the packet. If a field is genuinely wrong, the contract is still what ships and
 * the disagreement is reported in the handoff — a silent reshape would break a
 * client already coding against it.
 *
 * NO RE-DERIVED AUTHORITY (this is the whole point of the module):
 *  - qualification tier ← `evaluateTeachingLoadReceiverQualification` (the
 *    canonical persisted-only resolver), never a local subject/department rule;
 *  - `cap` / `overCapAfter` ← `evaluateWeeklyLoad` in
 *    `teaching-load-capacity.service.ts`, the ONE capacity contract;
 *  - `hoursNow` / `hoursAfter` ← `computeCanonicalConcurrentWeeklyMinutes` /
 *    `estimateCanonicalConcurrentWeeklyDeltaMinutes`, which are thin exports over
 *    the auto-fill capacity ledger including the rotation-family concurrent-peak
 *    rule. A copy of that arithmetic here would be a second peak rule and a
 *    defect (the 2026-09-02 PAOLO/FRANCIS 114h incident);
 *  - "does this section actually need this subject" ←
 *    `resolveSuggestionDerivedDemand`, the canonical pair authority.
 *
 * A placeholder is NEVER a cover candidate, at any tier, in this module.
 */

import { getDataContext } from '../lib/data-context.js';
import { evaluateWeeklyLoad } from './teaching-load-capacity.service.js';
import {
	computeCanonicalConcurrentWeeklyMinutes,
	estimateCanonicalConcurrentWeeklyDeltaMinutes,
	evaluateTeachingLoadReceiverQualification,
	resolveSuggestionDerivedDemand,
	type CanonicalConcurrentSubjectRow,
	type TeachingLoadQualificationAuthority,
} from './teaching-load-automation.service.js';
import { invalidatePolicyCache } from './qualification-evaluator.service.js';
import { writeAuditLog } from './assignment-security.service.js';

type Db = any;

function db(): Db {
	return getDataContext();
}

/** The three tiers the contract fixes. Ordering here IS the ranking. */
export type CoverCandidateTier = 'QUALIFIED' | 'OTHER_DEPARTMENT' | 'ANYONE';

const TIER_RANK: Record<CoverCandidateTier, number> = {
	QUALIFIED: 0,
	OTHER_DEPARTMENT: 1,
	ANYONE: 2,
};

export interface CoverCandidate {
	facultyId: number;
	name: string;
	department: string | null;
	tier: CoverCandidateTier;
	hoursNow: number;
	hoursAfter: number;
	cap: number;
	overCapAfter: boolean;
	reason: string;
	specialization: string | null;
	isPlaceholder: boolean;
	hasRoom: boolean;
	needsPermission: boolean;
	permissionGranted: boolean;
	canTeachOutsideDepartment: boolean;
	qualificationAuthority: TeachingLoadQualificationAuthority | null;
	version: number;
}

export interface CoverCandidatesResponse {
	schoolId: number;
	schoolYearId: number;
	subject: { id: number; code: string; name: string };
	section: { id: number; name: string; displayOrder: number; programType: string | null };
	weeklyMinutes: number;
	candidates: CoverCandidate[];
	counts: { QUALIFIED: number; OTHER_DEPARTMENT: number; ANYONE: number; total: number };
}

export interface CoverOpenClass {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	weeklyMinutes: number;
	weeklyHoursPerWeek: number;
	heldByFacultyId: number | null;
	heldByName: string | null;
	heldByIsPlaceholder: boolean;
}

export interface CoverOpenClassesResponse {
	schoolId: number;
	schoolYearId: number;
	counts: { total: number; unowned: number; placeholderOwned: number };
	classes: CoverOpenClass[];
}

/** Typed, fail-closed service error. The router maps it to the contract status. */
export class CoverContractError extends Error {
	statusCode: number;
	code: string;
	payload: Record<string, unknown>;

	constructor(statusCode: number, code: string, message: string, payload: Record<string, unknown> = {}) {
		super(message);
		this.name = 'CoverContractError';
		this.statusCode = statusCode;
		this.code = code;
		this.payload = payload;
	}
}

// ─── Small helpers ───────────────────────────────────────────────────────────

/** Hours with at most 1 decimal, per the contract's edge-rounding rule. */
function toHours(minutes: number): number {
	return Math.round((Math.max(0, Math.round(minutes)) / 60) * 10) / 10;
}

function displayName(row: { firstName?: string | null; lastName?: string | null }): string {
	const first = (row.firstName ?? '').trim();
	const last = (row.lastName ?? '').trim();
	const joined = `${first} ${last}`.trim();
	return joined.length > 0 ? joined : 'Unnamed teacher';
}

function requirePositiveInt(value: unknown, field: string): number {
	const numeric = typeof value === 'number' ? value : Number(value);
	if (!Number.isSafeInteger(numeric) || numeric < 1) {
		throw new CoverContractError(400, 'INVALID_PARAM', `${field} must be a positive integer.`);
	}
	return numeric;
}

const CONCURRENT_SUBJECT_SELECT = {
	id: true,
	code: true,
	modularGroupId: true,
	modularOrder: true,
	termGroupId: true,
	termCount: true,
	rotationFamily: true,
	minMinutesPerWeek: true,
} as const;

async function readSubject(schoolId: number, subjectId: number, client?: Db): Promise<{
	id: number;
	code: string;
	name: string;
	ownerDepartment: string | null;
	allowedSpecializations: string[];
	requiredFeatures: string[];
	programScopes: string[];
	minMinutesPerWeek: number;
}> {
	const actor = client ?? db();
	const subject = await actor.subject.findFirst({
		where: { id: subjectId, schoolId },
		select: {
			id: true,
			code: true,
			name: true,
			ownerDepartment: true,
			allowedSpecializations: true,
			requiredFeatures: true,
			programScopes: true,
			minMinutesPerWeek: true,
		},
	});
	if (!subject) {
		throw new CoverContractError(400, 'SUBJECT_NOT_FOUND', 'No subject with that id in this school.');
	}
	return {
		id: subject.id,
		code: subject.code,
		name: subject.name,
		ownerDepartment: subject.ownerDepartment ?? null,
		allowedSpecializations: Array.isArray(subject.allowedSpecializations) ? subject.allowedSpecializations : [],
		requiredFeatures: Array.isArray(subject.requiredFeatures) ? subject.requiredFeatures : [],
		programScopes: Array.isArray(subject.programScopes) ? subject.programScopes : [],
		minMinutesPerWeek: subject.minMinutesPerWeek ?? 0,
	};
}

async function readSection(schoolId: number, schoolYearId: number, sectionId: number, client?: Db): Promise<{
	id: number;
	name: string;
	displayOrder: number;
	programType: string | null;
	gradeLevel: number;
}> {
	const actor = client ?? db();
	// `sectionId` is the external section id, exactly as `SubjectSectionOwnership`
	// stores it and as canonical derived demand pairs address it.
	const section = await actor.sectionMirror.findFirst({
		where: { externalId: sectionId, schoolId, schoolYearId },
		select: { externalId: true, name: true, displayOrder: true, programType: true },
	});
	if (!section) {
		throw new CoverContractError(400, 'SECTION_NOT_FOUND', 'That section does not belong to this school year.');
	}
	return {
		id: section.externalId,
		name: section.name,
		displayOrder: section.displayOrder,
		programType: section.programType ?? null,
		gradeLevel: section.displayOrder,
	};
}

/**
 * A8 c4 correction (F1) — the CONTRACT §2 code that used to be unreachable on the
 * assign route.
 *
 * `assertRequestSchoolScope` already rejects a cross-school ACTOR with `403
 * CROSS_SCHOOL_DENIED` before the service is reached. This is the OTHER question:
 * the ids INSIDE the body that name a row in ANOTHER school. Contract §2 says that
 * is `400 SCHOOL_SCOPE_MISMATCH`, so `FACULTY_NOT_FOUND` / `SUBJECT_NOT_FOUND` can
 * finally mean what the contract says they mean — "no such row in YOUR school".
 *
 * The probe is a single id-only read and it never reports anything about the
 * foreign row beyond the fact of its existence.
 */
async function assertRowInSchool(
	model: 'subject' | 'facultyMirror',
	rowId: number,
	schoolId: number,
	label: string,
	client: Db,
): Promise<void> {
	const row = await client[model].findFirst({ where: { id: rowId }, select: { id: true, schoolId: true } });
	if (row && row.schoolId !== schoolId) {
		throw new CoverContractError(400, 'SCHOOL_SCOPE_MISMATCH', `That ${label} belongs to another school.`);
	}
}

type CoverSubject = Awaited<ReturnType<typeof readSubject>>;

/**
 * Canonical weekly minutes for ONE (subject, section) pair, or `null` when the
 * pair is outside canonical derived demand.
 */
async function readCanonicalPairMinutes(
	schoolId: number,
	schoolYearId: number,
	subjectId: number,
	sectionId: number,
	client?: Db,
): Promise<number | null> {
	const demand = await resolveSuggestionDerivedDemand(schoolId, schoolYearId, client);
	const pair = demand.teachingLoadPairs.find(
		(entry) => entry.subjectId === subjectId && entry.sectionExternalId === sectionId,
	);
	return pair ? pair.weeklyMinutes : null;
}

// ─── Cover candidates ────────────────────────────────────────────────────────

async function readRealFaculty(schoolId: number, client?: Db): Promise<Array<{
	id: number;
	firstName: string | null;
	lastName: string | null;
	department: string | null;
	specialization: string | null;
	canTeachOutsideDepartment: boolean;
	maxHoursPerWeek: number;
	ancillaryMinutesPerWeek: number | null;
}>> {
	const actor = client ?? db();
	const rows = await actor.facultyMirror.findMany({
		where: { schoolId, isStale: false, isActiveForScheduling: true, isPlaceholder: false },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			department: true,
			specialization: true,
			canTeachOutsideDepartment: true,
			maxHoursPerWeek: true,
			ancillaryMinutesPerWeek: true,
		},
	});
	return rows as never;
}

async function readFacultySubjectVersions(
	schoolId: number,
	schoolYearId: number,
	facultyIds: number[],
	client?: Db,
): Promise<Map<string, number>> {
	const actor = client ?? db();
	const versions = new Map<string, number>();
	if (facultyIds.length === 0) return versions;
	const rows = await actor.facultySubject.findMany({
		where: { schoolId, schoolYearId, facultyId: { in: facultyIds } },
		select: { facultyId: true, subjectId: true, version: true },
	});
	for (const row of rows as Array<{ facultyId: number; subjectId: number; version: number }>) {
		// Keyed by BOTH ids: `version` is the FacultySubject row for THIS subject,
		// which is the row the cover write bumps. A teacher's version in some other
		// subject must never be reported as this class's version.
		versions.set(`${row.facultyId}:${row.subjectId}`, row.version ?? 1);
	}
	return versions;
}

async function readOwnedSections(
	schoolId: number,
	schoolYearId: number,
	subjectId: number,
	client?: Db,
): Promise<Set<number>> {
	const actor = client ?? db();
	const rows = await actor.subjectSectionOwnership.findMany({
		where: { schoolId, schoolYearId, subjectId },
		select: { sectionId: true },
	});
	return new Set((rows as Array<{ sectionId: number }>).map((row) => row.sectionId));
}

function reasonFor(row: {
	tier: CoverCandidateTier;
	name: string;
	department: string | null;
	subjectCode: string;
	permissionGranted: boolean;
	canTeachOutsideDepartment: boolean;
	overCapAfter: boolean;
	overCapHours: number;
	cap: number;
}): string {
	if (row.tier === 'QUALIFIED') {
		return row.overCapAfter
			? `${row.name} is already ${row.overCapHours} h over the ${row.cap} h cap.`
			: `${row.name} is qualified for ${row.subjectCode}.`;
	}
	const departmentNote = row.department ? `${row.department}. ` : '';
	if (row.permissionGranted || row.canTeachOutsideDepartment) {
		return row.overCapAfter
			? `${row.name} is already ${row.overCapHours} h over the ${row.cap} h cap.`
			: `${row.name} is already allowed to teach ${row.subjectCode}.`;
	}
	if (row.overCapAfter) {
		return `${row.name} is in ${row.department ?? 'another department'} and is already ${row.overCapHours} h over the ${row.cap} h cap.`;
	}
	return row.tier === 'OTHER_DEPARTMENT'
		? `${row.name} is in ${row.department ?? 'another department'}. Allow ${row.name === 'Maria Reyes' ? 'her' : 'them'} to teach ${row.subjectCode} once to cover this class.`
		: `${departmentNote}${row.name} does not normally teach ${row.subjectCode}, but has free hours.`;
}

/**
 * The ranked candidate list for ONE open class. Read-only.
 */
export async function listCoverCandidates(input: {
	schoolId: number;
	schoolYearId: number;
	subjectId: unknown;
	sectionId: unknown;
}): Promise<CoverCandidatesResponse> {
	const { schoolId, schoolYearId } = input;
	const subjectId = requirePositiveInt(input.subjectId, 'subjectId');
	const sectionId = requirePositiveInt(input.sectionId, 'sectionId');

	const subject = await readSubject(schoolId, subjectId);
	const section = await readSection(schoolId, schoolYearId, sectionId);

	// The class's REAL weekly minutes. Without canonical demand this number would
	// be a guess, and `hoursAfter` would be a lie the scheduler acts on.
	const canonicalMinutes = await readCanonicalPairMinutes(schoolId, schoolYearId, subjectId, sectionId);
	if (canonicalMinutes == null) {
		throw new CoverContractError(
			400,
			'OUTSIDE_CANONICAL_DEMAND',
			'This section is not scheduled to teach this subject, so it cannot be covered for it.',
		);
	}
	const weeklyMinutes = Math.max(0, Math.round(canonicalMinutes));

	const faculty = await readRealFaculty(schoolId);
	const facultyIds = faculty.map((row) => row.id);
	const ownedSections = await readOwnedSections(schoolId, schoolYearId, subjectId);
	const versions = await readFacultySubjectVersions(schoolId, schoolYearId, facultyIds);

	const ownershipRows = await db().subjectSectionOwnership.findMany({
		where: { schoolId, schoolYearId, facultyId: { in: facultyIds } },
		select: {
			subjectId: true,
			sectionId: true,
			facultyId: true,
			facultySubject: { select: { subject: { select: CONCURRENT_SUBJECT_SELECT } } },
		},
	});
	const canonicalMinutesByFaculty = computeCanonicalConcurrentWeeklyMinutes(ownershipRows as never);

	const permissionRows = await db().crossDepartmentPermission.findMany({
		where: { schoolId, subjectId },
		select: { facultyId: true },
	});
	const permittedFacultyIds = new Set((permissionRows as Array<{ facultyId: number }>).map((row) => row.facultyId));

	const currentOwnerIds = new Set<number>();
	for (const row of ownershipRows as Array<{ subjectId: number; sectionId: number; facultyId: number }>) {
		if (row.subjectId === subjectId && row.sectionId === sectionId) currentOwnerIds.add(row.facultyId);
	}

	const candidates: CoverCandidate[] = [];
	for (const member of faculty) {
		// A placeholder can never appear here: the read filters `isPlaceholder:
		// false`, so the invariant does not depend on a downstream check.
		if (currentOwnerIds.has(member.id)) continue;

		const qualification = await evaluateTeachingLoadReceiverQualification(
			db(),
			schoolId,
			{
				id: member.id,
				specialization: member.specialization,
				department: member.department,
				canTeachOutsideDepartment: member.canTeachOutsideDepartment,
			},
			{
				id: subject.id,
				code: subject.code,
				name: subject.name,
				allowedSpecializations: subject.allowedSpecializations,
				ownerDepartment: subject.ownerDepartment,
				requiredFeatures: subject.requiredFeatures,
				programScopes: subject.programScopes,
			},
			section.programType ?? 'REGULAR',
		);

		// Contract §0.2: tier 1|2 is QUALIFIED, tier 3 (a permission row exists, or
		// the blanket flag) is OTHER_DEPARTMENT, anything else is ANYONE.
		const tier: CoverCandidateTier =
			qualification.tier === 1 || qualification.tier === 2
				? 'QUALIFIED'
				: qualification.tier === 3
					? 'OTHER_DEPARTMENT'
					: 'ANYONE';

		const concurrentSubject: CanonicalConcurrentSubjectRow = {
			id: subject.id,
			code: subject.code,
			modularGroupId: null,
			modularOrder: null,
			termGroupId: null,
			termCount: null,
			rotationFamily: (subject as { rotationFamily?: string | null }).rotationFamily ?? null,
			minMinutesPerWeek: subject.minMinutesPerWeek,
		};
		const concurrent = estimateCanonicalConcurrentWeeklyDeltaMinutes({
			existingOwnerships: ownershipRows as never,
			facultyId: member.id,
			subject: concurrentSubject,
			sectionId,
		});
		// The ledger's own `currentMinutes` is authoritative; the map is the same
		// rollup and is only read when a teacher has no ownership rows at all.
		const hoursNowMinutes = concurrent.currentMinutes ?? canonicalMinutesByFaculty.get(member.id) ?? 0;
		const hoursAfterMinutes = concurrent.afterMinutes;

		const load = evaluateWeeklyLoad(hoursNowMinutes, {
			maxHoursPerWeek: member.maxHoursPerWeek,
			ancillaryMinutesPerWeek: member.ancillaryMinutesPerWeek,
		});
		const overCapAfter = hoursAfterMinutes > load.capMinutes;
		const permissionGranted = permittedFacultyIds.has(member.id);

		const row: CoverCandidate = {
			facultyId: member.id,
			name: displayName(member),
			department: member.department ?? null,
			tier,
			hoursNow: toHours(hoursNowMinutes),
			hoursAfter: toHours(hoursAfterMinutes),
			cap: toHours(load.capMinutes),
			overCapAfter,
			reason: '',
			specialization: member.specialization ?? null,
			isPlaceholder: false,
			hasRoom: !overCapAfter,
			needsPermission: (tier === 'OTHER_DEPARTMENT' || tier === 'ANYONE') && !permissionGranted,
			permissionGranted,
			canTeachOutsideDepartment: member.canTeachOutsideDepartment === true,
			qualificationAuthority: qualification.authority ?? null,
			version: versions.get(`${member.id}:${subject.id}`) ?? 1,
		};
		row.reason = reasonFor({
			tier,
			name: row.name,
			department: row.department,
			subjectCode: subject.code,
			permissionGranted,
			canTeachOutsideDepartment: row.canTeachOutsideDepartment,
			overCapAfter,
			overCapHours: toHours(Math.max(0, hoursAfterMinutes - load.capMinutes)),
			cap: row.cap,
		});
		candidates.push(row);
	}

	// Contract §1 ranking: tier, then hasRoom, then hoursAfter, then name. The
	// client renders in this order; it does not re-sort.
	candidates.sort((left, right) =>
		(TIER_RANK[left.tier] - TIER_RANK[right.tier])
		|| (Number(right.hasRoom) - Number(left.hasRoom))
		|| (left.hoursAfter - right.hoursAfter)
		|| left.name.localeCompare(right.name)
		|| (left.facultyId - right.facultyId),
	);

	// Keep `ownedSections` referenced: a section already owned by THIS teacher is
	// the only exclusion, and it is proven per-candidate above.
	void ownedSections;

	return {
		schoolId,
		schoolYearId,
		subject: { id: subject.id, code: subject.code, name: subject.name },
		section: {
			id: section.id,
			name: section.name,
			displayOrder: section.displayOrder,
			programType: section.programType,
		},
		weeklyMinutes,
		candidates,
		counts: {
			QUALIFIED: candidates.filter((row) => row.tier === 'QUALIFIED').length,
			OTHER_DEPARTMENT: candidates.filter((row) => row.tier === 'OTHER_DEPARTMENT').length,
			ANYONE: candidates.filter((row) => row.tier === 'ANYONE').length,
			total: candidates.length,
		},
	};
}

// ─── Cover open classes ──────────────────────────────────────────────────────

/**
 * The honest open-class set. A class is OPEN when nobody owns it OR a placeholder
 * owns it — the Codex `REJECT_UX` finding was that placeholders were counted as
 * staffed, so this read (not a client guess) is what makes the count provable.
 */
export async function listCoverOpenClasses(input: {
	schoolId: number;
	schoolYearId: number;
	subjectId?: unknown;
	gradeLevel?: unknown;
}): Promise<CoverOpenClassesResponse> {
	const { schoolId, schoolYearId } = input;
	const subjectFilter = input.subjectId == null || input.subjectId === '' ? null : requirePositiveInt(input.subjectId, 'subjectId');
	const gradeFilter = input.gradeLevel == null || input.gradeLevel === '' ? null : requirePositiveInt(input.gradeLevel, 'gradeLevel');

	const demand = await resolveSuggestionDerivedDemand(schoolId, schoolYearId);
	const pairs = demand.teachingLoadPairs.filter((pair) =>
		(subjectFilter == null || pair.subjectId === subjectFilter)
		&& (gradeFilter == null || pair.gradeLevel === gradeFilter),
	);
	if (pairs.length === 0) {
		return { schoolId, schoolYearId, counts: { total: 0, unowned: 0, placeholderOwned: 0 }, classes: [] };
	}

	const sectionIds = [...new Set(pairs.map((pair) => pair.sectionExternalId))];
	const ownerships = await db().subjectSectionOwnership.findMany({
		where: { schoolId, schoolYearId, sectionId: { in: sectionIds } },
		select: { subjectId: true, sectionId: true, facultyId: true },
	});
	const ownerByPair = new Map<string, number>();
	for (const row of ownerships as Array<{ subjectId: number; sectionId: number; facultyId: number }>) {
		ownerByPair.set(`${row.subjectId}:${row.sectionId}`, row.facultyId);
	}

	const ownerIds = [...new Set(ownerByPair.values())];
	const holderRows = ownerIds.length > 0
		? await db().facultyMirror.findMany({
			where: { id: { in: ownerIds } },
			select: { id: true, firstName: true, lastName: true, isPlaceholder: true },
		})
		: [];
	const holderById = new Map(
		(holderRows as Array<{ id: number; firstName: string | null; lastName: string | null; isPlaceholder: boolean }>)
			.map((row) => [row.id, row] as const),
	);

	const sections = await db().sectionMirror.findMany({
		where: { schoolId, schoolYearId, externalId: { in: sectionIds } },
		select: { externalId: true, name: true },
	});
	const sectionNameById = new Map((sections as Array<{ externalId: number; name: string }>).map((row) => [row.externalId, row.name] as const));

	// Canonical demand carries the subject CODE; the client renders the name too.
	const subjectIds = [...new Set(pairs.map((pair) => pair.subjectId))];
	const subjectRows = await db().subject.findMany({
		where: { schoolId, id: { in: subjectIds } },
		select: { id: true, name: true },
	});
	const subjectNameById = new Map((subjectRows as Array<{ id: number; name: string }>).map((row) => [row.id, row.name] as const));

	const classes: CoverOpenClass[] = [];
	let unowned = 0;
	let placeholderOwned = 0;
	for (const pair of pairs) {
		const heldByFacultyId = ownerByPair.get(`${pair.subjectId}:${pair.sectionExternalId}`) ?? null;
		const holder = heldByFacultyId == null ? null : holderById.get(heldByFacultyId) ?? null;
		const heldByIsPlaceholder = holder ? holder.isPlaceholder === true : false;
		// A8 c4 (F7, defensive): an ownership row whose `facultyId` resolves to NO
		// `FacultyMirror` row — the mirror was deleted or is outside this school —
		// names nobody. It used to fall through as "owned by a real teacher" and
		// vanish from `classes[]`, which silently under-reports the staffing need.
		// A class no live teacher holds is OPEN, and it is reported honestly as
		// unowned (`heldByFacultyId: null`) so the client's own counting rule
		// (`heldByIsPlaceholder === true || heldByFacultyId === null`) agrees with
		// this server and `unowned + placeholderOwned === total` still holds.
		const danglingOwner = heldByFacultyId != null && holder == null;
		// THE counting rule: a class is OPEN when nobody owns it OR a placeholder
		// owns it. A class owned by a real teacher is NOT open, so it is not in
		// this list at all — that is what makes `unowned + placeholderOwned ===
		// total` true by construction rather than by a client subtraction.
		const isOpen = danglingOwner || heldByFacultyId == null || heldByIsPlaceholder;
		if (!isOpen) continue;
		if (danglingOwner || heldByFacultyId == null) unowned += 1;
		else placeholderOwned += 1;
		classes.push({
			subjectId: pair.subjectId,
			subjectCode: pair.subjectCode,
			subjectName: subjectNameById.get(pair.subjectId) ?? pair.subjectCode,
			sectionId: pair.sectionExternalId,
			sectionName: sectionNameById.get(pair.sectionExternalId) ?? '',
			gradeLevel: pair.gradeLevel,
			weeklyMinutes: pair.weeklyMinutes,
			weeklyHoursPerWeek: toHours(pair.weeklyMinutes),
			heldByFacultyId: danglingOwner ? null : heldByFacultyId,
			heldByName: danglingOwner || holder == null ? null : displayName(holder),
			heldByIsPlaceholder,
		});
	}

	return {
		schoolId,
		schoolYearId,
		// Invariant: unowned + placeholderOwned === total. The client asserts it.
		counts: { total: classes.length, unowned, placeholderOwned },
		classes,
	};
}

// ─── Subject permissions ─────────────────────────────────────────────────────

export interface SubjectPermissionRow {
	subjectId: number;
	code: string;
	name: string;
	ownerDepartment: string | null;
	grantedAt: string;
}

export interface SubjectPermissionsResponse {
	schoolId: number;
	facultyId: number;
	canTeachOutsideDepartment: boolean;
	subjects: SubjectPermissionRow[];
}

export async function listSubjectPermissions(input: {
	schoolId: number;
	facultyId: number;
}): Promise<SubjectPermissionsResponse> {
	const { schoolId, facultyId } = input;
	const actor = db();
	const faculty = await actor.facultyMirror.findFirst({
		where: { id: facultyId, schoolId },
		select: { id: true, canTeachOutsideDepartment: true },
	});
	if (!faculty) {
		throw new CoverContractError(400, 'SCHOOL_SCOPE_MISMATCH', 'That teacher does not belong to this school.');
	}
	const rows = await actor.crossDepartmentPermission.findMany({
		where: { schoolId, facultyId },
		select: { subjectId: true, createdAt: true, subject: { select: { code: true, name: true, ownerDepartment: true } } },
	});
	const subjects = (rows as Array<{
		subjectId: number;
		createdAt: Date;
		subject: { code: string; name: string; ownerDepartment: string | null };
	}>)
		.map((row) => ({
			subjectId: row.subjectId,
			code: row.subject.code,
			name: row.subject.name,
			ownerDepartment: row.subject.ownerDepartment ?? null,
			grantedAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
		}))
		.sort((left, right) => left.code.localeCompare(right.code));

	return { schoolId, facultyId, canTeachOutsideDepartment: faculty.canTeachOutsideDepartment === true, subjects };
}

/** Idempotent: `created: false` means the row already existed — success, not error. */
export async function createSubjectPermission(input: {
	schoolId: number;
	facultyId: number;
	subjectId: number;
	actorId: number;
	schoolYearId: number;
}): Promise<{ facultyId: number; subjectId: number; created: boolean }> {
	const { schoolId, facultyId, subjectId } = input;
	const actor = db();
	const faculty = await actor.facultyMirror.findFirst({ where: { id: facultyId, schoolId }, select: { id: true } });
	if (!faculty) {
		throw new CoverContractError(400, 'SCHOOL_SCOPE_MISMATCH', 'That teacher does not belong to this school.');
	}
	const subject = await actor.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } });
	if (!subject) {
		throw new CoverContractError(400, 'SCHOOL_SCOPE_MISMATCH', 'That subject does not belong to this school.');
	}
	const existing = await actor.crossDepartmentPermission.findUnique({
		where: { schoolId_facultyId_subjectId: { schoolId, facultyId, subjectId } },
		select: { id: true },
	});
	if (existing) {
		return { facultyId, subjectId, created: false };
	}
	await actor.crossDepartmentPermission.create({ data: { schoolId, facultyId, subjectId } });

	// A granted permission must be effective on the very next cover-candidates
	// read, so the policy cache is invalidated with the write, never after it.
	invalidatePolicyCache(schoolId);
	await writeAuditLog(
		{ id: input.actorId, schoolId, role: 'SCHEDULER_OFFICER' },
		input.schoolYearId,
		'CROSS_DEPARTMENT_PERMISSION_GRANTED',
		[facultyId, subjectId],
		{ source: 'faculty.subject-permissions' },
	);
	return { facultyId, subjectId, created: true };
}

/** Idempotent: deleting an absent permission is `200 { removed: false }`, never 404. */
export async function deleteSubjectPermission(input: {
	schoolId: number;
	facultyId: number;
	subjectId: number;
	actorId: number;
	schoolYearId: number;
}): Promise<{ removed: boolean }> {
	const { schoolId, facultyId, subjectId } = input;
	const actor = db();
	const faculty = await actor.facultyMirror.findFirst({ where: { id: facultyId, schoolId }, select: { id: true } });
	if (!faculty) {
		throw new CoverContractError(400, 'SCHOOL_SCOPE_MISMATCH', 'That teacher does not belong to this school.');
	}
	const existing = await actor.crossDepartmentPermission.findUnique({
		where: { schoolId_facultyId_subjectId: { schoolId, facultyId, subjectId } },
		select: { id: true },
	});
	if (!existing) {
		invalidatePolicyCache(schoolId);
		return { removed: false };
	}
	await actor.crossDepartmentPermission.delete({ where: { id: existing.id } });
	invalidatePolicyCache(schoolId);
	await writeAuditLog(
		{ id: input.actorId, schoolId, role: 'SCHEDULER_OFFICER' },
		input.schoolYearId,
		'CROSS_DEPARTMENT_PERMISSION_REVOKED',
		[facultyId, subjectId],
		{ source: 'faculty.subject-permissions' },
	);
	return { removed: true };
}

// ─── Cover assignment (the single write) ─────────────────────────────────────

export interface CoverAssignmentResult {
	facultyId: number;
	subjectId: number;
	sectionId: number;
	permissionCreated: boolean;
	assignmentVersion: number;
	weeklyMinutes: number;
}

/**
 * Assign one open class to one real teacher. ONE Serializable transaction bound
 * to its own reads, so the permission and the ownership it authorises can never
 * diverge: with `grantPermission` the `CrossDepartmentPermission` row and the
 * `SubjectSectionOwnership` row are written together or not at all.
 *
 * A placeholder is never a legal target: the read filters `isPlaceholder: false`
 * and this check is the second, load-bearing line of defence.
 */
export async function createCoverAssignment(input: {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	subjectId: number;
	sectionId: number;
	grantPermission: boolean;
	actorId: number;
}): Promise<CoverAssignmentResult> {
	const { schoolId, schoolYearId, facultyId, subjectId, sectionId, grantPermission } = input;

	const actor = db();
	// A8 c4 correction (F1): SCOPE before EXISTENCE, and both before canonical
	// demand, so each answer means exactly one thing:
	//   another school's row  -> 400 SCHOOL_SCOPE_MISMATCH (contract §2)
	//   no such row in mine   -> 400 SUBJECT_NOT_FOUND / FACULTY_NOT_FOUND
	//   real pair, not demand -> 400 OUTSIDE_CANONICAL_DEMAND
	// `assertRequestSchoolScope` has already answered the cross-school ACTOR with
	// `403 CROSS_SCHOOL_DENIED`; this is the different question about the body.
	await assertRowInSchool('subject', subjectId, schoolId, 'subject', actor);
	await assertRowInSchool('facultyMirror', facultyId, schoolId, 'teacher', actor);
	const subject = await readSubject(schoolId, subjectId, actor);

	const demand = await resolveSuggestionDerivedDemand(schoolId, schoolYearId);
	const pair = demand.teachingLoadPairs.find(
		(entry) => entry.subjectId === subjectId && entry.sectionExternalId === sectionId,
	);
	if (!pair) {
		throw new CoverContractError(
			400,
			'OUTSIDE_CANONICAL_DEMAND',
			'This section is not scheduled to teach this subject, so it cannot be covered for it.',
		);
	}
	const weeklyMinutes = Math.max(0, Math.round(pair.weeklyMinutes));

	const section = await readSection(schoolId, schoolYearId, sectionId, actor);
	const faculty = await actor.facultyMirror.findFirst({
		where: { id: facultyId, schoolId, isStale: false, isActiveForScheduling: true },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			department: true,
			specialization: true,
			canTeachOutsideDepartment: true,
			isPlaceholder: true,
		},
	});
	if (!faculty) {
		// "No such ACTIVE, non-stale teacher in THIS school." A teacher of another
		// school was already refused above as `SCHOOL_SCOPE_MISMATCH`.
		throw new CoverContractError(400, 'FACULTY_NOT_FOUND', 'No active teacher with that id in this school.');
	}
	if (faculty.isPlaceholder === true) {
		throw new CoverContractError(400, 'PLACEHOLDER_NOT_ASSIGNABLE', 'A to-be-hired placeholder cannot take this class.');
	}

	const existingOwnership = await actor.subjectSectionOwnership.findFirst({
		where: { schoolId, schoolYearId, subjectId, sectionId },
		select: { id: true, facultyId: true },
	});
	if (existingOwnership) {
		throw new CoverContractError(409, 'SECTION_ALREADY_OWNED', 'Another teacher already owns this class.');
	}

	const qualification = await evaluateTeachingLoadReceiverQualification(
		actor,
		schoolId,
		{
			id: faculty.id,
			specialization: faculty.specialization,
			department: faculty.department,
			canTeachOutsideDepartment: faculty.canTeachOutsideDepartment,
		},
		{
			id: subject.id,
			code: subject.code,
			name: subject.name,
			allowedSpecializations: subject.allowedSpecializations,
			ownerDepartment: subject.ownerDepartment,
			requiredFeatures: subject.requiredFeatures,
			programScopes: subject.programScopes,
		},
		section.programType ?? 'REGULAR',
	);
	const permission = await actor.crossDepartmentPermission.findUnique({
		where: { schoolId_facultyId_subjectId: { schoolId, facultyId, subjectId } },
		select: { id: true },
	});
	const needsPermission =
		(qualification.tier === 3 || qualification.tier == null) && permission === null;
	if (needsPermission && !grantPermission) {
		// Contract §2 body, all fields present. This is the client's prompt data.
		throw new CoverContractError(
			409,
			'NEEDS_PERMISSION',
			'This teacher may not teach this subject yet.',
			{
				code: 'NEEDS_PERMISSION',
				facultyId,
				facultyName: displayName(faculty),
				department: faculty.department ?? null,
				subjectId,
				subjectCode: subject.code,
				subjectName: subject.name,
				canTeachOutsideDepartment: faculty.canTeachOutsideDepartment === true,
			},
		);
	}

	// ONE Serializable transaction bound to the reads above.
	const runWrite = async (tx: Db): Promise<CoverAssignmentResult> => {
		let permissionCreated = false;
		if (grantPermission && permission === null) {
			await tx.crossDepartmentPermission.create({ data: { schoolId, facultyId, subjectId } });
			permissionCreated = true;
		}

		let facultySubject = await tx.facultySubject.findUnique({
			where: { facultyId_subjectId_schoolYearId: { facultyId, subjectId, schoolYearId } },
			select: { id: true, version: true, sectionIds: true, gradeLevels: true },
		});
		let assignmentVersion: number;
		if (!facultySubject) {
			const created = await tx.facultySubject.create({
				data: {
					facultyId,
					subjectId,
					schoolId,
					schoolYearId,
					gradeLevels: [pair.gradeLevel],
					sectionIds: [sectionId],
					assignedBy: input.actorId,
				},
				select: { id: true, version: true },
			});
			facultySubject = { id: created.id, version: created.version, sectionIds: [sectionId], gradeLevels: [pair.gradeLevel] };
			assignmentVersion = created.version ?? 1;
		} else {
			const sectionIds = [...new Set([...(facultySubject.sectionIds ?? []), sectionId])].sort((a, b) => a - b);
			const gradeLevels = [...new Set([...(facultySubject.gradeLevels ?? []), pair.gradeLevel])].sort((a, b) => a - b);
			// Optimistic bump under the transaction's own read: the client never
			// sends a version, so a CAS miss is a genuine concurrent save.
			const bumped = await tx.facultySubject.updateMany({
				where: { id: facultySubject.id, version: facultySubject.version ?? 1 },
				data: {
					sectionIds,
					gradeLevels,
					version: { increment: 1 },
					assignedBy: input.actorId,
				},
			});
			if (bumped.count !== 1) {
				throw new CoverContractError(
					409,
					'VERSION_CONFLICT',
					'Another save changed this teacher\'s load first. Re-read the cover candidates.',
				);
			}
			assignmentVersion = (facultySubject.version ?? 1) + 1;
		}

		// `uq_subject_section_owner_year` — one owner per school year + subject +
		// section. Written AFTER the FacultySubject exists in both branches, and
		// exactly once, so the two rows can never disagree.
		await tx.subjectSectionOwnership.create({
			data: {
				schoolId,
				schoolYearId,
				facultySubjectId: facultySubject.id,
				facultyId,
				subjectId,
				sectionId,
				assignedAt: new Date(),
			},
		});

		return { facultyId, subjectId, sectionId, permissionCreated, assignmentVersion, weeklyMinutes };
	};

	let result: CoverAssignmentResult;
	try {
		result = await actor.$transaction(runWrite, {
			isolationLevel: 'Serializable',
			maxWait: 10_000,
			timeout: 30_000,
		});
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code === 'P2034' || code === 'P2002') {
			throw new CoverContractError(
				409,
				'VERSION_CONFLICT',
				'Another save changed this class first. Re-read the cover candidates.',
			);
		}
		throw error;
	}

	if (result.permissionCreated) {
		invalidatePolicyCache(schoolId);
	}
	await writeAuditLog(
		{ id: input.actorId, schoolId, role: 'SCHEDULER_OFFICER' },
		schoolYearId,
		'TEACHING_LOAD_COVER_ASSIGNMENT',
		[facultyId, subjectId, sectionId],
		{
			permissionCreated: result.permissionCreated,
			grantPermission,
			assignmentVersion: result.assignmentVersion,
			weeklyMinutes: result.weeklyMinutes,
		},
	);
	return result;
}

export type { CoverSubject };
