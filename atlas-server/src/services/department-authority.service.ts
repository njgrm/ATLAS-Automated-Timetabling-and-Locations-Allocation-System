/**
 * Department authority service — persisted DepartmentAlias/DepartmentLabel
 * preview and fingerprinted apply for a single actor school.
 *
 * Read paths are side-effect free. The apply path requires actor-school scope,
 * an exact expected fingerprint, an exact expected source revision, and an
 * explicit confirmation; it runs inside one Serializable transaction,
 * revalidates inside that transaction, aborts the whole transaction on drift
 * or conflicting existing values, treats exact matches as idempotent no-ops,
 * and writes only department_aliases / department_labels rows. Aliases and
 * labels are never inferred from teacher or subject names here — the caller
 * supplies every accepted row explicitly.
 */

import { getDataContext } from '../lib/data-context.js';
import { Prisma } from '@prisma/client';
import { canonicalHash } from '../lib/canonical-json.js';

const db = () => getDataContext();

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

export const DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION = 'APPLY DEPARTMENT AUTHORITY';

export interface DepartmentAliasInput {
	alias: string;
	department: string;
}

export interface DepartmentLabelInput {
	code: string;
	label: string;
}

/**
 * Strict positive-integer parsing for route school IDs. Rejects fractional,
 * infinite, string-junk, zero, negative, empty, and non-numeric values with a
 * typed 400. Unlike flooring parsers, '3.5' is rejected rather than coerced.
 */
export function parseStrictPositiveInt(value: unknown, field = 'schoolId'): number {
	if (typeof value === 'number') {
		if (Number.isInteger(value) && value > 0) return value;
		throw err(400, 'INVALID_PARAM', `${field} must be a positive integer.`);
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (/^[1-9]\d*$/.test(trimmed)) {
			const parsed = Number(trimmed);
			if (Number.isSafeInteger(parsed)) return parsed;
		}
		throw err(400, 'INVALID_PARAM', `${field} must be a positive integer.`);
	}
	throw err(400, 'INVALID_PARAM', `${field} must be a positive integer.`);
}

export interface DepartmentAuthoritySourceRevision {
	/** Canonical hash over every scoped semantic row (the concurrency authority). */
	revisionHash: string;
	/** Diagnostic only: never establishes concurrency. */
	aliasRows: number;
	/** Diagnostic only: never establishes concurrency. */
	labelRows: number;
	/** Diagnostic only: never establishes concurrency. */
	aliasMaxCreatedAt: string | null;
	/** Diagnostic only: never establishes concurrency. */
	labelMaxCreatedAt: string | null;
}

export type DepartmentAuthorityChange = {
	kind: 'alias' | 'label';
	key: string;
	value: string;
	action: 'create' | 'unchanged' | 'conflict';
	existingValue: string | null;
};

export interface DepartmentAuthorityPreview {
	schoolId: number;
	aliases: DepartmentAliasInput[];
	labels: DepartmentLabelInput[];
	changes: DepartmentAuthorityChange[];
	sourceRevision: DepartmentAuthoritySourceRevision;
	fingerprint: string;
}

export interface DepartmentAuthorityRollbackRow {
	op: 'delete';
	table: 'department_aliases' | 'department_labels';
	key: Record<string, number | string>;
}

export interface DepartmentAuthorityApplyResult {
	schoolId: number;
	fingerprint: string;
	created: DepartmentAuthorityChange[];
	unchanged: DepartmentAuthorityChange[];
	conflicting: DepartmentAuthorityChange[];
	before: { aliases: number; labels: number };
	after: { aliases: number; labels: number };
	rollback: DepartmentAuthorityRollbackRow[];
	replayed: boolean;
	/** Always true on success: replay included, every success passes in-tx revalidation. */
	revalidatedInTransaction: boolean;
}

function normalizeToken(value: unknown, field: string, maxLength: number): string {
	if (typeof value !== 'string') {
		throw err(400, 'INVALID_DEPARTMENT_AUTHORITY', `${field} must be a string.`);
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw err(400, 'INVALID_DEPARTMENT_AUTHORITY', `${field} must not be blank.`);
	}
	if (trimmed.length > maxLength) {
		throw err(400, 'INVALID_DEPARTMENT_AUTHORITY', `${field} exceeds ${maxLength} characters.`);
	}
	return trimmed;
}

function normalizeAliases(input: unknown): DepartmentAliasInput[] {
	if (input == null) return [];
	if (!Array.isArray(input)) {
		throw err(400, 'INVALID_DEPARTMENT_AUTHORITY', 'aliases must be an array.');
	}
	const seen = new Set<string>();
	return input.map((entry) => {
		const alias = normalizeToken((entry as Record<string, unknown>)?.alias, 'alias', 64);
		const department = normalizeToken((entry as Record<string, unknown>)?.department, 'department', 32);
		const key = alias.toUpperCase();
		if (seen.has(key)) {
			throw err(400, 'INVALID_DEPARTMENT_AUTHORITY', `duplicate alias in request: ${alias}.`);
		}
		seen.add(key);
		return { alias, department };
	});
}

function normalizeLabels(input: unknown): DepartmentLabelInput[] {
	if (input == null) return [];
	if (!Array.isArray(input)) {
		throw err(400, 'INVALID_DEPARTMENT_AUTHORITY', 'labels must be an array.');
	}
	const seen = new Set<string>();
	return input.map((entry) => {
		const code = normalizeToken((entry as Record<string, unknown>)?.code, 'code', 32);
		const label = normalizeToken((entry as Record<string, unknown>)?.label, 'label', 64);
		const key = code.toUpperCase();
		if (seen.has(key)) {
			throw err(400, 'INVALID_DEPARTMENT_AUTHORITY', `duplicate label code in request: ${code}.`);
		}
		seen.add(key);
		return { code, label };
	});
}

function toISOStringOrNull(value: Date | null | undefined): string | null {
	return value ? new Date(value).toISOString() : null;
}

export function isTransactionConflictError(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034';
}

/**
 * Canonical source revision: a hash covering EVERY scoped semantic row
 * (school, normalized alias/department pairs, normalized code/label pairs,
 * stable ordering, schema version). Counts and timestamps remain diagnostic
 * fields only — an in-place value change flips the hash with identical counts.
 */
export async function buildDepartmentAuthoritySourceRevision(
	schoolId: number,
	aliasRows: Array<{ alias: string; department: string }>,
	labelRows: Array<{ code: string; label: string }>,
	aliasMaxCreatedAt: string | null,
	labelMaxCreatedAt: string | null,
): Promise<DepartmentAuthoritySourceRevision> {
	const revisionHash = await canonicalHash({
		schemaVersion: 'TL-C01R4A.1',
		schoolId,
		aliases: aliasRows
			.map((row) => ({ alias: row.alias.trim(), department: row.department.trim() }))
			.sort((left, right) => left.alias.localeCompare(right.alias) || left.department.localeCompare(right.department)),
		labels: labelRows
			.map((row) => ({ code: row.code.trim(), label: row.label.trim() }))
			.sort((left, right) => left.code.localeCompare(right.code) || left.label.localeCompare(right.label)),
	});
	return {
		revisionHash,
		aliasRows: aliasRows.length,
		labelRows: labelRows.length,
		aliasMaxCreatedAt,
		labelMaxCreatedAt,
	};
}

export async function readDepartmentAuthoritySourceRevision(schoolId: number): Promise<DepartmentAuthoritySourceRevision> {
	const [aliasRows, labelRows] = await Promise.all([
		db().departmentAlias.findMany({ where: { schoolId }, select: { alias: true, department: true } }),
		db().departmentLabel.findMany({ where: { schoolId }, select: { code: true, label: true } }),
	]);
	const [aliasMax, labelMax] = await Promise.all([
		db().departmentAlias.aggregate({ where: { schoolId }, _max: { createdAt: true } }),
		db().departmentLabel.aggregate({ where: { schoolId }, _max: { createdAt: true } }),
	]);
	return buildDepartmentAuthoritySourceRevision(
		schoolId,
		aliasRows,
		labelRows,
		toISOStringOrNull(aliasMax._max.createdAt),
		toISOStringOrNull(labelMax._max.createdAt),
	);
}

export async function buildDepartmentAuthorityFingerprint(
	schoolId: number,
	aliases: DepartmentAliasInput[],
	labels: DepartmentLabelInput[],
	sourceRevision: DepartmentAuthoritySourceRevision,
): Promise<string> {
	return canonicalHash({
		schemaVersion: 'TL-C01R4.1',
		schoolId,
		aliases: [...aliases]
			.map((entry) => ({ alias: entry.alias, department: entry.department }))
			.sort((left, right) => left.alias.localeCompare(right.alias)),
		labels: [...labels]
			.map((entry) => ({ code: entry.code, label: entry.label }))
			.sort((left, right) => left.code.localeCompare(right.code)),
		sourceRevision,
	});
}

/**
 * Read-only list of persisted department authority rows for a school.
 */
export async function listDepartmentAuthority(schoolId: number): Promise<{
	schoolId: number;
	aliases: Array<{ alias: string; department: string }>;
	labels: Array<{ code: string; label: string }>;
	sourceRevision: DepartmentAuthoritySourceRevision;
}> {
	const [aliasRows, labelRows, sourceRevision] = await Promise.all([
		db().departmentAlias.findMany({
			where: { schoolId },
			select: { alias: true, department: true },
			orderBy: { alias: 'asc' },
		}),
		db().departmentLabel.findMany({
			where: { schoolId },
			select: { code: true, label: true },
			orderBy: { code: 'asc' },
		}),
		readDepartmentAuthoritySourceRevision(schoolId),
	]);
	return { schoolId, aliases: aliasRows, labels: labelRows, sourceRevision };
}

function classifyChanges(
	proposedAliases: DepartmentAliasInput[],
	proposedLabels: DepartmentLabelInput[],
	existingAliases: Map<string, string>,
	existingLabels: Map<string, string>,
): DepartmentAuthorityChange[] {
	const changes: DepartmentAuthorityChange[] = [];
	for (const entry of proposedAliases) {
		const existing = existingAliases.get(entry.alias.toUpperCase()) ?? null;
		changes.push({
			kind: 'alias',
			key: entry.alias,
			value: entry.department,
			action: existing == null ? 'create' : existing === entry.department ? 'unchanged' : 'conflict',
			existingValue: existing,
		});
	}
	for (const entry of proposedLabels) {
		const existing = existingLabels.get(entry.code.toUpperCase()) ?? null;
		changes.push({
			kind: 'label',
			key: entry.code,
			value: entry.label,
			action: existing == null ? 'create' : existing === entry.label ? 'unchanged' : 'conflict',
			existingValue: existing,
		});
	}
	return changes;
}

async function readExistingMaps(schoolId: number): Promise<{ aliases: Map<string, string>; labels: Map<string, string> }> {
	const [aliasRows, labelRows] = await Promise.all([
		db().departmentAlias.findMany({ where: { schoolId }, select: { alias: true, department: true } }),
		db().departmentLabel.findMany({ where: { schoolId }, select: { code: true, label: true } }),
	]);
	return {
		aliases: new Map(aliasRows.map((row) => [row.alias.toUpperCase(), row.department])),
		labels: new Map(labelRows.map((row) => [row.code.toUpperCase(), row.label])),
	};
}

/**
 * Deterministic, side-effect-free preview of proposed department authority rows.
 * Requires the actor school (operator JWT): missing or mismatched actor scope is
 * a typed 403 with zero reads beyond validation.
 */
export async function previewDepartmentAuthority(
	schoolId: number,
	input: { actorSchoolId: number | null | undefined; aliases?: unknown; labels?: unknown },
): Promise<DepartmentAuthorityPreview> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) {
		throw err(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	}
	assertSchoolScope(input.actorSchoolId, schoolId);
	const aliases = normalizeAliases(input.aliases);
	const labels = normalizeLabels(input.labels);
	const [existing, sourceRevision] = await Promise.all([
		readExistingMaps(schoolId),
		readDepartmentAuthoritySourceRevision(schoolId),
	]);
	const changes = classifyChanges(aliases, labels, existing.aliases, existing.labels);
	const fingerprint = await buildDepartmentAuthorityFingerprint(schoolId, aliases, labels, sourceRevision);
	return { schoolId, aliases, labels, changes, sourceRevision, fingerprint };
}

export interface ApplyDepartmentAuthorityInput {
	actorSchoolId: number | null | undefined;
	schoolId: unknown;
	expectedFingerprint: unknown;
	expectedSourceRevision: unknown;
	aliases?: unknown;
	labels?: unknown;
	confirmationText: unknown;
}

function assertSchoolScope(actorSchoolId: number | null | undefined, schoolId: number): asserts actorSchoolId is number {
	if (actorSchoolId == null) {
		throw err(403, 'ACTOR_SCHOOL_REQUIRED', 'Operator preview/apply requires an authenticated actor school. System-token-only application is not authorized.');
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0 || actorSchoolId !== schoolId) {
		throw err(403, 'SCHOOL_MISMATCH', 'Request school does not match the authenticated actor school.');
	}
}

function assertSourceRevision(
	expected: unknown,
	actual: DepartmentAuthoritySourceRevision,
): asserts expected is DepartmentAuthoritySourceRevision {
	const candidate = expected as Partial<DepartmentAuthoritySourceRevision> | null;
	// Concurrency is established ONLY by the canonical revision hash. Counts and
	// timestamps are diagnostic and never satisfy this comparison.
	if (!candidate || typeof candidate.revisionHash !== 'string' || candidate.revisionHash !== actual.revisionHash) {
		throw err(409, 'SOURCE_DRIFT', 'Department authority source changed since the preview. Re-run preview before applying.');
	}
}

/**
 * Fingerprinted apply. All validation that can run without writes happens
 * first (typed 4xx, zero writes); then ONE Serializable transaction performs,
 * in order: full scoped re-read → canonical revision recompute + compare →
 * fingerprint recompute + compare → conflict/create/unchanged classification →
 * atomic abort on conflict → create-only writes → receipt. Replay succeeds
 * only after the in-transaction checks pass. Serialization failures map to a
 * typed 409 retry/re-preview response without partial writes.
 */
export async function applyDepartmentAuthority(input: ApplyDepartmentAuthorityInput): Promise<DepartmentAuthorityApplyResult> {
	const schoolId = typeof input.schoolId === 'number' && Number.isInteger(input.schoolId) && input.schoolId > 0
		? input.schoolId
		: null;
	if (schoolId == null) {
		throw err(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	}
	assertSchoolScope(input.actorSchoolId, schoolId);
	if (input.confirmationText !== DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION) {
		throw err(400, 'CONFIRMATION_REQUIRED', `confirmationText="${DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION}" is required.`);
	}
	if (typeof input.expectedFingerprint !== 'string' || !input.expectedFingerprint) {
		throw err(400, 'FINGERPRINT_REQUIRED', 'expectedFingerprint from the preview is required.');
	}
	const aliases = normalizeAliases(input.aliases);
	const labels = normalizeLabels(input.labels);

	try {
		return await db().$transaction(async (tx) => {
			const [txAliases, txLabels] = await Promise.all([
				tx.departmentAlias.findMany({ where: { schoolId }, select: { alias: true, department: true } }),
				tx.departmentLabel.findMany({ where: { schoolId }, select: { code: true, label: true } }),
			]);
			const [txAliasMax, txLabelMax] = await Promise.all([
				tx.departmentAlias.aggregate({ where: { schoolId }, _max: { createdAt: true } }),
				tx.departmentLabel.aggregate({ where: { schoolId }, _max: { createdAt: true } }),
			]);
			const txRevision = await buildDepartmentAuthoritySourceRevision(
				schoolId,
				txAliases,
				txLabels,
				toISOStringOrNull(txAliasMax._max.createdAt),
				toISOStringOrNull(txLabelMax._max.createdAt),
			);
			assertSourceRevision(input.expectedSourceRevision, txRevision);
			const expected = await buildDepartmentAuthorityFingerprint(schoolId, aliases, labels, txRevision);
			if (expected !== input.expectedFingerprint) {
				throw err(409, 'FINGERPRINT_MISMATCH', 'Preview fingerprint does not match the current request. Re-run preview before applying.');
			}
			const txExisting = {
				aliases: new Map(txAliases.map((row) => [row.alias.toUpperCase(), row.department])),
				labels: new Map(txLabels.map((row) => [row.code.toUpperCase(), row.label])),
			};
			const changes = classifyChanges(aliases, labels, txExisting.aliases, txExisting.labels);
			const conflicting = changes.filter((change) => change.action === 'conflict');
			if (conflicting.length > 0) {
				throw err(
					409,
					'DEPARTMENT_AUTHORITY_CONFLICT',
					`Conflicting persisted values abort the apply without writes: ${conflicting.map((change) => `${change.kind}:${change.key}`).join(', ')}.`,
				);
			}
			const toCreate = changes.filter((change) => change.action === 'create');
			const unchanged = changes.filter((change) => change.action === 'unchanged');
			const before = { aliases: txRevision.aliasRows, labels: txRevision.labelRows };
			if (toCreate.length === 0) {
				// Idempotent replay: in-transaction checks passed, nothing to write.
				return {
					schoolId,
					fingerprint: expected,
					created: [],
					unchanged,
					conflicting: [],
					before,
					after: { ...before },
					rollback: [],
					replayed: true,
					revalidatedInTransaction: true,
				};
			}
			const created: DepartmentAuthorityChange[] = [];
			for (const change of toCreate) {
				if (change.kind === 'alias') {
					const row = aliases.find((entry) => entry.alias === change.key) as DepartmentAliasInput;
					await tx.departmentAlias.create({ data: { schoolId, alias: row.alias, department: row.department } });
				} else {
					const row = labels.find((entry) => entry.code === change.key) as DepartmentLabelInput;
					await tx.departmentLabel.create({ data: { schoolId, code: row.code, label: row.label } });
				}
				created.push(change);
			}
			const rollback: DepartmentAuthorityRollbackRow[] = created.map((change): DepartmentAuthorityRollbackRow => {
				if (change.kind === 'alias') {
					return { op: 'delete', table: 'department_aliases', key: { schoolId, alias: change.key } };
				}
				return { op: 'delete', table: 'department_labels', key: { schoolId, code: change.key } };
			});
			return {
				schoolId,
				fingerprint: expected,
				created,
				unchanged,
				conflicting: [],
				before,
				after: {
					aliases: before.aliases + created.filter((change) => change.kind === 'alias').length,
					labels: before.labels + created.filter((change) => change.kind === 'label').length,
				},
				rollback,
				replayed: false,
				revalidatedInTransaction: true,
			};
		}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
	} catch (error: unknown) {
		if (isTransactionConflictError(error)) {
			throw err(409, 'TRANSACTION_CONFLICT', 'Concurrent transaction conflict: no partial writes occurred. Re-run preview and retry the apply.');
		}
		throw error;
	}
}
