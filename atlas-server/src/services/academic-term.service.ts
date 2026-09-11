/**
 * DEMAND-C01R2 — One authoritative ordered-term model.
 *
 * The verified EnrollPro ordered term contract is the single academic-term
 * authority. This module centralizes the syntactic parsing and semantic
 * validation policy that was previously duplicated (and truncated to three
 * terms) across generation, publication, revision, export, and public reads.
 *
 * Policy:
 *  - Syntactic parsing accepts any positive supported index (1..4) so a
 *    `QUARTERS` term 4 reaches semantic validation.
 *  - Semantic validation rejects an index absent from the exact school/year
 *    contract: a trimester rejects 4; a quarter accepts 4.
 *  - The active term resolves only through the persisted verified EnrollPro
 *    contract and fails closed when it is unavailable or outside the contract.
 *  - No term is ever clamped, cycled, defaulted, relabelled, or silently
 *    dropped.
 */

import { getDataContext } from '../lib/data-context.js';
import { normalizePersistedTermStructure } from './derived-demand.service.js';

export type AcademicTermFormat = 'TRIMESTER' | 'QUARTERS';

export const SEMESTER_TERM_COUNT = 3;
export const QUARTER_TERM_COUNT = 4;
/** Highest index the current supported contract family (`TRIMESTER`/`QUARTERS`) can name. */
export const MAX_ACADEMIC_TERM_INDEX = QUARTER_TERM_COUNT;

export type OrderedAcademicTerm = {
	identity: string;
	displayLabel: string;
	order: number;
};

export function termCountForFormat(format: AcademicTermFormat): number {
	return format === 'QUARTERS' ? QUARTER_TERM_COUNT : SEMESTER_TERM_COUNT;
}

/**
 * Syntactic parse: a positive integer within the supported contract family.
 * Returns `null` for anything else (including `'active'`, which the caller must
 * resolve separately through verified authority).
 */
export function parseSupportedTermIndex(raw: unknown): number | null {
	if (raw === null || raw === undefined || raw === '') return null;
	const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
	if (!Number.isInteger(value) || value < 1 || value > MAX_ACADEMIC_TERM_INDEX) return null;
	return value;
}

export function isTermIndexWithinContract(index: number, terms: readonly { order: number }[]): boolean {
	return Number.isInteger(index) && index >= 1 && index <= terms.length;
}

/** `T1`/`T2`/... is the explicit fail-closed fallback when no authoritative label exists. */
export function academicTermFallbackLabel(index: number): string {
	return `T${index}`;
}

export function academicTermDisplayLabel(terms: readonly OrderedAcademicTerm[], index: number): string {
	const term = terms.find((entry) => entry.order === index);
	const label = term?.displayLabel?.trim();
	return label && label.length > 0 ? label : academicTermFallbackLabel(index);
}

export type LoadedAcademicTermContract = {
	schoolId: number;
	schoolYearId: number;
	format: AcademicTermFormat;
	terms: OrderedAcademicTerm[];
	/** Active term order from the persisted verified EnrollPro contract, or null. */
	activeTermOrder: number | null;
};

type TermAuthorityClient = {
	enrollProSchoolYearMirror: {
		findUnique: (args: unknown) => Promise<{
			isActive: boolean;
			isArchived: boolean;
			termContractCache: unknown;
			termContractCachedAt: Date | null;
		} | null>;
	};
};

/**
 * Read the persisted, verified ordered term contract for one (school, year).
 * Read-only; never calls the network and never persists. Returns `null` when no
 * verified snapshot exists or the snapshot is malformed.
 */
export async function loadVerifiedOrderedTermContract(
	schoolId: number,
	schoolYearId: number,
	client: TermAuthorityClient = getDataContext<TermAuthorityClient>(),
): Promise<LoadedAcademicTermContract | null> {
	const mirror = await client.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
		select: { isActive: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
	});
	if (!mirror || !mirror.isActive || mirror.isArchived || !mirror.termContractCache || !mirror.termContractCachedAt) {
		return null;
	}
	const normalized = normalizePersistedTermStructure(mirror.termContractCache, schoolId, schoolYearId);
	if (!normalized.ok) return null;
	const rawActive = (mirror.termContractCache as { activeTerm?: { order?: unknown } }).activeTerm;
	const activeOrder = rawActive && Number.isInteger(rawActive.order) ? Number(rawActive.order) : null;
	return {
		schoolId,
		schoolYearId,
		format: normalized.structure.format,
		terms: normalized.structure.terms,
		activeTermOrder: activeOrder != null && isTermIndexWithinContract(activeOrder, normalized.structure.terms) ? activeOrder : null,
	};
}

export function termIndexOutsideContractMessage(schoolId: number, schoolYearId: number, index: number, contract: LoadedAcademicTermContract): string {
	return `termIndex ${index} is outside the ${contract.terms.length}-term ${contract.format} contract for school ${schoolId} / year ${schoolYearId}.`;
}

export type AcademicTermServiceError = Error & { statusCode: number; code: string };

function termError(statusCode: number, code: string, message: string): AcademicTermServiceError {
	const error = new Error(message) as AcademicTermServiceError;
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

/**
 * Resolve a requested academic term filter through the verified ordered-term
 * authority.
 *
 * - `undefined` → all terms.
 * - `'active'` → the persisted verified active term order; fails closed with
 *   `TERM_FILTER_NOT_READY` when no verified active term exists.
 * - explicit numeric → the same index when it belongs to the exact verified
 *   structure, otherwise a typed `TERM_INDEX_OUTSIDE_CONTRACT`; this works even
 *   while active-term resolution is unavailable, provided the structure loads.
 */
export async function resolveRequestedTermIndex(
	schoolId: number,
	schoolYearId: number,
	requested: number | 'active' | undefined,
	client?: TermAuthorityClient,
): Promise<number | undefined> {
	if (requested === undefined) return undefined;
	const contract = await loadVerifiedOrderedTermContract(schoolId, schoolYearId, client);
	if (requested === 'active') {
		if (!contract || contract.activeTermOrder == null) {
			throw termError(501, 'TERM_FILTER_NOT_READY', 'The active term cannot be verified from the persisted EnrollPro term authority. Choose an explicit term or omit termIndex.');
		}
		return contract.activeTermOrder;
	}
	if (!Number.isInteger(requested) || requested < 1 || requested > MAX_ACADEMIC_TERM_INDEX) {
		throw termError(400, 'INVALID_TERM_INDEX', `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX} or "active".`);
	}
	if (!contract) {
		throw termError(409, 'TERM_STRUCTURE_UNAVAILABLE', 'No verified ordered term contract is available for this school year, so the requested term cannot be validated.');
	}
	if (!isTermIndexWithinContract(requested, contract.terms)) {
		throw termError(400, 'TERM_INDEX_OUTSIDE_CONTRACT', termIndexOutsideContractMessage(schoolId, schoolYearId, requested, contract));
	}
	return requested;
}
