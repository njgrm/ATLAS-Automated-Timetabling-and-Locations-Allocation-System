/**
 * Cohort service — TLE inter-section cohort ingestion and management.
 * Wave 3.5: Supports specialized TLE groups (IA, HE, etc.) that span multiple sections.
 *
 * Cohorts are fetched from EnrollPro's SCP config endpoint and persisted locally
 * for scheduling reference.
 */

import { prisma } from '../lib/prisma.js';
import type { RoomType } from '@prisma/client';

// ─── Types ───

export interface ExternalCohort {
	cohortCode: string;
	specializationCode: string;
	specializationName: string;
	gradeLevel: number;
	memberSectionIds: number[];
	expectedEnrollment: number;
	preferredRoomType?: RoomType | null;
}

export interface CohortFetchResult {
	cohorts: ExternalCohort[];
	source: 'enrollpro' | 'stub';
	fetchedAt: Date;
}

export interface CohortAdapter {
	fetchCohorts(schoolYearId: number, schoolId: number, authToken?: string): Promise<CohortFetchResult>;
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

	async fetchCohorts(schoolYearId: number, _schoolId: number, authToken?: string): Promise<CohortFetchResult> {
		const url = `${this.baseUrl}/curriculum/${schoolYearId}/scp-config`;
		const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (token) headers['Authorization'] = `Bearer ${token}`;

		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw Object.assign(new Error(`EnrollPro SCP config API returned ${response.status}`), {
				statusCode: response.status,
				code: 'UPSTREAM_ERROR',
			});
		}

		const body = await response.json() as { cohorts?: ExternalCohort[] };
		const cohorts = (body.cohorts ?? []).map((c: any) => ({
			cohortCode: c.cohortCode ?? `G${c.gradeLevel}-TLE-${c.specializationCode}`,
			specializationCode: c.specializationCode,
			specializationName: c.specializationName,
			gradeLevel: c.gradeLevel,
			memberSectionIds: c.memberSectionIds ?? [],
			expectedEnrollment: c.expectedEnrollment ?? 0,
			preferredRoomType: c.preferredRoomType ?? null,
		}));

		return { cohorts, source: 'enrollpro', fetchedAt: new Date() };
	}
}

// ─── Factory ───

type CohortSourceMode = 'stub' | 'enrollpro' | 'auto';

function resolveCohortSourceMode(): CohortSourceMode {
	const explicit = process.env.COHORT_SOURCE_MODE?.toLowerCase();
	if (explicit === 'stub' || explicit === 'enrollpro' || explicit === 'auto') return explicit;
	const legacy = process.env.SECTION_SOURCE_MODE?.toLowerCase();
	if (legacy === 'stub') return 'stub';
	return 'enrollpro';
}

const cohortSourceMode = resolveCohortSourceMode();

class AutoCohortAdapter implements CohortAdapter {
	private enrollpro = new EnrollProCohortAdapter();
	private stub = new StubCohortAdapter();

	async fetchCohorts(schoolYearId: number, schoolId: number, authToken?: string): Promise<CohortFetchResult> {
		try {
			return await this.enrollpro.fetchCohorts(schoolYearId, schoolId, authToken);
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
			return await this.stub.fetchCohorts(schoolYearId, schoolId);
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
	source: 'enrollpro' | 'stub';
	fetchedAt: Date;
	count: number;
	error?: string;
}

/**
 * Sync cohorts from external source and persist to InstructionalCohort table.
 */
export async function syncCohorts(schoolId: number, schoolYearId: number, authToken?: string): Promise<CohortSyncResult> {
	try {
		const result = await cohortAdapter.fetchCohorts(schoolYearId, schoolId, authToken);

		// Clear existing cohorts for this school/year and re-insert
		await prisma.instructionalCohort.deleteMany({
			where: { schoolId, schoolYearId },
		});

		if (result.cohorts.length > 0) {
			await prisma.instructionalCohort.createMany({
				data: result.cohorts.map((c) => ({
					schoolId,
					schoolYearId,
					cohortCode: c.cohortCode,
					specializationCode: c.specializationCode,
					specializationName: c.specializationName,
					gradeLevel: c.gradeLevel,
					memberSectionIds: c.memberSectionIds,
					expectedEnrollment: c.expectedEnrollment,
					preferredRoomType: c.preferredRoomType,
				})),
			});
		}

		return {
			synced: true,
			source: result.source,
			fetchedAt: result.fetchedAt,
			count: result.cohorts.length,
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
	return prisma.instructionalCohort.findMany({
		where: { schoolId, schoolYearId },
		orderBy: [{ gradeLevel: 'asc' }, { specializationCode: 'asc' }],
	});
}

/**
 * Get cohorts by grade level.
 */
export async function getCohortsByGrade(schoolId: number, schoolYearId: number, gradeLevel: number) {
	return prisma.instructionalCohort.findMany({
		where: { schoolId, schoolYearId, gradeLevel },
		orderBy: { specializationCode: 'asc' },
	});
}

/**
 * Get a single cohort by code.
 */
export async function getCohortByCode(schoolId: number, schoolYearId: number, cohortCode: string) {
	return prisma.instructionalCohort.findFirst({
		where: { schoolId, schoolYearId, cohortCode },
	});
}
