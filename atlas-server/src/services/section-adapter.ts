/**
 * Section adapter interface and implementations.
 * Wave 3.5: Special program support + durable cache.
 *
 * Source metadata is always returned so callers can surface live vs fallback state.
 */

import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';

// ─── Types ───

export type ProgramType = 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'OTHER';

export interface ExternalSection {
	id: number;
	name: string;
	maxCapacity: number;
	enrolledCount: number;
	gradeLevelId: number;
	gradeLevelName: string;
	// Wave 3.5: Special program fields
	programType?: ProgramType;
	programCode?: string | null;
	programName?: string | null;
	admissionMode?: string | null;
	adviserId?: number | null;
	adviserName?: string | null;
}

export interface SectionsByGrade {
	gradeLevelId: number;
	gradeLevelName: string;
	displayOrder: number;
	sections: ExternalSection[];
}

export type SectionSourceLabel = 'enrollpro' | 'stub' | 'cached-enrollpro' | 'auto-fallback';

export interface SectionFetchResult {
	gradeLevels: SectionsByGrade[];
	source: SectionSourceLabel;
	fetchedAt: Date;
	fallbackReason?: string;
	isStale?: boolean;
}

export interface SectionSummary {
	schoolId: number;
	schoolYearId: number;
	totalSections: number;
	totalEnrolled: number;
	byGradeLevel: Record<number, number>;
	enrolledByGradeLevel: Record<number, number>;
	sections: ExternalSection[];
	source: SectionSourceLabel;
	fetchedAt: Date | null;
	isStale: boolean;
	fallbackReason?: string;
}

export interface SectionAdapter {
	fetchSectionsBySchoolYear(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionFetchResult>;
}

// ─── Cache helpers ───

function computeChecksum(payload: unknown): string {
	return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function saveSectionSnapshot(schoolId: number, schoolYearId: number, data: SectionFetchResult): Promise<void> {
	const checksum = computeChecksum(data.gradeLevels);
	await prisma.sectionSnapshot.upsert({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		update: {
			payload: data.gradeLevels as any,
			source: data.source,
			fetchedAt: data.fetchedAt,
			checksum,
		},
		create: {
			schoolId,
			schoolYearId,
			payload: data.gradeLevels as any,
			source: data.source,
			fetchedAt: data.fetchedAt,
			checksum,
		},
	});
}

async function loadSectionSnapshot(schoolId: number, schoolYearId: number): Promise<{
	gradeLevels: SectionsByGrade[];
	fetchedAt: Date;
} | null> {
	const snapshot = await prisma.sectionSnapshot.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	if (!snapshot) return null;
	return {
		gradeLevels: snapshot.payload as unknown as SectionsByGrade[],
		fetchedAt: snapshot.fetchedAt,
	};
}

/* ─── Stub adapter ─── */

const STUB_SECTIONS: SectionsByGrade[] = [
	{
		gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7,
		sections: [
			{ id: 1, name: '7-Rizal', maxCapacity: 40, enrolledCount: 35, gradeLevelId: 1, gradeLevelName: 'Grade 7', programType: 'REGULAR' },
			{ id: 2, name: '7-Bonifacio', maxCapacity: 40, enrolledCount: 32, gradeLevelId: 1, gradeLevelName: 'Grade 7', programType: 'REGULAR' },
			{ id: 3, name: '7-STE', maxCapacity: 40, enrolledCount: 38, gradeLevelId: 1, gradeLevelName: 'Grade 7', programType: 'STE', programCode: 'STE', programName: 'Science, Technology, and Engineering' },
		],
	},
	{
		gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8,
		sections: [
			{ id: 4, name: '8-Aquino', maxCapacity: 40, enrolledCount: 30, gradeLevelId: 2, gradeLevelName: 'Grade 8', programType: 'REGULAR' },
			{ id: 5, name: '8-Quezon', maxCapacity: 40, enrolledCount: 36, gradeLevelId: 2, gradeLevelName: 'Grade 8', programType: 'REGULAR' },
			{ id: 6, name: '8-STE', maxCapacity: 40, enrolledCount: 33, gradeLevelId: 2, gradeLevelName: 'Grade 8', programType: 'STE', programCode: 'STE', programName: 'Science, Technology, and Engineering' },
		],
	},
	{
		gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9,
		sections: [
			{ id: 7, name: '9-Luna', maxCapacity: 40, enrolledCount: 28, gradeLevelId: 3, gradeLevelName: 'Grade 9', programType: 'REGULAR' },
			{ id: 8, name: '9-SPS', maxCapacity: 40, enrolledCount: 37, gradeLevelId: 3, gradeLevelName: 'Grade 9', programType: 'SPS', programCode: 'SPS', programName: 'Special Program in Sports' },
		],
	},
	{
		gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10,
		sections: [
			{ id: 9, name: '10-Recto', maxCapacity: 40, enrolledCount: 34, gradeLevelId: 4, gradeLevelName: 'Grade 10', programType: 'REGULAR' },
			{ id: 10, name: '10-SPA', maxCapacity: 40, enrolledCount: 31, gradeLevelId: 4, gradeLevelName: 'Grade 10', programType: 'SPA', programCode: 'SPA', programName: 'Special Program in the Arts' },
		],
	},
];

export class StubSectionAdapter implements SectionAdapter {
	async fetchSectionsBySchoolYear(_schoolYearId: number, _schoolId: number): Promise<SectionFetchResult> {
		await new Promise((r) => setTimeout(r, 80));
		return { gradeLevels: STUB_SECTIONS, source: 'stub', fetchedAt: new Date() };
	}
}

/* ─── EnrollPro adapter ─── */

export class EnrollProSectionAdapter implements SectionAdapter {
	private baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
	}

	async fetchSectionsBySchoolYear(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionFetchResult> {
		const url = `${this.baseUrl}/sections/${schoolYearId}?level=JHS`;
		const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (token) headers['Authorization'] = `Bearer ${token}`;

		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw Object.assign(new Error(`EnrollPro sections API returned ${response.status}`), {
				statusCode: response.status,
				code: 'UPSTREAM_ERROR',
			});
		}

		const body = await response.json() as { gradeLevels?: SectionsByGrade[] };
		const gradeLevels = body.gradeLevels ?? [];
		const fetchedAt = new Date();

		const result: SectionFetchResult = {
			gradeLevels: gradeLevels.map((gl) => ({
				gradeLevelId: gl.gradeLevelId,
				gradeLevelName: gl.gradeLevelName,
				displayOrder: gl.displayOrder,
				sections: (gl.sections ?? []).map((s: any) => ({
					id: s.id,
					name: s.name,
					maxCapacity: s.maxCapacity ?? 0,
					enrolledCount: s.enrolledCount ?? 0,
					gradeLevelId: gl.gradeLevelId,
					gradeLevelName: gl.gradeLevelName,
					// Wave 3.5: Special program fields
					programType: (s.programType ?? 'REGULAR') as ProgramType,
					programCode: s.programCode ?? null,
					programName: s.programName ?? null,
					admissionMode: s.admissionMode ?? null,
					adviserId: s.adviserId ?? null,
					adviserName: s.adviserName ?? null,
				})),
			})),
			source: 'enrollpro',
			fetchedAt,
		};

		// Auto-save snapshot for durable cache
		await saveSectionSnapshot(schoolId, schoolYearId, result);

		return result;
	}
}

/* ─── Factory ─── */

/**
 * Section source mode (env: SECTION_SOURCE_MODE).
 *   stub     — always use deterministic stub data
 *   enrollpro — always use EnrollPro API (fails clearly if unreachable)
 *   auto     — prefer EnrollPro, fallback to stub with warning
 *
 * Legacy env vars SECTION_ADAPTER / FACULTY_ADAPTER = 'stub' are honoured
 * as shorthand for SECTION_SOURCE_MODE=stub.
 *
 * SECTION_STRICT_UPSTREAM=true makes 'auto' behave like fail-fast (no fallback).
 */
export type SectionSourceMode = 'stub' | 'enrollpro' | 'auto';

function resolveSectionSourceMode(): SectionSourceMode {
	const explicit = process.env.SECTION_SOURCE_MODE?.toLowerCase();
	if (explicit === 'stub' || explicit === 'enrollpro' || explicit === 'auto') return explicit;

	// Legacy compat
	const legacy = process.env.SECTION_ADAPTER ?? process.env.FACULTY_ADAPTER;
	if (legacy === 'stub') return 'stub';

	return 'enrollpro'; // default
}

export const sectionSourceMode: SectionSourceMode = resolveSectionSourceMode();

const strictUpstream = process.env.SECTION_STRICT_UPSTREAM?.toLowerCase() === 'true';

class AutoSectionAdapter implements SectionAdapter {
	private enrollpro = new EnrollProSectionAdapter();
	private stub = new StubSectionAdapter();

	async fetchSectionsBySchoolYear(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionFetchResult> {
		try {
			return await this.enrollpro.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			const errClass = error instanceof Error ? error.constructor.name : 'Unknown';

			// Structured warning log
			console.warn(JSON.stringify({
				level: 'WARN',
				event: 'section_adapter_fallback',
				schoolYearId,
				schoolId,
				errorClass: errClass,
				errorMessage: msg,
				ts: new Date().toISOString(),
			}));

			if (strictUpstream) {
				// In strict mode, do not silently fall back
				throw error;
			}

			// Wave 3.5: Try durable cache first before stub
			const cached = await loadSectionSnapshot(schoolId, schoolYearId);
			if (cached) {
				return {
					gradeLevels: cached.gradeLevels,
					source: 'cached-enrollpro',
					fetchedAt: cached.fetchedAt,
					fallbackReason: msg,
					isStale: true,
				};
			}

			// Final fallback: stub data
			const stubResult = await this.stub.fetchSectionsBySchoolYear(schoolYearId, schoolId);
			return {
				gradeLevels: stubResult.gradeLevels,
				source: 'auto-fallback',
				fetchedAt: stubResult.fetchedAt,
				fallbackReason: msg,
			};
		}
	}
}

function buildSectionAdapter(mode: SectionSourceMode): SectionAdapter {
	switch (mode) {
		case 'stub': return new StubSectionAdapter();
		case 'enrollpro': return new EnrollProSectionAdapter();
		case 'auto': return new AutoSectionAdapter();
	}
}

export const sectionAdapter: SectionAdapter = buildSectionAdapter(sectionSourceMode);
