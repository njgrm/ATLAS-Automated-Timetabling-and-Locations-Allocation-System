/**
 * Cohort service — TLE inter-section cohort ingestion and management.
 * Wave 3.5: Supports specialized TLE groups (IA, HE, etc.) that span multiple sections.
 *
 * Cohorts are fetched from EnrollPro's SCP config endpoint and persisted locally
 * for scheduling reference.
 */

import { getDataContext } from '../lib/data-context.js';
import type { RoomType } from '@prisma/client';
import { sectionAdapter, type SectionsByGrade, type ExternalSection } from './section-adapter.js';

const db = () => getDataContext();

// ─── Types ───

export interface ExternalCohort {
	cohortCode: string;
	specializationCode: string;
	specializationName: string;
	gradeLevel: number;
	memberSectionIds: number[];
	expectedEnrollment: number;
	preferredRoomType?: RoomType | null;
	sourceRef?: string | null;
}

export interface CohortFetchResult {
	cohorts: ExternalCohort[];
	source: 'enrollpro' | 'stub' | 'derived-sections' | 'derived-special-program' | 'cached-enrollpro';
	fetchedAt: Date;
	contractWarnings?: string[];
}

export interface CohortAdapter {
	fetchCohorts(
		schoolYearId: number,
		schoolId: number,
		authToken?: string,
		context?: { sectionsByGrade?: SectionsByGrade[] },
	): Promise<CohortFetchResult>;
}

interface EnrollProScpProgramConfig {
	id?: number;
	scpType?: string;
	isOffered?: boolean;
}

interface EnrollProScpConfigResponse {
	cohorts?: Array<Partial<ExternalCohort>>;
	scpProgramConfigs?: EnrollProScpProgramConfig[];
}

const TLE_SPECIALIZATION_CODE_ALIASES: Record<string, string> = {
	INDUSTRIAL_ARTS: 'IA',
	HOME_ECONOMICS: 'HE',
	AGRI_FISHERY_ARTS: 'AFA',
	AGRICULTURE_AND_FISHERY_ARTS: 'AFA',
	AGRICULTURE_FISHERY_ARTS: 'AFA',
	FAMILY_AND_CONSUMER_SCIENCE: 'FCS',
	FCS: 'FCS',
	ICT: 'ICT',
	INFORMATION_AND_COMMUNICATIONS_TECHNOLOGY: 'ICT',
};

function normalizeTleSpecializationCode(section: ExternalSection): string | null {
	const raw = section.tleSpecialization ?? section.tleProgramCategory ?? null;
	if (typeof raw !== 'string' || raw.trim().length === 0) return null;
	const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
	return TLE_SPECIALIZATION_CODE_ALIASES[normalized] ?? normalized;
}

function inferTleSpecializationName(section: ExternalSection, specializationCode: string): string {
	return (section.tleSpecialization ?? section.tleProgramCategory ?? specializationCode).trim();
}

function inferTlePreferredRoomType(section: ExternalSection, specializationCode: string): RoomType | null {
	const raw = `${section.tleProgramCategory ?? ''} ${section.tleSpecialization ?? ''} ${specializationCode}`.toUpperCase();
	if (raw.includes('ICT')) return 'COMPUTER_LAB';
	if (raw.includes('SPORT')) return 'GYMNASIUM';
	if (raw.includes('IA') || raw.includes('AGRI') || raw.includes('AFA') || raw.includes('FCS') || raw.includes('HE')) return 'LABORATORY';
	return null;
}

function normalizeExplicitCohort(rawCohort: Partial<ExternalCohort>): ExternalCohort | null {
	if (!rawCohort.cohortCode || !rawCohort.specializationCode || !rawCohort.specializationName || rawCohort.gradeLevel == null) {
		return null;
	}

	return {
		cohortCode: rawCohort.cohortCode,
		specializationCode: rawCohort.specializationCode,
		specializationName: rawCohort.specializationName,
		gradeLevel: rawCohort.gradeLevel,
		memberSectionIds: Array.isArray(rawCohort.memberSectionIds) ? rawCohort.memberSectionIds.filter((value): value is number => typeof value === 'number') : [],
		expectedEnrollment: typeof rawCohort.expectedEnrollment === 'number' ? rawCohort.expectedEnrollment : 0,
		preferredRoomType: rawCohort.preferredRoomType ?? null,
		sourceRef: rawCohort.sourceRef ?? 'enrollpro:explicit-cohorts',
	};
}

export function deriveFallbackTleCohorts(gradeLevels: SectionsByGrade[]): ExternalCohort[] {
	const cohortsByCode = new Map<string, ExternalCohort>();

	for (const gradeLevel of gradeLevels) {
		for (const section of gradeLevel.sections) {
			const specializationCode = normalizeTleSpecializationCode(section);
			if (!specializationCode) continue;

			const cohortCode = `G${gradeLevel.displayOrder}-TLE-${specializationCode}`;
			const existing = cohortsByCode.get(cohortCode);
			if (existing) {
				existing.memberSectionIds.push(section.id);
				existing.expectedEnrollment += section.enrolledCount;
				if (!existing.preferredRoomType) {
					existing.preferredRoomType = inferTlePreferredRoomType(section, specializationCode);
				}
				continue;
			}

			cohortsByCode.set(cohortCode, {
				cohortCode,
				specializationCode,
				specializationName: inferTleSpecializationName(section, specializationCode),
				gradeLevel: gradeLevel.displayOrder,
				memberSectionIds: [section.id],
				expectedEnrollment: section.enrolledCount,
				preferredRoomType: inferTlePreferredRoomType(section, specializationCode),
				sourceRef: 'derived:section-ownership',
			});
		}
	}

	return [...cohortsByCode.values()].sort((left, right) => left.gradeLevel - right.gradeLevel || left.cohortCode.localeCompare(right.cohortCode));
}

function normalizeSpecialProgramType(programType: string | null | undefined): 'SPA' | 'SPS' | null {
	const normalized = (programType ?? '').trim().toUpperCase();
	if (normalized === 'SPA') return 'SPA';
	if (normalized === 'SPS') return 'SPS';
	return null;
}

function normalizeSpecialProgramSpecializationCode(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
	return normalized.length > 0 ? normalized : null;
}

function inferSpecialProgramFromSubjectCode(subjectCode: string | null | undefined): 'SPA' | 'SPS' | null {
	const normalized = (subjectCode ?? '').trim().toUpperCase();
	if (normalized.startsWith('SPA_')) return 'SPA';
	if (normalized.startsWith('SPS_')) return 'SPS';
	return null;
}

function titleCaseSpecializationLabel(code: string): string {
	return code
		.split('_')
		.filter((part) => part.length > 0)
		.map((part) => part.charAt(0) + part.slice(1).toLowerCase())
		.join(' ');
}

function toCohortSpecializationCode(rawCode: string): string {
	if (rawCode.length <= 20) return rawCode;
	const normalized = rawCode.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
	if (normalized.length <= 20) return normalized;
	const compact = normalized.replace(/_/g, '');
	const suffix = compact.slice(-4).toUpperCase();
	const head = normalized.slice(0, 15).replace(/_+$/g, '');
	return `${head}_${suffix}`.slice(0, 20);
}

function toCohortCode(gradeLevel: number, programType: 'SPA' | 'SPS', specializationCode: string): string {
	return `G${gradeLevel}-${programType}-${specializationCode}`.slice(0, 50);
}

function mergeCohortLists(base: ExternalCohort[], enrichment: ExternalCohort[]): ExternalCohort[] {
	const mergedByCode = new Map<string, ExternalCohort>();

	for (const cohort of [...base, ...enrichment]) {
		const existing = mergedByCode.get(cohort.cohortCode);
		if (!existing) {
			mergedByCode.set(cohort.cohortCode, {
				...cohort,
				memberSectionIds: [...new Set(cohort.memberSectionIds)].sort((left, right) => left - right),
			});
			continue;
		}

		existing.memberSectionIds = [...new Set([...existing.memberSectionIds, ...cohort.memberSectionIds])]
			.sort((left, right) => left - right);
		existing.expectedEnrollment = Math.max(existing.expectedEnrollment, cohort.expectedEnrollment);
		if (!existing.preferredRoomType && cohort.preferredRoomType) {
			existing.preferredRoomType = cohort.preferredRoomType;
		}
		if (!existing.sourceRef && cohort.sourceRef) {
			existing.sourceRef = cohort.sourceRef;
		}
		if (!existing.specializationName && cohort.specializationName) {
			existing.specializationName = cohort.specializationName;
		}
	}

	return [...mergedByCode.values()].sort((left, right) => left.gradeLevel - right.gradeLevel || left.cohortCode.localeCompare(right.cohortCode));
}

async function deriveSpecialProgramCohortsFromOwnership(
	schoolId: number,
	schoolYearId: number,
	sectionsByGrade: SectionsByGrade[],
): Promise<ExternalCohort[]> {
	const specialSections = sectionsByGrade
		.flatMap((grade) => grade.sections.map((section) => ({
			sectionId: section.id,
			gradeLevel: grade.displayOrder,
			programType: normalizeSpecialProgramType(section.programType ?? null),
			enrolledCount: Number.isFinite(section.enrolledCount) ? section.enrolledCount : 0,
		})))
		.filter((entry): entry is { sectionId: number; gradeLevel: number; programType: 'SPA' | 'SPS'; enrolledCount: number } => entry.programType != null);

	if (specialSections.length === 0) {
		return [];
	}

	const sectionById = new Map(specialSections.map((section) => [section.sectionId, section]));

	const trackedSubjects = await db().subject.findMany({
		where: {
			schoolId,
			OR: [
				{ code: 'SPA_SPEC' },
				{ code: 'SPS_SPEC' },
				{ code: { startsWith: 'SPA_' } },
				{ code: { startsWith: 'SPS_' } },
			],
		},
		select: { id: true, code: true },
	});

	if (trackedSubjects.length === 0) {
		return [];
	}

	const subjectCodeById = new Map(trackedSubjects.map((subject) => [subject.id, subject.code]));

	const ownershipRows = await db().subjectSectionOwnership.findMany({
		where: {
			schoolId,
			subjectId: { in: trackedSubjects.map((subject) => subject.id) },
			sectionId: { in: [...sectionById.keys()] },
		},
		select: {
			subjectId: true,
			sectionId: true,
			specializationCode: true,
			specializationLabel: true,
		},
	});

	const buckets = new Map<string, {
		cohortCode: string;
		specializationCode: string;
		specializationName: string;
		gradeLevel: number;
		memberSectionIds: Set<number>;
		expectedEnrollment: number;
	}>();

	for (const row of ownershipRows) {
		const section = sectionById.get(row.sectionId);
		if (!section) continue;

		const subjectCode = subjectCodeById.get(row.subjectId) ?? null;
		const inferredProgram = section.programType ?? inferSpecialProgramFromSubjectCode(subjectCode);
		if (!inferredProgram) continue;

		const normalizedSpecializationCode = normalizeSpecialProgramSpecializationCode(
			row.specializationCode ?? row.specializationLabel,
		);
		if (!normalizedSpecializationCode) continue;

		const specializationCode = toCohortSpecializationCode(normalizedSpecializationCode);

		const specializationName = typeof row.specializationLabel === 'string' && row.specializationLabel.trim().length > 0
			? row.specializationLabel.trim()
			: titleCaseSpecializationLabel(normalizedSpecializationCode);

		const cohortCode = toCohortCode(section.gradeLevel, inferredProgram, specializationCode);
		const key = `${section.gradeLevel}:${inferredProgram}:${specializationCode}`;
		const existing = buckets.get(key);
		if (!existing) {
			buckets.set(key, {
				cohortCode,
				specializationCode,
				specializationName,
				gradeLevel: section.gradeLevel,
				memberSectionIds: new Set([section.sectionId]),
				expectedEnrollment: Math.max(0, section.enrolledCount),
			});
			continue;
		}

		existing.memberSectionIds.add(section.sectionId);
		existing.expectedEnrollment += Math.max(0, section.enrolledCount);
	}

	return [...buckets.values()]
		.map((bucket) => ({
			cohortCode: bucket.cohortCode,
			specializationCode: bucket.specializationCode,
			specializationName: bucket.specializationName,
			gradeLevel: bucket.gradeLevel,
			memberSectionIds: [...bucket.memberSectionIds].sort((left, right) => left - right),
			expectedEnrollment: bucket.expectedEnrollment,
			preferredRoomType: null,
			sourceRef: 'derived:special-program-ownership',
		}))
		.sort((left, right) => left.gradeLevel - right.gradeLevel || left.cohortCode.localeCompare(right.cohortCode));
}

export function normalizeEnrollProCohortResponse(
	body: unknown,
	sectionsByGrade: SectionsByGrade[] = [],
): { cohorts: ExternalCohort[]; source: CohortFetchResult['source']; warnings: string[] } {
	const warnings: string[] = [];
	if (!body || typeof body !== 'object') {
		warnings.push('EnrollPro SCP config response was not an object; returning an empty cohort payload.');
		return { cohorts: [], source: 'enrollpro', warnings };
	}

	const payload = body as EnrollProScpConfigResponse;
	if (Array.isArray(payload.cohorts) && payload.cohorts.length > 0) {
		const cohorts = payload.cohorts
			.map((rawCohort) => normalizeExplicitCohort(rawCohort))
			.filter((cohort): cohort is ExternalCohort => cohort != null);
		return { cohorts, source: 'enrollpro', warnings };
	}

	const derivedFromOwnership = sectionsByGrade.length > 0 ? deriveFallbackTleCohorts(sectionsByGrade) : [];
	if (derivedFromOwnership.length > 0) {
		warnings.push('EnrollPro did not return explicit cohorts; deriving TLE cohorts from section ownership fields.');
		return { cohorts: derivedFromOwnership, source: 'derived-sections', warnings };
	}

	if (Array.isArray(payload.scpProgramConfigs)) {
		warnings.push('EnrollPro SCP config returned scpProgramConfigs without explicit cohorts, but no section TLE ownership fields were available to derive cohorts from.');
	}

	return { cohorts: [], source: 'enrollpro', warnings };
}

// ─── Stub Adapter ───

const STUB_COHORTS: ExternalCohort[] = [
	{
		cohortCode: 'G7-TLE-IA',
		specializationCode: 'IA',
		specializationName: 'Industrial Arts',
		gradeLevel: 7,
		memberSectionIds: [1, 2],
		expectedEnrollment: 67,
		preferredRoomType: 'TLE_WORKSHOP',
	},
	{
		cohortCode: 'G7-TLE-HE',
		specializationCode: 'HE',
		specializationName: 'Home Economics',
		gradeLevel: 7,
		memberSectionIds: [3],
		expectedEnrollment: 38,
		preferredRoomType: 'LABORATORY',
	},
	{
		cohortCode: 'G8-TLE-IA',
		specializationCode: 'IA',
		specializationName: 'Industrial Arts',
		gradeLevel: 8,
		memberSectionIds: [4, 5],
		expectedEnrollment: 66,
		preferredRoomType: 'TLE_WORKSHOP',
	},
	{
		cohortCode: 'G8-TLE-HE',
		specializationCode: 'HE',
		specializationName: 'Home Economics',
		gradeLevel: 8,
		memberSectionIds: [6],
		expectedEnrollment: 33,
		preferredRoomType: 'LABORATORY',
	},
];

class StubCohortAdapter implements CohortAdapter {
	async fetchCohorts(_schoolYearId: number, _schoolId: number): Promise<CohortFetchResult> {
		await new Promise((r) => setTimeout(r, 50));
		return { cohorts: STUB_COHORTS, source: 'stub', fetchedAt: new Date() };
	}
}

// ─── EnrollPro Adapter ───

class EnrollProCohortAdapter implements CohortAdapter {
	private baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
	}

	async fetchCohorts(
		_schoolYearId: number,
		_schoolId: number,
		_authToken?: string,
		context?: { sectionsByGrade?: SectionsByGrade[] },
	): Promise<CohortFetchResult> {
		// Use /settings/scp-config which is public (no auth) and returns the same
		// scpProgramConfigs shape. The /curriculum/{id}/scp-config endpoint requires
		// auth and uses EnrollPro-internal school year IDs, causing 401/404 in cross-
		// machine Tailscale setups where ATLAS and EnrollPro use different ID sequences.
		const url = `${this.baseUrl}/settings/scp-config`;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };

		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw Object.assign(new Error(`EnrollPro SCP config API returned ${response.status}`), {
				statusCode: response.status,
				code: 'UPSTREAM_ERROR',
			});
		}

		const body = await response.json();
		const normalized = normalizeEnrollProCohortResponse(body, context?.sectionsByGrade ?? []);

		return {
			cohorts: normalized.cohorts,
			source: normalized.source,
			fetchedAt: new Date(),
			...(normalized.warnings.length > 0 ? { contractWarnings: normalized.warnings } : {}),
		};
	}
}

// ─── Factory ───

type CohortSourceMode = 'stub' | 'enrollpro' | 'auto';

function resolveCohortSourceMode(): CohortSourceMode {
	const explicit = process.env.COHORT_SOURCE_MODE?.toLowerCase();
	if (explicit === 'stub' || explicit === 'enrollpro' || explicit === 'auto') return explicit;
	const legacy = process.env.SECTION_SOURCE_MODE?.toLowerCase();
	if (legacy === 'stub') return 'stub';
	return 'auto';
}

const cohortSourceMode = resolveCohortSourceMode();

class AutoCohortAdapter implements CohortAdapter {
	private enrollpro = new EnrollProCohortAdapter();

	async fetchCohorts(
		schoolYearId: number,
		schoolId: number,
		authToken?: string,
		context?: { sectionsByGrade?: SectionsByGrade[] },
	): Promise<CohortFetchResult> {
		try {
			return await this.enrollpro.fetchCohorts(schoolYearId, schoolId, authToken, context);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.warn(JSON.stringify({
				level: 'WARN',
				event: 'cohort_adapter_fallback',
				schoolYearId,
				schoolId,
				errorMessage: msg,
				ts: new Date().toISOString(),
			}));
			const existing = await db().instructionalCohort.findMany({
				where: { schoolId, schoolYearId },
				orderBy: [{ gradeLevel: 'asc' }, { specializationCode: 'asc' }],
			});

			if (existing.length > 0) {
				return {
					cohorts: existing.map((cohort) => ({
						cohortCode: cohort.cohortCode,
						specializationCode: cohort.specializationCode,
						specializationName: cohort.specializationName,
						gradeLevel: cohort.gradeLevel,
						memberSectionIds: cohort.memberSectionIds,
						expectedEnrollment: cohort.expectedEnrollment,
						preferredRoomType: cohort.preferredRoomType,
						sourceRef: cohort.sourceRef,
					})),
					source: 'cached-enrollpro',
					fetchedAt: new Date(),
					contractWarnings: [`EnrollPro cohort source failed (${msg}); using cached cohort snapshot instead.`],
				};
			}

			throw Object.assign(new Error(`UPSTREAM_UNAVAILABLE: EnrollPro cohort source failed (${msg}) and no cached cohorts exist.`), {
				code: 'UPSTREAM_UNAVAILABLE',
			});
		}
	}
}

function buildCohortAdapter(mode: CohortSourceMode): CohortAdapter {
	switch (mode) {
		case 'stub': return new StubCohortAdapter();
		case 'enrollpro': return new EnrollProCohortAdapter();
		case 'auto': return new AutoCohortAdapter();
	}
}

const cohortAdapter: CohortAdapter = buildCohortAdapter(cohortSourceMode);

// ─── Service Methods ───

export interface CohortSyncResult {
	synced: boolean;
	source: 'enrollpro' | 'stub' | 'derived-sections' | 'derived-special-program' | 'cached-enrollpro' | 'preserved-existing';
	fetchedAt: Date;
	count: number;
	error?: string;
	warnings?: string[];
}

/**
 * Sync cohorts from external source and persist to InstructionalCohort table.
 */
export async function syncCohorts(schoolId: number, schoolYearId: number, authToken?: string): Promise<CohortSyncResult> {
	try {
		const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
		const result = await cohortAdapter.fetchCohorts(schoolYearId, schoolId, authToken, {
			sectionsByGrade: sectionResult.gradeLevels,
		});
		const derivedSpecialProgramCohorts = await deriveSpecialProgramCohortsFromOwnership(
			schoolId,
			schoolYearId,
			sectionResult.gradeLevels,
		);
		const mergedCohorts = mergeCohortLists(result.cohorts, derivedSpecialProgramCohorts);

		const warnings = [
			...(sectionResult.contractWarnings ?? []),
			...(result.contractWarnings ?? []),
		];
		if (derivedSpecialProgramCohorts.length > 0) {
			warnings.push(`Derived ${derivedSpecialProgramCohorts.length} SPA/SPS specialization breakout cohort lanes from active ownership assignments.`);
		}

		if (mergedCohorts.length === 0) {
			const existingCount = await db().instructionalCohort.count({
				where: { schoolId, schoolYearId, isActive: true },
			});
			if (existingCount > 0) {
				return {
					synced: true,
					source: 'preserved-existing',
					fetchedAt: result.fetchedAt,
					count: existingCount,
					warnings: [...warnings, 'No explicit cohorts were available from the live contract; existing local cohorts were preserved.'],
				};
			}

			return {
				synced: true,
				source: result.source,
				fetchedAt: result.fetchedAt,
				count: 0,
				...(warnings.length > 0 ? { warnings } : {}),
			};
		}

		await db().$transaction([
			db().instructionalCohort.deleteMany({
				where: { schoolId, schoolYearId },
			}),
			db().instructionalCohort.createMany({
				data: mergedCohorts.map((c) => ({
					schoolId,
					schoolYearId,
					cohortCode: c.cohortCode,
					specializationCode: c.specializationCode,
					specializationName: c.specializationName,
					gradeLevel: c.gradeLevel,
					memberSectionIds: c.memberSectionIds,
					expectedEnrollment: c.expectedEnrollment,
					preferredRoomType: c.preferredRoomType,
					sourceRef: c.sourceRef ?? null,
					isActive: true,
				})) ,
			}),
		]);

		return {
			synced: true,
			source: result.source === 'derived-sections' && derivedSpecialProgramCohorts.length > 0
				? 'derived-special-program'
				: result.source,
			fetchedAt: result.fetchedAt,
			count: mergedCohorts.length,
			...(warnings.length > 0 ? { warnings } : {}),
		};
	} catch (error) {
		return {
			synced: false,
			source: 'enrollpro',
			fetchedAt: new Date(),
			count: 0,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Get all cohorts for a school/year from local persistence.
 */
export async function getCohortsBySchoolYear(schoolId: number, schoolYearId: number) {
	return db().instructionalCohort.findMany({
		where: { schoolId, schoolYearId, isActive: true },
		orderBy: [{ gradeLevel: 'asc' }, { specializationCode: 'asc' }],
	});
}

/**
 * Get cohorts by grade level.
 */
export async function getCohortsByGrade(schoolId: number, schoolYearId: number, gradeLevel: number) {
	return db().instructionalCohort.findMany({
		where: { schoolId, schoolYearId, gradeLevel, isActive: true },
		orderBy: { specializationCode: 'asc' },
	});
}

/**
 * Get a single cohort by code.
 */
export async function getCohortByCode(schoolId: number, schoolYearId: number, cohortCode: string) {
	return db().instructionalCohort.findFirst({
		where: { schoolId, schoolYearId, cohortCode, isActive: true },
	});
}
