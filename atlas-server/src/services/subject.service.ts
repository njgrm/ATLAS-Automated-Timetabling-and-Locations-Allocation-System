import { prisma } from '../lib/prisma.js';
import type { ProgramType } from '@prisma/client';
import { inferSubjectProgramScopes } from './subject-program-scope.service.js';
import {
	resolveSubjectContractDefaults,
	resolveSubjectOwnerDepartmentCode,
	resolveSubjectQualificationPriority,
	resolveSubjectRotationFamily,
	resolveSubjectOutputLabel,
	mergeRequiredFeaturesWithAdditionalOwnerDepartments,
	resolveSubjectAllowedOwnerDepartments,
	resolveRotationTermMetadata,
} from './subject-ownership.service.js';

const MATATAG_DEFAULTS: Array<{
	code: string;
	name: string;
	minMinutesPerWeek: number;
	preferredRoomType: 'CLASSROOM' | 'LABORATORY' | 'GYMNASIUM' | 'TLE_WORKSHOP' | 'COMPUTER_LAB' | 'LIBRARY' | 'FACULTY_ROOM' | 'OFFICE' | 'OTHER';
	gradeLevels: number[];
	isSeedable: boolean;
	modularGroupId?: string;
	modularOrder?: number;
	termGroupId?: string;
	termCount?: number;
	programScopes: ProgramType[];
	allowedSpecializations?: string[];
	interSectionEnabled?: boolean;
	interSectionGradeLevels?: number[];
	requiredFeatures?: string[];
	isActive?: boolean;
	ownerDepartment?: string | null;
	qualificationPriority?: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
	rotationFamily?: string | null;
	outputLabel?: string;
	isSystemManaged?: boolean;
	allowedOwnerDepartments?: string[];
}> = [
	// Core bundle shared by regular + offered special programs.
	{ code: 'FIL', name: 'Filipino', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'ESP', name: 'ESP/GMRC', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },

	// Regular science contract (tri-sem).
	{ code: 'SCI_BIO', name: 'Science - Biology', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 1, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'SCI_CHEM', name: 'Science - Chemistry', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 2, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'SCI_ES', name: 'Science - Earth Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 3, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	// Exploratory TLE rotation (active across current section programs).
	{ code: 'TLE_ICT_EXP', name: 'TLE Exploratory - ICT', minMinutesPerWeek: 225, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 1, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], allowedSpecializations: ['ICT'] },
	{ code: 'TLE_AFA_EXP', name: 'TLE Exploratory - Agriculture and Fishery Arts', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 2, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], allowedSpecializations: ['AFA'] },
	{ code: 'TLE_FCS_EXP', name: 'TLE Exploratory - Family and Consumer Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], allowedSpecializations: ['FCS'] },

	// STE overlays.
	{ code: 'STE_ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_BIOTECH', name: 'Biotechnology', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_APPLIED_CHEM', name: 'Applied Chemistry', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_APPLIED_PHYS', name: 'Applied Physics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_ROBOTICS', name: 'Robotics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [10], isSeedable: false, programScopes: ['STE'], allowedOwnerDepartments: ['TLE'] },
	{ code: 'STE_RESEARCH', name: 'Research', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE'] },

	// SPA / SPS umbrella specialization overlays.
	{ code: 'SPA_SPEC', name: 'Special Program in the Arts: Specialization', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'], allowedSpecializations: ['MUSIC', 'VISUAL_ARTS', 'THEATER_ARTS', 'MEDIA_ARTS', 'CREATIVE_WRITING', 'DANCE', 'TRADITIONAL_ARTS'], interSectionEnabled: true, interSectionGradeLevels: [7, 8, 9, 10] },
	{ code: 'SPS_SPEC', name: 'Special Program in Sports: Specialization', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPS'], allowedSpecializations: ['ATHLETICS', 'SWIMMING', 'BASKETBALL', 'VOLLEYBALL', 'FOOTBALL', 'SEPAK_TAKRAW', 'SOFTBALL', 'BASEBALL', 'BADMINTON', 'TABLE_TENNIS', 'TAEKWONDO', 'TENNIS', 'CHESS', 'GYMNASTICS', 'ARCHERY', 'ARNIS'], interSectionEnabled: true, interSectionGradeLevels: [7, 8, 9, 10] },
	{ code: 'DEVL_READING', name: 'Developmental Reading', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA', 'SPS'] },
];

const DEPRECATED_SUBJECT_CODES = [
	'SCI',
	'ICT',
	'TLE_ICT_7',
	'TLE_ICT_8',
	'TLE_ICT_9',
	'TLE_ICT_10',
	'RESEARCH_I',
	'RESEARCH_II',
	'RESEARCH_III',
	'RESEARCH_IV',
	'ENV_SCI',
	'BIOTECHNOLOGY',
	'CONSUMERS_CHEMISTRY',
	'ELECTRONICS_ROBOTICS',
	'ADVANCED_CHEMISTRY',
	'ADVANCED_PHYSICS',
	'ADVANCED_STATISTICS',
	'BASIC_STATISTICS',
	'ELECTRONICS',
	'SPA_SPECIALIZATION',
	'MUSIC',
	'VISUAL_ARTS',
	'THEATER_ARTS',
	'MEDIA_ARTS',
	'CREATIVE_WRITING',
	'DANCE',
	'TLE_IA_EXP',
	'TLE',
	'SCI_PHYS',
	'STE_ICT',
];

const PROGRAM_OVERLAY_CODES: Record<ProgramType, string[]> = {
	REGULAR: [],
	STE: ['STE_ENV_SCI', 'STE_BIOTECH', 'STE_APPLIED_CHEM', 'STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'],
	SPA: ['SPA_SPEC'],
	SPS: ['SPS_SPEC'],
	OTHER: [],
};

const DYNAMIC_TLE_PREFIX = 'TLE_SPEC_';

type SubjectWithViewMetadata = {
	displayCode: string;
	ownerDepartment: string | null;
	allowedOwnerDepartments: string[];
	qualificationPriority: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
	rotationFamily: string | null;
	rotationTermRank: number | null;
	rotationTermLabel: string | null;
	rotationTermGroupId: string | null;
	rotationTermCount: number | null;
	specializationSource: 'REFERENCE_METADATA' | 'NONE';
	isSystemManaged: boolean;
};

function withSubjectViewMetadata<T extends {
	code: string;
	name: string;
	modularGroupId?: string | null;
	modularOrder?: number | null;
	termGroupId?: string | null;
	termCount?: number | null;
	outputLabel?: string | null;
	ownerDepartment?: string | null;
	qualificationPriority?: string | null;
	rotationFamily?: string | null;
	isSystemManaged?: boolean;
	allowedSpecializations?: string[];
	requiredFeatures?: string[];
}>(subject: T): T & SubjectWithViewMetadata {
	const outputLabel = subject.outputLabel?.trim();
	const ownerDepartment = subject.ownerDepartment ?? resolveSubjectOwnerDepartmentCode(subject.code, subject.name);
	const allowedOwnerDepartments = resolveSubjectAllowedOwnerDepartments(
		subject.ownerDepartment,
		subject.code,
		subject.name,
		subject.requiredFeatures,
	);
	const qualificationPriority = resolveSubjectQualificationPriority(subject.code, subject.qualificationPriority ?? null);
	const rotationFamily = subject.rotationFamily ?? resolveSubjectRotationFamily(subject.code, subject.modularGroupId ?? null);
	const rotationTermMetadata = resolveRotationTermMetadata({
		subjectCode: subject.code,
		rotationFamily,
		modularGroupId: subject.modularGroupId ?? null,
		modularOrder: subject.modularOrder ?? null,
		termGroupId: subject.termGroupId ?? null,
		termCount: subject.termCount ?? null,
	});
	const isSystemManaged = subject.isSystemManaged === true;

	return {
		...subject,
		displayCode: outputLabel && outputLabel.length > 0
			? outputLabel
			: resolveSubjectOutputLabel(subject.code, subject.name, subject.modularGroupId ?? null),
		ownerDepartment,
		allowedOwnerDepartments,
		qualificationPriority,
		rotationFamily,
		rotationTermRank: rotationTermMetadata.termRank,
		rotationTermLabel: rotationTermMetadata.termLabel,
		rotationTermGroupId: rotationTermMetadata.termGroupId,
		rotationTermCount: rotationTermMetadata.termCount,
		specializationSource: (subject.allowedSpecializations ?? []).length > 0 ? 'REFERENCE_METADATA' : 'NONE',
		isSystemManaged,
	};
}

type UpstreamProgramSignals = {
	offeredPrograms: Set<ProgramType>;
	tleSpecializations: Array<{
		code: string;
		name: string;
		programCategory?: string | null;
		gradeLevels: number[];
	}>;
	provenance: {
		offeringsStatus: 'live' | 'degraded' | 'unavailable';
		sectionStatus: 'live' | 'degraded' | 'unavailable';
		mirrorStatus: 'live' | 'degraded' | 'unavailable';
		tleStatus: 'live' | 'degraded' | 'unavailable';
	};
};

type SpecialProgramTrack = { code: string; label: string; sectionCount: number };

type ActiveSpecialProgramTracks = {
	spa: SpecialProgramTrack[];
	sps: SpecialProgramTrack[];
};

function resolveEnrollProBaseUrl() {
	return process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
}

function normalizeProgramType(value: unknown): ProgramType | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().toUpperCase();
	if (normalized === 'STE' || normalized === 'SPA' || normalized === 'SPS' || normalized === 'REGULAR') {
		return normalized;
	}
	if (normalized === 'SCIENCE_TECHNOLOGY_AND_ENGINEERING' || normalized === 'SCIENCE, TECHNOLOGY & ENGINEERING') {
		return 'STE';
	}
	if (normalized === 'SPECIAL_PROGRAM_IN_THE_ARTS') {
		return 'SPA';
	}
	if (normalized === 'SPECIAL_PROGRAM_IN_SPORTS') {
		return 'SPS';
	}
	return null;
}

function normalizeCode(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function inferWorkshopType(programCategory: string | null | undefined): 'CLASSROOM' | 'LABORATORY' | 'GYMNASIUM' | 'TLE_WORKSHOP' | 'COMPUTER_LAB' | 'LIBRARY' | 'FACULTY_ROOM' | 'OFFICE' | 'OTHER' {
	const normalized = (programCategory ?? '').toUpperCase();
	if (normalized.includes('ICT')) return 'COMPUTER_LAB';
	return 'CLASSROOM';
}

async function fetchJsonWithAuth(url: string, token?: string) {
	const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
	const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) }).catch((e) => {
		throw new Error(`Upstream request failed (timeout or network error) for ${url}: ${e.message}`);
	});
	if (!response.ok) {
		throw new Error(`Upstream request failed (${response.status}) for ${url}`);
	}
	return response.json();
}

async function fetchSectionsProgramSignals(
	baseUrl: string,
	schoolId: number,
	schoolYearId: number,
	token?: string,
): Promise<Set<ProgramType>> {
	const offered = new Set<ProgramType>();
	let currentPage = 1;
	let totalPages = 1;
	const pageSize = 200;

	while (currentPage <= totalPages) {
		const url = `${baseUrl}/integration/v1/sections?schoolId=${schoolId}&schoolYearId=${schoolYearId}&page=${currentPage}&limit=${pageSize}`;
		const payload = await fetchJsonWithAuth(url, token) as { data?: Array<{ programType?: string }>; meta?: { totalPages?: number } };
		const rows = Array.isArray(payload.data) ? payload.data : [];
		for (const row of rows) {
			const programType = normalizeProgramType(row.programType);
			if (programType) offered.add(programType);
		}
		const upstreamPages = Number(payload.meta?.totalPages ?? 0);
		totalPages = Number.isFinite(upstreamPages) && upstreamPages > 0
			? upstreamPages
			: (rows.length < pageSize ? currentPage : currentPage + 1);
		currentPage += 1;
	}

	return offered;
}

async function fetchMirroredProgramSignals(schoolId: number, schoolYearId: number): Promise<Set<ProgramType>> {
	const programs = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		select: { programType: true },
		distinct: ['programType'],
	});
	const offered = new Set<ProgramType>(['REGULAR']);
	for (const row of programs) {
		const normalized = normalizeProgramType(row.programType);
		if (normalized) offered.add(normalized);
	}
	return offered;
}

async function fetchMirroredTleSignals(schoolId: number, schoolYearId: number): Promise<UpstreamProgramSignals['tleSpecializations']> {
	const rows = await prisma.sectionMirror.findMany({
		where: {
			schoolId,
			schoolYearId,
			isStale: false,
			tleSpecialization: { not: null },
		},
		select: {
			tleSpecialization: true,
			tleProgramCategory: true,
			gradeLevelId: true,
		},
	});

	const map = new Map<string, { code: string; name: string; programCategory?: string | null; gradeLevels: number[] }>();
	for (const row of rows) {
		if (!row.tleSpecialization) continue;
		const code = normalizeCode(row.tleSpecialization);
		if (!code) continue;
		const existing = map.get(code);
		if (!existing) {
			map.set(code, {
				code,
				name: row.tleSpecialization,
				programCategory: row.tleProgramCategory,
				gradeLevels: [row.gradeLevelId],
			});
			continue;
		}
		existing.gradeLevels = [...new Set([...existing.gradeLevels, row.gradeLevelId])];
		if (!existing.programCategory && row.tleProgramCategory) {
			existing.programCategory = row.tleProgramCategory;
		}
	}

	return [...map.values()];
}

function mergeTleSpecializations(
	base: UpstreamProgramSignals['tleSpecializations'],
	fallback: UpstreamProgramSignals['tleSpecializations'],
): UpstreamProgramSignals['tleSpecializations'] {
	const map = new Map<string, { code: string; name: string; programCategory?: string | null; gradeLevels: number[] }>();
	for (const item of [...base, ...fallback]) {
		const existing = map.get(item.code);
		if (!existing) {
			map.set(item.code, {
				code: item.code,
				name: item.name,
				programCategory: item.programCategory,
				gradeLevels: [...new Set(item.gradeLevels)],
			});
			continue;
		}
		existing.gradeLevels = [...new Set([...existing.gradeLevels, ...item.gradeLevels])];
		if (!existing.programCategory && item.programCategory) {
			existing.programCategory = item.programCategory;
		}
	}
	return [...map.values()];
}

async function fetchUpstreamProgramSignals(schoolId: number, schoolYearId: number, token?: string): Promise<UpstreamProgramSignals> {
	const baseUrl = resolveEnrollProBaseUrl();
	const offeredPrograms = new Set<ProgramType>(['REGULAR']);
	const tleSpecializations = new Map<string, { code: string; name: string; programCategory?: string | null; gradeLevels: number[] }>();

	// Track provenance for each source
	let offeringsStatus: 'live' | 'degraded' | 'unavailable' = 'unavailable';
	let sectionStatus: 'live' | 'degraded' | 'unavailable' = 'unavailable';
	let mirrorStatus: 'live' | 'degraded' | 'unavailable' = 'unavailable';
	let tleStatus: 'live' | 'degraded' | 'unavailable' = 'unavailable';

	try {
		const offeringUrl = `${baseUrl}/integration/v1/subject-offerings?schoolId=${schoolId}&schoolYearId=${schoolYearId}`;
		const offeringsPayload = await fetchJsonWithAuth(offeringUrl, token) as { data?: Array<{ programType?: string }> };
		const offerings = Array.isArray(offeringsPayload.data) ? offeringsPayload.data : [];
		for (const offering of offerings) {
			const programType = normalizeProgramType(offering.programType);
			if (programType) offeredPrograms.add(programType);
		}
		offeringsStatus = 'live';
	} catch {
		offeringsStatus = 'unavailable';
	}

	try {
		const sectionPrograms = await fetchSectionsProgramSignals(baseUrl, schoolId, schoolYearId, token);
		for (const programType of sectionPrograms) {
			offeredPrograms.add(programType);
		}
		sectionStatus = 'live';
	} catch {
		sectionStatus = 'unavailable';
	}

	try {
		const mirrorPrograms = await fetchMirroredProgramSignals(schoolId, schoolYearId);
		for (const programType of mirrorPrograms) {
			offeredPrograms.add(programType);
		}
		mirrorStatus = 'live';
	} catch {
		mirrorStatus = 'unavailable';
	}

	try {
		const tleUrl = `${baseUrl}/bosy/tle-programs?schoolYearId=${schoolYearId}`;
		const tlePayload = await fetchJsonWithAuth(tleUrl, token) as { data?: unknown[] };
		const tleRows = Array.isArray(tlePayload.data) ? tlePayload.data : [];
		for (const row of tleRows) {
			if (!row || typeof row !== 'object') continue;
			const record = row as Record<string, unknown>;
			const code = normalizeCode(record.code ?? record.specializationCode ?? record.programCode ?? record.name);
			if (!code) continue;
			const name = typeof record.name === 'string' && record.name.trim().length > 0
				? record.name.trim()
				: code.replace(/_/g, ' ');
			const category = typeof record.programCategory === 'string' ? record.programCategory : null;
			const gradeLevels = Array.isArray(record.gradeLevels)
				? record.gradeLevels.filter((value): value is number => Number.isFinite(value)).map(Number)
				: [9, 10];
			const existing = tleSpecializations.get(code);
			if (!existing) {
				tleSpecializations.set(code, { code, name, programCategory: category, gradeLevels: [...new Set(gradeLevels)] });
				continue;
			}
			existing.gradeLevels = [...new Set([...existing.gradeLevels, ...gradeLevels])];
			if (!existing.programCategory && category) existing.programCategory = category;
		}
		tleStatus = 'live';
	} catch {
		tleStatus = 'unavailable';
	}

	const mirroredTleSpecializations = await fetchMirroredTleSignals(schoolId, schoolYearId);

	return {
		offeredPrograms,
		tleSpecializations: mergeTleSpecializations([...tleSpecializations.values()], mirroredTleSpecializations),
		provenance: {
			offeringsStatus,
			sectionStatus,
			mirrorStatus,
			tleStatus,
		},
	};
}

function buildSubjectContractData(subject: {
	code: string;
	name: string;
	modularGroupId?: string | null;
	ownerDepartment?: string | null;
	qualificationPriority?: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
	rotationFamily?: string | null;
	outputLabel?: string | null;
	isSystemManaged?: boolean;
	allowedOwnerDepartments?: string[];
	requiredFeatures?: string[];
}) {
	const defaults = resolveSubjectContractDefaults({
		subjectCode: subject.code,
		subjectName: subject.name,
		modularGroupId: subject.modularGroupId ?? null,
	});

	return {
		ownerDepartment: subject.ownerDepartment ?? defaults.ownerDepartment,
		qualificationPriority: subject.qualificationPriority ?? defaults.qualificationPriority,
		rotationFamily: subject.rotationFamily ?? defaults.rotationFamily,
		outputLabel: subject.outputLabel?.trim() || defaults.outputLabel,
		isSystemManaged: subject.isSystemManaged ?? defaults.isSystemManaged,
		requiredFeatures: mergeRequiredFeaturesWithAdditionalOwnerDepartments(
			subject.requiredFeatures,
			subject.allowedOwnerDepartments,
		),
	};
}

// (Prompt 01A: the runtime DDL cache is retired with the DDL itself — see
// migration 0042.)

/**
 * Prompt 01A: pre-mutation guard — cross-school denial + optimistic concurrency.
 *
 * - The subject must belong to the actor's authenticated school (403 otherwise).
 * - When `expectedUpdatedAt` is supplied, it must match the row's current
 *   `updatedAt` (409 STALE_WRITE otherwise). Passing the guard is optional for
 *   callers that have not yet adopted versioned writes, but the router always
 *   forwards the value when the client provides one.
 */
export async function assertSchoolScopeAndVersion(
	subjectId: number,
	actorSchoolId: number,
	expectedUpdatedAt?: string | null,
): Promise<{ ok: true; subject: { id: number; schoolId: number; updatedAt: Date } } | { ok: false; error: { status: number; code: string; message: string } }> {
	if (!Number.isInteger(subjectId) || subjectId <= 0) {
		return { ok: false, error: { status: 400, code: 'INVALID_PARAM', message: 'subjectId must be a positive integer.' } };
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0) {
		return { ok: false, error: { status: 403, code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' } };
	}
	const subject = await prisma.subject.findUnique({
		where: { id: subjectId },
		select: { id: true, schoolId: true, updatedAt: true },
	});
	if (!subject) {
		return { ok: false, error: { status: 404, code: 'NOT_FOUND', message: 'Subject not found.' } };
	}
	if (subject.schoolId !== actorSchoolId) {
		return { ok: false, error: { status: 403, code: 'CROSS_SCHOOL_DENIED', message: 'Subject belongs to another school.' } };
	}
	if (expectedUpdatedAt != null) {
		const expected = new Date(expectedUpdatedAt).getTime();
		if (Number.isFinite(expected) && subject.updatedAt.getTime() !== expected) {
			return { ok: false, error: { status: 409, code: 'STALE_WRITE', message: 'Subject was modified by another user. Refresh and retry.' } };
		}
	}
	return { ok: true, subject };
}

/**
 * Prompt 01B-R: validated PATCH allowlist.
 *
 * Only operator-editable catalog fields may appear in a PATCH request.
 * Protected/immutable fields (id, schoolId, code, createdAt, updatedAt,
 * isActive, relations) are rejected explicitly rather than silently ignored.
 */
const VALID_PATCH_FIELDS = new Set([
	'name',
	'minMinutesPerWeek',
	'preferredRoomType',
	'gradeLevels',
	'isSeedable',
	'interSectionEnabled',
	'interSectionGradeLevels',
	'programScopes',
	'allowedSpecializations',
	'requiredFeatures',
	'ownerDepartment',
	'qualificationPriority',
	'rotationFamily',
	'outputLabel',
	'isSystemManaged',
	'modularGroupId',
	'modularOrder',
	'termGroupId',
	'termCount',
]);

const PROTECTED_PATCH_FIELDS = new Set([
	'id',
	'schoolId',
	'code',
	'createdAt',
	'updatedAt',
	'isActive',
	'school',
	'facultySubjects',
	'templateBindings',
]);

export function validateAndFilterPatchFields(
	raw: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: { status: number; code: string; message: string } } {
	const data: Record<string, unknown> = {};
	const unknownFields: string[] = [];
	const protectedFields: string[] = [];

	for (const key of Object.keys(raw)) {
		if (PROTECTED_PATCH_FIELDS.has(key)) {
			protectedFields.push(key);
			continue;
		}
		if (!VALID_PATCH_FIELDS.has(key)) {
			unknownFields.push(key);
			continue;
		}
		data[key] = raw[key];
	}

	if (protectedFields.length > 0) {
		return {
			ok: false,
			error: {
				status: 400,
				code: 'PROTECTED_FIELD',
				message: `Cannot modify protected fields: ${protectedFields.join(', ')}.`,
			},
		};
	}
	if (unknownFields.length > 0) {
		return {
			ok: false,
			error: {
				status: 400,
				code: 'UNKNOWN_FIELD',
				message: `Unknown fields not allowed: ${unknownFields.join(', ')}.`,
			},
		};
	}

	// Validate values when present
	if (data.minMinutesPerWeek !== undefined) {
		const val = Number(data.minMinutesPerWeek);
		if (!Number.isFinite(val) || val <= 0) {
			return { ok: false, error: { status: 400, code: 'INVALID_MIN_MINUTES_PER_WEEK', message: 'minMinutesPerWeek must be a positive number.' } };
		}
	}
	if (data.gradeLevels !== undefined) {
		if (!Array.isArray(data.gradeLevels) || data.gradeLevels.length === 0) {
			return { ok: false, error: { status: 400, code: 'INVALID_GRADE_LEVELS', message: 'gradeLevels must contain at least one grade level.' } };
		}
		const invalid = data.gradeLevels.filter((g: unknown) => ![7, 8, 9, 10].includes(Number(g)));
		if (invalid.length > 0) {
			return { ok: false, error: { status: 400, code: 'INVALID_GRADE_LEVELS', message: `gradeLevels contains invalid grades: ${invalid.join(', ')} (allowed: 7, 8, 9, 10).` } };
		}
	}
	if (data.preferredRoomType !== undefined) {
		if (typeof data.preferredRoomType !== 'string' || data.preferredRoomType.trim() === '') {
			return { ok: false, error: { status: 400, code: 'INVALID_ROOM_TYPE', message: 'preferredRoomType must be a non-empty string.' } };
		}
	}

	return { ok: true, data };
}

/**
 * Prompt 01B: MANDATORY atomic versioned mutation.
 *
 * The version predicate (id + schoolId + expectedUpdatedAt) is part of the
 * UPDATE's WHERE clause inside one transaction — no read-then-write window.
 * Zero rows affected => distinguish not-found / cross-school / stale without
 * authorizing any write.
 *
 * Prompt 01B-R: changes are now validated through an explicit allowlist
 * before reaching Prisma. Protected fields are rejected; unknown fields
 * are rejected; values are validated.
 */
export async function updateSubjectAtomic(input: {
	id: number;
	actorSchoolId: number;
	expectedUpdatedAt: string;
	changes: Record<string, unknown>;
}): Promise<
	| { ok: true; subject: Awaited<ReturnType<typeof prisma.subject.findUniqueOrThrow>> }
	| { ok: false; error: { status: number; code: string; message: string } }
> {
	const { id, actorSchoolId, expectedUpdatedAt, changes } = input;

	// strict validation BEFORE any read
	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: { status: 400, code: 'INVALID_PARAM', message: 'id must be a positive integer.' } };
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0) {
		return { ok: false, error: { status: 403, code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' } };
	}
	if (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt.trim() === '') {
		return { ok: false, error: { status: 400, code: 'VERSION_REQUIRED', message: 'expectedUpdatedAt is required for every subject mutation.' } };
	}
	const expectedMs = new Date(expectedUpdatedAt).getTime();
	if (!Number.isFinite(expectedMs)) {
		return { ok: false, error: { status: 400, code: 'INVALID_VERSION', message: 'expectedUpdatedAt must be a valid ISO-8601 timestamp.' } };
	}

	// Prompt 01B-R: validate and filter the changes through the allowlist
	const validated = validateAndFilterPatchFields(changes);
	if (!validated.ok) {
		return validated;
	}
	const safeChanges = validated.data;

	if (Object.keys(safeChanges).length === 0) {
		return { ok: false, error: { status: 400, code: 'NO_CHANGES', message: 'No valid fields provided for update.' } };
	}

	// snapshot for outcome classification when the conditional update matches zero rows
	const existing = await prisma.subject.findUnique({ where: { id }, select: { id: true, schoolId: true, updatedAt: true } });

	try {
		const updated = await prisma.$transaction(async (tx) => {
			const result = await tx.subject.updateMany({
				where: {
					id,
					schoolId: actorSchoolId,
					updatedAt: new Date(expectedMs),
				},
				data: safeChanges,
			});
			if (result.count === 0) {
				return null;
			}
			return tx.subject.findUniqueOrThrow({ where: { id } });
		}, { isolationLevel: 'Serializable' });

		if (updated != null) {
			return { ok: true, subject: updated };
		}

		// zero rows: classify without authorizing a write
		if (!existing) {
			return { ok: false, error: { status: 404, code: 'NOT_FOUND', message: 'Subject not found.' } };
		}
		if (existing.schoolId !== actorSchoolId) {
			return { ok: false, error: { status: 403, code: 'CROSS_SCHOOL_DENIED', message: 'Subject belongs to another school.' } };
		}
		return { ok: false, error: { status: 409, code: 'STALE_WRITE', message: 'Subject was modified by another user. Refresh and retry.' } };
	} catch (error) {
		// serialization failures surface as stale writes for retry semantics
		const code = (error as { code?: string }).code;
		if (code === 'P2034') {
			return { ok: false, error: { status: 409, code: 'STALE_WRITE', message: 'Concurrent modification detected. Refresh and retry.' } };
		}
		throw error;
	}
}

/**
 * Prompt 01B: atomic state-transition (archive/reactivate) with no-op conflict.
 * Asserts the expected current isActive so a repeated archive can never
 * advance updatedAt or report false success.
 */
export async function transitionSubjectActiveStateAtomic(input: {
	id: number;
	actorSchoolId: number;
	expectedUpdatedAt: string;
	targetActive: boolean;
}): Promise<
	| { ok: true; subject: Awaited<ReturnType<typeof prisma.subject.findUniqueOrThrow>> }
	| { ok: false; error: { status: number; code: string; message: string } }
> {
	const { id, actorSchoolId, expectedUpdatedAt, targetActive } = input;

	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: { status: 400, code: 'INVALID_PARAM', message: 'id must be a positive integer.' } };
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0) {
		return { ok: false, error: { status: 403, code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' } };
	}
	if (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt.trim() === '') {
		return { ok: false, error: { status: 400, code: 'VERSION_REQUIRED', message: 'expectedUpdatedAt is required for every subject mutation.' } };
	}
	const expectedMs = new Date(expectedUpdatedAt).getTime();
	if (!Number.isFinite(expectedMs)) {
		return { ok: false, error: { status: 400, code: 'INVALID_VERSION', message: 'expectedUpdatedAt must be a valid ISO-8601 timestamp.' } };
	}

	const existing = await prisma.subject.findUnique({ where: { id }, select: { id: true, schoolId: true, isActive: true, updatedAt: true } });

	// pre-classify the expected-state no-op conflict BEFORE the transaction so
	// a repeated archive cannot bump updatedAt
	if (existing && existing.schoolId === actorSchoolId && existing.isActive === targetActive) {
		return {
			ok: false,
			error: {
				status: 409,
				code: targetActive ? 'ALREADY_ACTIVE' : 'ALREADY_ARCHIVED',
				message: targetActive ? 'Subject is already active.' : 'Subject is already archived.',
			},
		};
	}

	try {
		const updated = await prisma.$transaction(async (tx) => {
			const result = await tx.subject.updateMany({
				where: {
					id,
					schoolId: actorSchoolId,
					updatedAt: new Date(expectedMs),
					isActive: !targetActive, // must currently be in the opposite state
				},
				data: { isActive: targetActive },
			});
			if (result.count === 0) return null;
			return tx.subject.findUniqueOrThrow({ where: { id } });
		}, { isolationLevel: 'Serializable' });

		if (updated != null) {
			return { ok: true, subject: updated };
		}

		if (!existing) {
			return { ok: false, error: { status: 404, code: 'NOT_FOUND', message: 'Subject not found.' } };
		}
		if (existing.schoolId !== actorSchoolId) {
			return { ok: false, error: { status: 403, code: 'CROSS_SCHOOL_DENIED', message: 'Subject belongs to another school.' } };
		}
		return { ok: false, error: { status: 409, code: 'STALE_WRITE', message: 'Subject was modified by another user. Refresh and retry.' } };
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code === 'P2034') {
			return { ok: false, error: { status: 409, code: 'STALE_WRITE', message: 'Concurrent modification detected. Refresh and retry.' } };
		}
		throw error;
	}
}

// Prompt 01A: runtime schema DDL/backfill REMOVED. The subject-contract schema
// columns and backfills now live exclusively in tracked migration
// `0042_subject_contract_schema_ddl` (applied via `prisma migrate deploy`).
// Read/CRUD/generation paths must never execute DDL — this stub preserves the
// internal call sites while performing zero work.
async function ensureSubjectContractSchemaColumns(): Promise<void> {
	return;
}

export async function ensureDefaultSubjects(schoolId: number): Promise<void> {
	await ensureSubjectContractSchemaColumns();

	// Prompt 01B: bootstrap seeding is STRICTLY create-missing-only. The
	// deprecated-subject `updateMany` deactivation is REMOVED from this passive
	// path — deprecating a subject is an operator decision that belongs in the
	// explicit preview/apply workflow, not something every read/generation
	// re-enforces.

	// Prompt 01A (Subjects CRUD source authority): bootstrap defaults are
	// CREATE-MISSING-ONLY. The previous upsert `update` branch rewrote
	// operator-managed grade levels, minutes, room types, program scopes, and
	// active state on every generation/sync/read — that is what restored
	// grade 10 to STE_RESEARCH after the operator removed it (run 641
	// timestamp proof: run created 12:01:30.144Z, subject updatedAt
	// 12:01:30.216Z). Existing rows are operator-owned; a default definition
	// may never overwrite them. Repair of a drifted row is an explicit,
	// previewed, operator-authorized action.
	await prisma.$transaction(
		MATATAG_DEFAULTS.map((subject) => {
			const contract = buildSubjectContractData(subject);
			return prisma.subject.upsert({
				where: {
					schoolId_code: {
						schoolId,
						code: subject.code,
					},
				},
				update: {}, // never overwrite operator-managed catalog rows
				create: {
					schoolId,
					code: subject.code,
					name: subject.name,
					minMinutesPerWeek: subject.minMinutesPerWeek,
					preferredRoomType: subject.preferredRoomType,
					modularGroupId: subject.modularGroupId ?? null,
					modularOrder: subject.modularOrder ?? null,
					termGroupId: subject.termGroupId ?? subject.modularGroupId ?? null,
					termCount: subject.termCount ?? 3,
					gradeLevels: subject.gradeLevels,
					interSectionEnabled: subject.interSectionEnabled ?? false,
					interSectionGradeLevels: subject.interSectionGradeLevels ?? [],
					programScopes: subject.programScopes,
					allowedSpecializations: subject.allowedSpecializations ?? [],
					requiredFeatures: contract.requiredFeatures,
					isSeedable: subject.isSeedable,
					isActive: subject.isActive ?? true,
					ownerDepartment: contract.ownerDepartment,
					qualificationPriority: contract.qualificationPriority,
					rotationFamily: contract.rotationFamily,
					outputLabel: contract.outputLabel,
					isSystemManaged: contract.isSystemManaged,
				},
			});
		}),
	);
}

async function fetchActiveSpecialProgramTracks(schoolId: number, schoolYearId: number): Promise<ActiveSpecialProgramTracks> {
	const specialSections = await prisma.sectionMirror.findMany({
		where: {
			schoolId,
			schoolYearId,
			isStale: false,
			programType: { in: ['SPA', 'SPS'] },
		},
		select: { externalId: true, programType: true },
	});

	if (specialSections.length === 0) {
		return { spa: [], sps: [] };
	}

	const sectionProgramById = new Map<number, 'SPA' | 'SPS'>();
	for (const section of specialSections) {
		if (section.programType === 'SPA' || section.programType === 'SPS') {
			sectionProgramById.set(section.externalId, section.programType);
		}
	}

	const specialSubjects = await prisma.subject.findMany({
		where: {
			schoolId,
			OR: [
				{ code: 'SPA_SPEC' },
				{ code: 'SPS_SPEC' },
			],
		},
		select: { id: true, code: true },
	});

	if (specialSubjects.length === 0) {
		return { spa: [], sps: [] };
	}

	const subjectProgramById = new Map<number, 'SPA' | 'SPS'>(
		specialSubjects
			.map((subject) => {
				if (subject.code.startsWith('SPA')) return [subject.id, 'SPA'] as const;
				if (subject.code.startsWith('SPS')) return [subject.id, 'SPS'] as const;
				return null;
			})
			.filter((entry): entry is readonly [number, 'SPA' | 'SPS'] => entry != null),
	);

	const ownershipRows = await prisma.subjectSectionOwnership.findMany({
		where: {
			schoolId,
			subjectId: { in: specialSubjects.map((subject) => subject.id) },
			sectionId: { in: [...sectionProgramById.keys()] },
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
	});

	const trackBuckets = {
		SPA: new Map<string, { code: string; label: string; sectionIds: Set<number> }>(),
		SPS: new Map<string, { code: string; label: string; sectionIds: Set<number> }>(),
	};

	for (const row of ownershipRows) {
		const inferredProgram = sectionProgramById.get(row.sectionId) ?? subjectProgramById.get(row.subjectId);
		if (!inferredProgram) continue;

		const normalizedCode = normalizeCode(row.specializationCode ?? row.specializationLabel);
		if (!normalizedCode) continue;

		const label = typeof row.specializationLabel === 'string' && row.specializationLabel.trim().length > 0
			? row.specializationLabel.trim()
			: normalizedCode.replace(/_/g, ' ');

		const bucket = trackBuckets[inferredProgram];
		const existing = bucket.get(normalizedCode);
		if (!existing) {
			bucket.set(normalizedCode, {
				code: normalizedCode,
				label,
				sectionIds: new Set([row.sectionId]),
			});
			continue;
		}

		existing.sectionIds.add(row.sectionId);
		if (existing.label.length === 0 && label.length > 0) {
			existing.label = label;
		}
	}

	const toTracks = (bucket: Map<string, { code: string; label: string; sectionIds: Set<number> }>): SpecialProgramTrack[] => (
		[...bucket.values()]
			.map((value) => ({
				code: value.code,
				label: value.label,
				sectionCount: value.sectionIds.size,
			}))
			.sort((left, right) => left.label.localeCompare(right.label) || left.code.localeCompare(right.code))
	);

	return {
		spa: toTracks(trackBuckets.SPA),
		sps: toTracks(trackBuckets.SPS),
	};
}

async function materializeDynamicTleSubjects(schoolId: number, specializations: UpstreamProgramSignals['tleSpecializations']) {
	if (specializations.length === 0) {
		await prisma.subject.updateMany({
			where: {
				schoolId,
				code: { startsWith: DYNAMIC_TLE_PREFIX },
			},
			data: { isActive: false },
		});
		return;
	}

	const dynamicCodes = new Set<string>();

	for (const specialization of specializations) {
		const code = `${DYNAMIC_TLE_PREFIX}${specialization.code}`.slice(0, 64);
		dynamicCodes.add(code);
		const contract = buildSubjectContractData({
			code,
			name: `TLE Specialization - ${specialization.name}`,
			modularGroupId: 'TLE_EXPLORATORY',
			ownerDepartment: 'TLE',
			qualificationPriority: 'DEPARTMENT_FIRST',
			rotationFamily: 'TLE_ROTATION',
			outputLabel: 'TLE',
			isSystemManaged: true,
		});
		await prisma.subject.upsert({
			where: { schoolId_code: { schoolId, code } },
			update: {
				name: `TLE Specialization - ${specialization.name}`,
				gradeLevels: specialization.gradeLevels,
				programScopes: ['REGULAR'],
				interSectionEnabled: true,
				interSectionGradeLevels: specialization.gradeLevels,
				allowedSpecializations: [specialization.code],
				preferredRoomType: inferWorkshopType(specialization.programCategory),
				minMinutesPerWeek: 225,
				isSeedable: false,
				isActive: true,
				ownerDepartment: contract.ownerDepartment,
				qualificationPriority: contract.qualificationPriority,
				rotationFamily: contract.rotationFamily,
				outputLabel: contract.outputLabel,
				isSystemManaged: contract.isSystemManaged,
			},
			create: {
				schoolId,
				code,
				name: `TLE Specialization - ${specialization.name}`,
				gradeLevels: specialization.gradeLevels,
				programScopes: ['REGULAR'],
				interSectionEnabled: true,
				interSectionGradeLevels: specialization.gradeLevels,
				allowedSpecializations: [specialization.code],
				preferredRoomType: inferWorkshopType(specialization.programCategory),
				minMinutesPerWeek: 225,
				isSeedable: false,
				isActive: true,
				ownerDepartment: contract.ownerDepartment,
				qualificationPriority: contract.qualificationPriority,
				rotationFamily: contract.rotationFamily,
				outputLabel: contract.outputLabel,
				isSystemManaged: contract.isSystemManaged,
			},
		});
	}

	await prisma.subject.updateMany({
		where: {
			schoolId,
			code: { startsWith: DYNAMIC_TLE_PREFIX, notIn: [...dynamicCodes] },
		},
		data: { isActive: false },
	});
}

export async function reconcileSubjectContractFromUpstream(schoolId: number, schoolYearId: number, authToken?: string): Promise<void> {
	await ensureDefaultSubjects(schoolId);

	const signals = await fetchUpstreamProgramSignals(schoolId, schoolYearId, authToken);
	const offeredPrograms = signals.offeredPrograms;

	for (const [programType, overlayCodes] of Object.entries(PROGRAM_OVERLAY_CODES) as Array<[ProgramType, string[]]>) {
		if (programType === 'REGULAR' || programType === 'OTHER') continue;
		if (!offeredPrograms.has(programType)) {
			await prisma.subject.updateMany({
				where: { schoolId, code: { in: overlayCodes }, isSystemManaged: true },
				data: { isActive: false },
			});
		}
	}

	const spaOffered = offeredPrograms.has('SPA');
	const spsOffered = offeredPrograms.has('SPS');
	if (!spaOffered && !spsOffered) {
		await prisma.subject.updateMany({
			where: { schoolId, code: 'DEVL_READING', isSystemManaged: true },
			data: { isActive: false },
		});
	}

	await materializeDynamicTleSubjects(schoolId, signals.tleSpecializations);
}

export async function syncSubjectContractFromProgramOfferings(schoolId: number, schoolYearId: number, authToken?: string) {
	await ensureSubjectContractSchemaColumns();
	await reconcileSubjectContractFromUpstream(schoolId, schoolYearId, authToken);

	const activeSubjects = await prisma.subject.findMany({
		where: { schoolId, isActive: true },
		select: { code: true, name: true, programScopes: true },
		orderBy: { code: 'asc' },
	});

	const signals = await fetchUpstreamProgramSignals(schoolId, schoolYearId, authToken);
	const mirrorPrograms = await fetchMirroredProgramSignals(schoolId, schoolYearId);
	const activeSpecialProgramTracks = await fetchActiveSpecialProgramTracks(schoolId, schoolYearId);

	const offeredPrograms = [...signals.offeredPrograms].sort();
	const mirroredPrograms = [...mirrorPrograms].sort();

	const steCodes = new Set(PROGRAM_OVERLAY_CODES.STE);
	const spaCodes = new Set(PROGRAM_OVERLAY_CODES.SPA);
	const spsCodes = new Set(PROGRAM_OVERLAY_CODES.SPS);

	const activeSteSubjects = activeSubjects.filter((subject) => steCodes.has(subject.code));
	const activeSpaSubjects = activeSubjects.filter((subject) => spaCodes.has(subject.code));
	const activeSpsSubjects = activeSubjects.filter((subject) => spsCodes.has(subject.code));
	const activeTleSubjects = activeSubjects.filter((subject) => subject.code.startsWith('TLE_') || subject.code.startsWith(DYNAMIC_TLE_PREFIX) || subject.code === 'TLE');

	return {
		schoolId,
		schoolYearId,
		offeredPrograms,
		mirroredPrograms,
		activeCounts: {
			total: activeSubjects.length,
			ste: activeSteSubjects.length,
			spa: activeSpaSubjects.length,
			sps: activeSpsSubjects.length,
			tle: activeTleSubjects.length,
		},
		activeSubjectCodes: {
			ste: activeSteSubjects.map((subject) => subject.code),
			spa: activeSpaSubjects.map((subject) => subject.code),
			sps: activeSpsSubjects.map((subject) => subject.code),
			tle: activeTleSubjects.map((subject) => subject.code),
		},
		activeSpecialProgramTracks,
	};
}

type SubjectScopeFilter = {
	includeSte?: boolean;
	includeSpa?: boolean;
};

export async function getSubjectsBySchool(schoolId: number, filters?: SubjectScopeFilter) {
	await ensureSubjectContractSchemaColumns();
	const subjects = await prisma.subject.findMany({
		where: { schoolId },
		orderBy: [{ isSeedable: 'desc' }, { name: 'asc' }],
	});

	const includeSte = filters?.includeSte ?? true;
	const includeSpa = filters?.includeSpa ?? true;

	// Use stored programScopes; fall back to heuristic inference for legacy rows with empty scopes
	return subjects
		.map((subject) => withSubjectViewMetadata({
			...subject,
			programScopes: subject.programScopes.length > 0
				? subject.programScopes
				: inferSubjectProgramScopes(subject.code, subject.name),
		}))
		.filter((subject) => {
			if (!includeSte && subject.programScopes.includes('STE')) return false;
			if (!includeSpa && subject.programScopes.includes('SPA')) return false;
			return true;
		});
}

export async function getSubjectById(id: number) {
	await ensureSubjectContractSchemaColumns();
	const subject = await prisma.subject.findUnique({ where: { id } });
	if (!subject) return null;
	return withSubjectViewMetadata({
		...subject,
		programScopes: subject.programScopes.length > 0
			? subject.programScopes
			: inferSubjectProgramScopes(subject.code, subject.name),
	});
}

export async function createSubject(
	schoolId: number,
	data: {
		code: string;
		name: string;
		minMinutesPerWeek: number;
		preferredRoomType: string;
		gradeLevels: number[];
		interSectionEnabled?: boolean;
		interSectionGradeLevels?: number[];
		isSeedable?: boolean;
		modularGroupId?: string | null;
		modularOrder?: number | null;
		termGroupId?: string | null;
		termCount?: number;
		programScopes?: ProgramType[];
		allowedSpecializations?: string[];
		requiredFeatures?: string[];
		allowedOwnerDepartments?: string[];
		isActive?: boolean;
		ownerDepartment?: string | null;
		qualificationPriority?: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
		rotationFamily?: string | null;
		outputLabel?: string | null;
		isSystemManaged?: boolean;
	},
) {
	await ensureSubjectContractSchemaColumns();

	// Prompt 01A: server-side input validation. The API previously accepted
	// negative weekly minutes and empty grade scope with 201 — invalid catalog
	// rows that later broke demand math.
	if (typeof data.minMinutesPerWeek !== 'number' || !Number.isFinite(data.minMinutesPerWeek) || data.minMinutesPerWeek <= 0) {
		throw Object.assign(
			new Error('minMinutesPerWeek must be a positive number.'),
			{ statusCode: 400, code: 'INVALID_MIN_MINUTES_PER_WEEK' },
		);
	}
	if (!Array.isArray(data.gradeLevels) || data.gradeLevels.length === 0) {
		throw Object.assign(
			new Error('gradeLevels must contain at least one grade level.'),
			{ statusCode: 400, code: 'INVALID_GRADE_LEVELS' },
		);
	}
	const invalidGrades = data.gradeLevels.filter((g) => ![7, 8, 9, 10].includes(g));
	if (invalidGrades.length > 0) {
		throw Object.assign(
			new Error(`gradeLevels contains invalid grades: ${invalidGrades.join(', ')} (allowed: 7, 8, 9, 10).`),
			{ statusCode: 400, code: 'INVALID_GRADE_LEVELS' },
		);
	}
	if (data.preferredRoomType == null || String(data.preferredRoomType).trim() === '') {
		throw Object.assign(
			new Error('preferredRoomType is required.'),
			{ statusCode: 400, code: 'INVALID_ROOM_TYPE' },
		);
	}

	// Validate inter-section grade levels are within subject's grade levels
	const interGrades = data.interSectionGradeLevels ?? [];
	if (interGrades.length > 0) {
		const invalid = interGrades.filter((g) => !data.gradeLevels.includes(g));
		if (invalid.length > 0) {
			throw Object.assign(
				new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`),
				{ statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' },
			);
		}
	}

	const contract = buildSubjectContractData({
		code: data.code,
		name: data.name,
		modularGroupId: data.modularGroupId ?? null,
		ownerDepartment: data.ownerDepartment,
		qualificationPriority: data.qualificationPriority,
		rotationFamily: data.rotationFamily,
		outputLabel: data.outputLabel,
		isSystemManaged: data.isSystemManaged,
		requiredFeatures: data.requiredFeatures,
		allowedOwnerDepartments: data.allowedOwnerDepartments,
	});

	return prisma.subject.create({
		data: {
			schoolId,
			code: data.code,
			name: data.name,
			minMinutesPerWeek: data.minMinutesPerWeek,
			preferredRoomType: data.preferredRoomType as any,
			gradeLevels: data.gradeLevels,
			isActive: data.isActive ?? true,
			isSeedable: data.isSeedable ?? false,
			interSectionEnabled: data.interSectionEnabled ?? false,
			interSectionGradeLevels: interGrades,
			modularGroupId: data.modularGroupId ?? null,
			modularOrder: data.modularOrder ?? null,
			termGroupId: data.termGroupId ?? null,
			termCount: data.termCount ?? 3,
			programScopes: data.programScopes ?? ['REGULAR'],
			allowedSpecializations: data.allowedSpecializations ?? [],
			requiredFeatures: contract.requiredFeatures,
			ownerDepartment: contract.ownerDepartment,
			qualificationPriority: contract.qualificationPriority,
			rotationFamily: contract.rotationFamily,
			outputLabel: contract.outputLabel,
			isSystemManaged: contract.isSystemManaged,
		},
	});
}

export async function updateSubject(
	id: number,
	data: Partial<{
		name: string;
		minMinutesPerWeek: number;
		preferredRoomType: string;
		gradeLevels: number[];
		isActive: boolean;
		interSectionEnabled: boolean;
		interSectionGradeLevels: number[];
		isSeedable: boolean;
		modularGroupId: string | null;
		modularOrder: number | null;
		termGroupId: string | null;
		termCount: number;
		programScopes: ProgramType[];
		allowedSpecializations: string[];
		requiredFeatures: string[];
		allowedOwnerDepartments: string[];
		ownerDepartment: string | null;
		qualificationPriority: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
		rotationFamily: string | null;
		outputLabel: string | null;
		isSystemManaged: boolean;
	}>,
) {
	await ensureSubjectContractSchemaColumns();
	const subject = await prisma.subject.findUnique({ where: { id } });
	if (!subject) return null;

	// Validate inter-section grade levels if provided
	const newGradeLevels = data.gradeLevels ?? subject.gradeLevels;
	if (data.interSectionGradeLevels !== undefined && data.interSectionGradeLevels.length > 0) {
		const invalid = data.interSectionGradeLevels.filter((g) => !newGradeLevels.includes(g));
		if (invalid.length > 0) {
			throw Object.assign(
				new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`),
				{ statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' },
			);
		}
	}

	// Prompt 01A: `isSeedable` is bootstrap/seed metadata ONLY — it must not gate
	// which operator edits are accepted. The old branch silently dropped
	// `preferredRoomType` and `isActive` for seedable subjects while returning
	// 200, making valid edits vanish. All operator-editable catalog fields use
	// ONE allowlist; seedable and non-seedable subjects are edited identically.
	const updateData: Record<string, unknown> = {};
	const resolvedRequiredFeatures = mergeRequiredFeaturesWithAdditionalOwnerDepartments(
		data.requiredFeatures ?? subject.requiredFeatures,
		data.allowedOwnerDepartments,
	);
	if (data.name !== undefined) updateData.name = data.name;
	if (data.minMinutesPerWeek !== undefined) updateData.minMinutesPerWeek = data.minMinutesPerWeek;
	if (data.preferredRoomType !== undefined) updateData.preferredRoomType = data.preferredRoomType;
	if (data.gradeLevels !== undefined) updateData.gradeLevels = data.gradeLevels;
	if (data.isActive !== undefined) updateData.isActive = data.isActive;
	if (data.isSeedable !== undefined) updateData.isSeedable = data.isSeedable;
	if (data.interSectionEnabled !== undefined) updateData.interSectionEnabled = data.interSectionEnabled;
	if (data.interSectionGradeLevels !== undefined) updateData.interSectionGradeLevels = data.interSectionGradeLevels;
	if (data.modularGroupId !== undefined) updateData.modularGroupId = data.modularGroupId;
	if (data.modularOrder !== undefined) updateData.modularOrder = data.modularOrder;
	if (data.termGroupId !== undefined) updateData.termGroupId = data.termGroupId;
	if (data.termCount !== undefined) updateData.termCount = data.termCount;
	if (data.programScopes !== undefined) updateData.programScopes = data.programScopes;
	if (data.allowedSpecializations !== undefined) updateData.allowedSpecializations = data.allowedSpecializations;
	if (data.requiredFeatures !== undefined || data.allowedOwnerDepartments !== undefined) {
		updateData.requiredFeatures = resolvedRequiredFeatures;
	}
	if (data.ownerDepartment !== undefined) updateData.ownerDepartment = data.ownerDepartment;
	if (data.qualificationPriority !== undefined) updateData.qualificationPriority = data.qualificationPriority;
	if (data.rotationFamily !== undefined) updateData.rotationFamily = data.rotationFamily;
	if (data.outputLabel !== undefined) updateData.outputLabel = data.outputLabel;
	if (data.isSystemManaged !== undefined) updateData.isSystemManaged = data.isSystemManaged;

	return prisma.subject.update({ where: { id }, data: updateData });
}

type DeleteSubjectResult =
	| {
		success: true;
		deletedSubjectId: number;
		cleanedHistoricalAssignments: number;
	  }
	| {
		success: false;
		code: 'NOT_FOUND' | 'ACTIVE_ASSIGNMENTS' | 'HISTORICAL_ASSIGNMENTS';
		error: string;
		details?: Record<string, unknown>;
	  };

export async function deleteSubject(
	id: number,
	options?: { cleanupHistorical?: boolean; cleanupActive?: boolean; cleanupAll?: boolean },
): Promise<DeleteSubjectResult> {
	await ensureSubjectContractSchemaColumns();
	const cleanupAll = options?.cleanupAll === true;
	const cleanupActive = cleanupAll || options?.cleanupActive === true;
	const cleanupHistorical = cleanupAll || options?.cleanupHistorical === true;
	const subject = await prisma.subject.findUnique({
		where: { id },
		select: { id: true, code: true, name: true, isSeedable: true, isActive: true },
	});
	if (!subject) {
		return { success: false, code: 'NOT_FOUND', error: 'Subject not found.' };
	}
	const assignments = await prisma.facultySubject.findMany({
		where: { subjectId: id },
		select: {
			id: true,
			facultyId: true,
			sectionIds: true,
			faculty: {
				select: {
					isActiveForScheduling: true,
					isStale: true,
				},
			},
			sectionOwnerships: { select: { id: true }, take: 1 },
		},
	});

	const activeAssignments = assignments.filter((assignment) => {
		const ownershipRows = (assignment as { sectionOwnerships?: Array<{ id: number }> }).sectionOwnerships;
		const hasOwnedSections = assignment.sectionIds.length > 0 || Boolean(ownershipRows && ownershipRows.length > 0);
		return assignment.faculty.isActiveForScheduling && !assignment.faculty.isStale && hasOwnedSections;
	});
	const historicalAssignments = assignments.filter((assignment) => !activeAssignments.includes(assignment));

	if (activeAssignments.length > 0) {
		const requiresArchiveFirst = cleanupActive && subject.isActive;
		return {
			success: false,
			code: 'ACTIVE_ASSIGNMENTS',
			error: requiresArchiveFirst
				? 'Archive the subject before running destructive active-assignment cleanup.'
				: 'This subject is still assigned in active teaching loads. Remove active assignments first.',
			details: {
				subjectId: subject.id,
				subjectCode: subject.code,
				subjectName: subject.name,
				activeAssignmentCount: activeAssignments.length,
				historicalAssignmentCount: historicalAssignments.length,
				action: 'REMOVE_ACTIVE_ASSIGNMENTS',
				canCleanupActive: !subject.isActive,
				canCleanupAll: !subject.isActive,
				requiresArchiveFirst,
				teachingLoadPath: `/teaching-load?subjectId=${subject.id}`,
			},
		};
	}

	if (historicalAssignments.length > 0 && !cleanupHistorical) {
		return {
			success: false,
			code: 'HISTORICAL_ASSIGNMENTS',
			error: 'Historical faculty-subject records still exist. Archive or run explicit cleanup before deleting.',
			details: {
				subjectId: subject.id,
				subjectCode: subject.code,
				subjectName: subject.name,
				historicalAssignmentCount: historicalAssignments.length,
				activeAssignmentCount: 0,
				canCleanupHistorical: true,
				canCleanupAll: !subject.isActive,
				recommendedAction: subject.isActive ? 'ARCHIVE_THEN_CLEANUP' : 'CLEANUP_THEN_DELETE',
				teachingLoadPath: `/teaching-load?subjectId=${subject.id}`,
			},
		};
	}

	let cleanedHistoricalAssignments = 0;
	await prisma.$transaction(async (tx) => {
		if (cleanupHistorical || cleanupActive) {
			cleanedHistoricalAssignments = await tx.facultySubject.count({ where: { subjectId: id } });
			await tx.subjectSectionOwnership.deleteMany({ where: { subjectId: id } });
			await tx.facultySubject.deleteMany({ where: { subjectId: id } });
		}

		await tx.subject.delete({ where: { id } });
	});

	return {
		success: true,
		deletedSubjectId: id,
		cleanedHistoricalAssignments,
	};
}

export async function getSubjectCountBySchool(schoolId: number): Promise<number> {
	await ensureSubjectContractSchemaColumns();
	return prisma.subject.count({ where: { schoolId, isActive: true } });
}

export async function getSubjectsWithoutFaculty(schoolId: number) {
	await ensureSubjectContractSchemaColumns();
	return prisma.subject.findMany({
		where: {
			schoolId,
			isActive: true,
			facultySubjects: { none: {} },
		},
		select: { id: true, name: true, code: true },
	});
}

// ─── Prompt 01B-R2: Fingerprinted delete preview/apply ───
// Uses shared dependency collector from subject-delete-dependencies.service.ts

import { collectDeleteDependencies, type DeleteDependencyGraph } from './subject-delete-dependencies.service.js';
import { canonicalHash, sortByKey } from '../lib/canonical-json.js';

type DeletePreview = {
	ok: true;
	preview: {
		subjectId: number;
		subjectCode: string;
		subjectName: string;
		actorSchoolId: number;
		currentVersion: string;
		dependencies: Array<{
			type: string;
			id: number;
			classification: string;
			description: string;
			action: string;
		}>;
		summary: {
			activeCount: number;
			historicalCount: number;
			blockingCount: number;
			immutableCount: number;
			deletable: boolean;
			blockingReasons: string[];
		};
		fingerprint: string;
		generatedAt: string;
	};
};

type DeleteApplyResult =
	| {
		ok: true;
		receipt: {
			deletedSubjectId: number;
			deletedDependencies: Array<{ type: string; id: number }>;
			deletedDependencyCount: number;
			appliedAt: string;
		};
	  }
	| { ok: false; error: { status: number; code: string; message: string } };

/**
 * Compute a deterministic fingerprint from a delete dependency graph.
 * Uses the shared canonicalizer to handle nested objects correctly.
 */
async function computeDeleteFingerprint(graph: DeleteDependencyGraph): Promise<string> {
	const fingerprintData = {
		subjectId: graph.subjectId,
		subjectCode: graph.subjectCode,
		actorSchoolId: graph.actorSchoolId,
		subjectVersion: graph.subjectVersion,
		subjectIsActive: graph.subjectIsActive,
		dependencies: sortByKey(graph.dependencies, (d) => `${d.type}:${d.id}`),
	};
	return canonicalHash(fingerprintData);
}

export async function previewSubjectDeletion(
	subjectId: number,
	actorSchoolId: number,
): Promise<DeletePreview | { ok: false; error: { status: number; code: string; message: string } }> {
	if (!Number.isInteger(subjectId) || subjectId <= 0) {
		return { ok: false, error: { status: 400, code: 'INVALID_PARAM', message: 'subjectId must be a positive integer.' } };
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0) {
		return { ok: false, error: { status: 403, code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' } };
	}

	// Use the shared dependency collector
	const graph = await collectDeleteDependencies(prisma, subjectId, actorSchoolId);
	if ('error' in graph) {
		return { ok: false, error: graph.error };
	}

	const fingerprint = await computeDeleteFingerprint(graph);

	return {
		ok: true,
		preview: {
			subjectId: graph.subjectId,
			subjectCode: graph.subjectCode,
			subjectName: graph.subjectName,
			actorSchoolId: graph.actorSchoolId,
			currentVersion: graph.subjectVersion,
			dependencies: graph.dependencies.map((d) => ({
				type: d.type,
				id: d.id,
				classification: d.classification,
				description: d.description,
				action: d.action,
			})),
			summary: graph.summary,
			fingerprint,
			generatedAt: new Date().toISOString(),
		},
	};
}

export async function applySubjectDeletion(input: {
	subjectId: number;
	actorSchoolId: number;
	expectedUpdatedAt: string;
	fingerprint: string;
}): Promise<DeleteApplyResult> {
	const { subjectId, actorSchoolId, expectedUpdatedAt, fingerprint } = input;

	if (!Number.isInteger(subjectId) || subjectId <= 0) {
		return { ok: false, error: { status: 400, code: 'INVALID_PARAM', message: 'subjectId must be a positive integer.' } };
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0) {
		return { ok: false, error: { status: 403, code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' } };
	}
	if (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt.trim() === '') {
		return { ok: false, error: { status: 400, code: 'VERSION_REQUIRED', message: 'expectedUpdatedAt is required.' } };
	}
	const expectedMs = new Date(expectedUpdatedAt).getTime();
	if (!Number.isFinite(expectedMs)) {
		return { ok: false, error: { status: 400, code: 'INVALID_VERSION', message: 'expectedUpdatedAt must be a valid ISO-8601 timestamp.' } };
	}
	if (typeof fingerprint !== 'string' || fingerprint.trim() === '') {
		return { ok: false, error: { status: 400, code: 'FINGERPRINT_REQUIRED', message: 'fingerprint is required.' } };
	}

	// Execute in one Serializable transaction
	const result = await prisma.$transaction(async (tx) => {
		// 1. Re-read subject with version check
		const subject = await tx.subject.findUnique({
			where: { id: subjectId },
			select: { id: true, schoolId: true, updatedAt: true },
		});
		if (!subject) {
			return { ok: false as const, error: { status: 404, code: 'NOT_FOUND', message: 'Subject not found.' } };
		}
		if (subject.schoolId !== actorSchoolId) {
			return { ok: false as const, error: { status: 403, code: 'CROSS_SCHOOL_DENIED', message: 'Subject belongs to another school.' } };
		}
		if (subject.updatedAt.getTime() !== expectedMs) {
			return { ok: false as const, error: { status: 409, code: 'STALE_WRITE', message: 'Subject was modified by another user. Refresh and retry.' } };
		}

		// 2. Re-collect dependencies using the SAME collector as preview
		const graph = await collectDeleteDependencies(tx as any, subjectId, actorSchoolId);
		if ('error' in graph) {
			return { ok: false as const, error: graph.error };
		}

		// 3. Recompute fingerprint
		const currentFingerprint = await computeDeleteFingerprint(graph);
		if (currentFingerprint !== fingerprint) {
			return {
				ok: false as const,
				error: {
					status: 409,
					code: 'DELETE_DRIFT',
					message: 'Dependencies changed since preview. Re-run the delete preview.',
				},
			};
		}

		// 4. Enforce deletable — reject if any blocking/active/immutable dependencies
		if (!graph.summary.deletable) {
			return {
				ok: false as const,
				error: {
					status: 409,
					code: 'NOT_DELETABLE',
					message: `Subject cannot be deleted: ${graph.summary.blockingReasons.join('; ')}`,
				},
			};
		}

		// 5. Delete only rows classified as DELETE (historical dependencies)
		const deletedDependencies: Array<{ type: string; id: number }> = [];
		for (const dep of graph.dependencies) {
			if (dep.action === 'DELETE') {
				switch (dep.type) {
					case 'FacultySubject':
						await tx.facultySubject.delete({ where: { id: dep.id } });
						deletedDependencies.push({ type: dep.type, id: dep.id });
						break;
					case 'SubjectSectionOwnership':
						await tx.subjectSectionOwnership.delete({ where: { id: dep.id } });
						deletedDependencies.push({ type: dep.type, id: dep.id });
						break;
					default:
						// Unknown dependency type — fail closed
						return {
							ok: false as const,
							error: {
								status: 409,
								code: 'UNKNOWN_DEPENDENCY',
								message: `Unknown dependency type: ${dep.type}. Cannot safely delete.`,
							},
						};
				}
			}
		}

		// 6. Delete the subject itself
		await tx.subject.delete({ where: { id: subjectId } });
		deletedDependencies.push({ type: 'Subject', id: subjectId });

		return {
			ok: true as const,
			receipt: {
				deletedSubjectId: subjectId,
				deletedDependencies,
				deletedDependencyCount: deletedDependencies.length,
				appliedAt: new Date().toISOString(),
			},
		};
	}, { isolationLevel: 'Serializable' });

	return result;
}

// ─── Prompt 01B-R2: Sync preview/apply ───
// Uses shared sync plan builder from subject-sync-plan.service.ts

import { buildSyncPlan, computeSyncPlanFingerprint, applySyncPlan, type SyncPlan } from './subject-sync-plan.service.js';

type SyncPreviewResult = {
	ok: true;
	preview: {
		schoolId: number;
		schoolYearId: number;
		sourceRevision: string;
		offeredPrograms: string[];
		mutations: Array<{
			action: string;
			code: string;
			name: string;
			reason: string;
		}>;
		summary: {
			activationCount: number;
			deactivationCount: number;
			creationCount: number;
			updateCount: number;
			totalChanges: number;
		};
		fingerprint: string;
		generatedAt: string;
	};
};

type SyncApplyResult =
	| {
		ok: true;
		report: {
			schoolId: number;
			schoolYearId: number;
			sourceRevision: string;
			activatedCount: number;
			deactivatedCount: number;
			createdCount: number;
			updatedCount: number;
			appliedAt: string;
		};
	  }
	| { ok: false; error: { status: number; code: string; message: string } };

export async function previewSubjectSync(
	schoolId: number,
	schoolYearId: number,
	authToken?: string,
): Promise<SyncPreviewResult> {
	// Fetch upstream signals (read-only)
	const signals = await fetchUpstreamProgramSignals(schoolId, schoolYearId, authToken);

	// Build the sync plan using the shared plan builder
	const plan = await buildSyncPlan(prisma, schoolId, schoolYearId, {
		offeredPrograms: signals.offeredPrograms,
		tleSpecializations: signals.tleSpecializations,
		provenance: signals.provenance,
	});

	// Compute fingerprint
	const fingerprint = await computeSyncPlanFingerprint(plan);

	return {
		ok: true,
		preview: {
			schoolId: plan.schoolId,
			schoolYearId: plan.schoolYearId,
			sourceRevision: plan.sourceRevision,
			offeredPrograms: plan.sourceSnapshot.offeredPrograms,
			mutations: plan.mutations.map((m) => ({
				action: m.action,
				code: m.code,
				name: m.name,
				reason: m.reason,
			})),
			summary: plan.summary,
			fingerprint,
			generatedAt: new Date().toISOString(),
		},
	};
}

export async function applySubjectSync(input: {
	schoolId: number;
	schoolYearId: number;
	fingerprint: string;
	authToken?: string;
}): Promise<SyncApplyResult> {
	const { schoolId, schoolYearId, fingerprint, authToken } = input;

	if (!Number.isInteger(schoolId) || schoolId <= 0) {
		return { ok: false, error: { status: 400, code: 'INVALID_PARAM', message: 'schoolId must be a positive integer.' } };
	}
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
		return { ok: false, error: { status: 400, code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' } };
	}
	if (typeof fingerprint !== 'string' || fingerprint.trim() === '') {
		return { ok: false, error: { status: 400, code: 'FINGERPRINT_REQUIRED', message: 'fingerprint is required.' } };
	}

	// Execute in one Serializable transaction
	const result = await prisma.$transaction(async (tx) => {
		// 1. Re-fetch upstream signals inside the transaction
		const signals = await fetchUpstreamProgramSignals(schoolId, schoolYearId, authToken);

		// 2. Rebuild the plan using the SAME plan builder as preview
		const plan = await buildSyncPlan(tx as any, schoolId, schoolYearId, {
			offeredPrograms: signals.offeredPrograms,
			tleSpecializations: signals.tleSpecializations,
			provenance: signals.provenance,
		});

		// 3. Check if plan is applicable
		if (!plan.applicable) {
			return {
				ok: false as const,
				error: {
					status: 409,
					code: 'SOURCE_DEGRADED',
					message: 'Cannot apply sync: upstream source is degraded or unavailable.',
				},
			};
		}

		// 3b. Check if offering model is available (Prompt 03 not yet authorized)
		if (!plan.offeringModelAvailable) {
			return {
				ok: false as const,
				error: {
					status: 409,
					code: 'OFFERING_MODEL_REQUIRED',
					message: 'Cannot apply sync: persisted offering model is not yet available. Prompt 03 must define the offering schema first.',
				},
			};
		}

		// 4. Recompute fingerprint
		const currentFingerprint = await computeSyncPlanFingerprint(plan);
		if (currentFingerprint !== fingerprint) {
			return {
				ok: false as const,
				error: {
					status: 409,
					code: 'SYNC_DRIFT',
					message: 'Upstream signals changed since preview. Re-run the sync preview.',
				},
			};
		}

		// 5. Apply the plan within the transaction
		const counts = await applySyncPlan(tx as any, plan);

		return {
			ok: true as const,
			report: {
				schoolId,
				schoolYearId,
				sourceRevision: plan.sourceRevision,
				...counts,
				appliedAt: new Date().toISOString(),
			},
		};
	}, { isolationLevel: 'Serializable' });

	return result;
}
