const SCHEDULER_ANCILLARY_ROLES = new Set([
	'GRADE 7 COORDINATOR',
	'GRADE 8 COORDINATOR',
	'GRADE 9 COORDINATOR',
	'GRADE 10 COORDINATOR',
]);

const MAX_FEED_AGE_MS = 5 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;

export type SchedulerAncillaryFeedValidation =
	| { valid: true; eligible: boolean; schoolYearId: number }
	| { valid: false; eligible: false; code: string };

export type SchedulerAncillaryAuthorityResult =
	| { verified: true; eligible: boolean; schoolYearId: number }
	| { verified: false; eligible: false; code: string };

export type SchedulerAncillaryAuthorityOptions = {
	baseUrl?: string;
	serviceToken?: string;
	fetchImpl?: typeof fetch;
	now?: () => number;
};

function fail(code: string): SchedulerAncillaryFeedValidation {
	return { valid: false, eligible: false, code };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRole(role: string): string {
	return role.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Match only the four normalized grant strings; invalid arrays fail closed. */
export function isSchedulerEligibleByAncillaryRoles(roles: unknown): boolean {
	if (!Array.isArray(roles) || !roles.every((role) => typeof role === 'string' && role.trim().length > 0)) return false;
	return roles.some((role) => SCHEDULER_ANCILLARY_ROLES.has(normalizeRole(role)));
}

/** Validate the authoritative active-year response without consulting a mirror or a role claim. */
export function validateSchedulerAncillaryFeed(
	payload: unknown,
	employeeId: string | null,
	expectedSchoolYearId: number,
	nowMs = Date.now(),
): SchedulerAncillaryFeedValidation {
	if (!employeeId || typeof employeeId !== 'string' || !employeeId.trim()) return fail('FACULTY_IDENTITY_REQUIRED');
	if (!Number.isSafeInteger(expectedSchoolYearId) || expectedSchoolYearId < 1) return fail('ACTIVE_SCHOOL_YEAR_INVALID');
	if (!isRecord(payload) || !Array.isArray(payload.data) || !isRecord(payload.meta)) return fail('FACULTY_FEED_MALFORMED');
	const meta = payload.meta;
	if (meta.sourceSystem !== 'ENROLLPRO' || meta.scopeSchoolYearId !== expectedSchoolYearId) return fail('FACULTY_FEED_SCOPE_MISMATCH');
	if (!Number.isSafeInteger(meta.totalRows) || meta.totalRows !== payload.data.length) return fail('FACULTY_FEED_MALFORMED');
	if (typeof meta.generatedAt !== 'string') return fail('FACULTY_FEED_MALFORMED');
	const generatedAt = Date.parse(meta.generatedAt);
	if (!Number.isFinite(generatedAt) || generatedAt > nowMs + CLOCK_SKEW_TOLERANCE_MS || nowMs - generatedAt > MAX_FEED_AGE_MS) {
		return fail('FACULTY_FEED_STALE');
	}

	const rows: Array<{ employeeId: string | null; isActive: boolean; ancillaryRoles: string[] }> = [];
	for (const candidate of payload.data) {
		if (!isRecord(candidate)
			|| !Number.isSafeInteger(candidate.teacherId) || (candidate.teacherId as number) < 1
			|| (candidate.employeeId !== undefined && candidate.employeeId !== null && typeof candidate.employeeId !== 'string')
			|| typeof candidate.isActive !== 'boolean'
			|| !Array.isArray(candidate.ancillaryRoles)
			|| !candidate.ancillaryRoles.every((role) => typeof role === 'string' && role.trim().length > 0)) {
			return fail('FACULTY_FEED_MALFORMED');
		}
		rows.push({
			employeeId: typeof candidate.employeeId === 'string' ? candidate.employeeId.trim() : null,
			isActive: candidate.isActive,
			ancillaryRoles: candidate.ancillaryRoles as string[],
		});
	}

	const key = employeeId.trim();
	const matches = rows.filter((row) => row.employeeId === key);
	if (matches.length !== 1) return fail(matches.length === 0 ? 'FACULTY_IDENTITY_NOT_FOUND' : 'FACULTY_IDENTITY_AMBIGUOUS');
	const match = matches[0];
	if (!match.isActive) return fail('FACULTY_IDENTITY_INACTIVE');
	return {
		valid: true,
		eligible: isSchedulerEligibleByAncillaryRoles(match.ancillaryRoles),
		schoolYearId: expectedSchoolYearId,
	};
}

function parseActiveSchoolYear(payload: unknown): { id: number } | null {
	if (!isRecord(payload) || !isRecord(payload.data)) return null;
	const id = payload.data.id;
	const label = payload.data.yearLabel;
	if (!Number.isSafeInteger(id) || (id as number) < 1 || typeof label !== 'string' || !label.trim()) return null;
	return { id: id as number };
}

/** Resolve current authority directly from EnrollPro. No local mirror or user-provided claim grants scheduler. */
export async function resolveSchedulerAncillaryAuthority(
	employeeId: string | null,
	options: SchedulerAncillaryAuthorityOptions = {},
	expectedSchoolYearId?: number,
): Promise<SchedulerAncillaryAuthorityResult> {
	if (!employeeId || typeof employeeId !== 'string' || !employeeId.trim()) {
		return { verified: false, eligible: false, code: 'FACULTY_IDENTITY_REQUIRED' };
	}
	const token = options.serviceToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
	if (!token) return { verified: false, eligible: false, code: 'ENROLLPRO_SERVICE_TOKEN_UNAVAILABLE' };
	const baseUrl = (options.baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/+$/, '');
	const fetchImpl = options.fetchImpl ?? fetch;
	const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
	try {
		const yearResponse = await fetchImpl(`${baseUrl}/integration/v1/school-year`, {
			headers,
			signal: AbortSignal.timeout(5_000),
		});
		if (!yearResponse.ok) return { verified: false, eligible: false, code: 'ACTIVE_SCHOOL_YEAR_UNAVAILABLE' };
		const activeYear = parseActiveSchoolYear(await yearResponse.json());
		if (!activeYear) return { verified: false, eligible: false, code: 'ACTIVE_SCHOOL_YEAR_MALFORMED' };
		if (expectedSchoolYearId !== undefined && activeYear.id !== expectedSchoolYearId) {
			return { verified: false, eligible: false, code: 'ACTIVE_SCHOOL_YEAR_CHANGED' };
		}
		const facultyUrl = `${baseUrl}/integration/v1/default/faculty?schoolYearId=${activeYear.id}`;
		const facultyResponse = await fetchImpl(facultyUrl, { headers, signal: AbortSignal.timeout(5_000) });
		if (!facultyResponse.ok) return { verified: false, eligible: false, code: 'FACULTY_FEED_UNAVAILABLE' };
		const validation = validateSchedulerAncillaryFeed(
			await facultyResponse.json(), employeeId, activeYear.id, (options.now ?? Date.now)(),
		);
		return validation.valid
			? { verified: true, eligible: validation.eligible, schoolYearId: validation.schoolYearId }
			: { verified: false, eligible: false, code: validation.code };
	} catch {
		return { verified: false, eligible: false, code: 'ENROLLPRO_AUTHORITY_UNAVAILABLE' };
	}
}
