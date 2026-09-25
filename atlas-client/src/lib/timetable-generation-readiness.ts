/**
 * UX-C01R — the client-side generation-readiness adapter.
 *
 * The Timetable's generation capability is gated by the GEN-C02 server
 * generation diagnostic contract, NOT by the narrower derived-demand readiness
 * result. "Derived demand exists" (year + ordered terms + Subject metadata +
 * subject/section pairs) is an input milestone; it is not permission to
 * generate. Only the canonical diagnostic that also binds Teaching Load
 * ownership, canonical schedule shape, policy/window/template readiness,
 * retained placements, hard-validator results, and zero-write proof may enable
 * the generation action.
 *
 * This module is pure and hermetic: no network, no React, no DB. The hook
 * (`useTimetableData`) owns the fetch; this module owns the decision and keeps
 * the complete diagnostic (revisions, blockers, totals, Teaching Load coverage,
 * zero-write) instead of collapsing it to a boolean plus first message.
 */

// C2-a: the operator presentation reuses the established violation-copy
// normalisers rather than growing a parallel humaniser.
import { formatIdentityFallbackText, formatWarningMessageText } from './violation-presentation';

export type TimetableGenerationBlockerCategory =
	| 'DEMAND_AUTHORITY'
	| 'DATA_GAP'
	| 'POLICY_BLOCKER'
	| 'RESOURCE_INFEASIBLE'
	| 'ALGORITHM_LIMIT';

export type TimetableGenerationBlocker = {
	code: string;
	category: TimetableGenerationBlockerCategory | string;
	termIdentity: string | null;
	sectionId: number | null;
	subjectId: number | null;
	subjectCode: string | null;
	entity: string;
	reason: string;
	owningSurface: string;
	nextAction: string;
};

export type TimetableTeachingLoadCoverage = {
	requiredPairs: number;
	ownedPairs: number;
	missingPairs: number;
	inactiveOrStalePairs: number;
	outsideScopePairs: number;
};

export type TimetableGenerationReadinessDiagnostic = {
	scope: { schoolId: number | null; schoolYearId: number | null };
	status: 'READY' | 'BLOCKED' | string;
	/** The canonical server gate: true only when every blocker, hard validator,
	 * scheduler dry run, and zero-write proof agree. */
	generateAllowed: boolean;
	schedulerExecuted: boolean;
	derivedDemandRevision: string | null;
	termStructure: { format: 'TRIMESTER' | 'QUARTERS' | string; terms: Array<{ identity: string; order: number }> } | null;
	totals: { lines: number; pairs: number; sessionsByTerm: Record<string, number> };
	teachingLoadCoverage: TimetableTeachingLoadCoverage | null;
	blockers: TimetableGenerationBlocker[];
	/** Server-computed zero-write truth. The client also accepts the nested
	 * `databaseSignature.zeroWrite` form. */
	zeroWrite: boolean;
};

/**
 * A readiness repair is either a real navigation to a *different* surface or a
 * real in-place retry of the readiness check. There is deliberately no
 * "navigate to the current route" state: an action whose target equals the
 * route the operator is already on is a no-op, so it must be expressed as
 * `retry` (which the headers render as an actionable button) instead of as a
 * dead self-link.
 */
export type TimetableReadinessRepair =
	| { kind: 'navigate'; label: string; href: string }
	| { kind: 'retry'; label: string };

export type TimetableCurriculumReadinessState =
	| { state: 'loading'; message: string }
	| { state: 'ready'; message: string; diagnostic: TimetableGenerationReadinessDiagnostic }
	| { state: 'blocked'; message: string; code: string | null; repair: TimetableReadinessRepair; diagnostic: TimetableGenerationReadinessDiagnostic }
	| { state: 'unavailable'; message: string }
	| { state: 'failed'; message: string };

export type TimetableReadinessDiagnosticSummary = {
	generateAllowed: boolean;
	zeroWrite: boolean;
	blockerCount: number;
};

/* ------------------------------------------------------------------ *
 * C2-a — the operator presentation of a blocked generation
 *
 * The engine diagnostic is the authority; this is the only place it is
 * turned into something a scheduler can act on. Two rules are absolute:
 *
 * 1. No raw `code`, `termIdentity` or `subjectCode` may reach operator
 *    text. The engine strings (`entity`, `reason`, `nextAction`) may
 *    contain them, so they are never printed here at all — they stay
 *    behind the Technical detail tooltip for support.
 * 2. Every row carries the REAL repair `deriveTimetableReadinessRepair`
 *    already resolves, so a `retry` really retries and a `navigate` goes
 *    to a mounted route. There is no no-op row.
 * ------------------------------------------------------------------ */

/**
 * C2-a — a plain phrase per blocker category. The category is a small closed
 * vocabulary; anything unknown falls back to a plain phrase that is still
 * honest, rather than printing an unrecognised engine code.
 */
const CATEGORY_PHRASES: Record<string, string> = {
	DEMAND_AUTHORITY: 'The schedule is missing required subject or section information',
	DATA_GAP: 'Some schedule information is missing or incomplete',
	POLICY_BLOCKER: 'A scheduling rule needs a decision before a schedule can be made',
	RESOURCE_INFEASIBLE: 'The available rooms cannot accommodate the schedule as set up',
	ALGORITHM_LIMIT: 'A session could not be placed with the current setup',
};

const DEFAULT_CATEGORY_PHRASE = 'A schedule setup item needs attention before a timetable can be made';

function safeLabel(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/**
 * C2-a — the ordered-term phrase. The term is read from the canonical ordered
 * term structure by POSITION, never from the raw `termIdentity`, and a
 * `termIdentity` that is not in that structure yields NO phrase at all. A
 * missing or unknown term never becomes "Term 1" (AGENTS.md section 7).
 */
function termPhrase(
	diagnostic: TimetableGenerationReadinessDiagnostic,
	termIdentity: string | null,
): string | null {
	if (!termIdentity) return null;
	const match = diagnostic.termStructure?.terms.find((term) => term.identity === termIdentity);
	if (!match || !Number.isInteger(match.order)) return null;
	return `Term ${match.order}`;
}

export type TimetableGenerationBlockerPresentation = {
	/** Stable row key. Carries no engine text into the DOM. */
	key: string;
	/** Plain human sentence. Never a code, term identity, or subject code. */
	sentence: string;
	/** The real repair for THIS blocker, from the shared resolver. */
	repair: TimetableReadinessRepair;
};

/**
 * C2-a — present every blocker, in plain language, with its real repair.
 *
 * The entity clause reuses the workspace's own reference-name resolvers
 * (the same `sectionLabel` / `subjectLabel` the grid uses), and the result
 * is passed through the established operator normalisers from
 * `violation-presentation.ts`, so no `faculty #12` / `section #701` raw-id
 * form and no bare `min` / `h` abbreviation can reach the surface. The raw
 * `subjectCode`, `code` and `entity` strings are deliberately never read.
 */
export function presentGenerationBlockers(input: {
	diagnostic: TimetableGenerationReadinessDiagnostic;
	labelForSection?: (id: number) => string;
	labelForSubject?: (id: number) => string;
}): TimetableGenerationBlockerPresentation[] {
	const { diagnostic, labelForSection, labelForSubject } = input;
	return diagnostic.blockers.map((blocker, index) => {
		const base = CATEGORY_PHRASES[blocker.category] ?? DEFAULT_CATEGORY_PHRASE;
		const label = typeof blocker.sectionId === 'number' && Number.isInteger(blocker.sectionId) && labelForSection
			? safeLabel(labelForSection(blocker.sectionId))
			: typeof blocker.subjectId === 'number' && Number.isInteger(blocker.subjectId) && labelForSubject
				? safeLabel(labelForSubject(blocker.subjectId))
				: null;
		const qualifiers = [termPhrase(diagnostic, blocker.termIdentity), label].filter(
			(part): part is string => part != null,
		);
		const sentence = formatWarningMessageText(
			formatIdentityFallbackText(qualifiers.length > 0 ? `${base} (${qualifiers.join(', ')})` : base),
		);
		return {
			key: `generation-blocker-${index}`,
			sentence,
			repair: deriveTimetableReadinessRepair(blocker),
		};
	});
}

/**
 * C2-a — the operator sentence for a blocked generation.
 *
 * It states the consequence, the real count, and where the real list is. It
 * never says "review the item shown": the earlier copy promised an item the
 * client never rendered, which is what made the blocked state a dead end.
 */
export function generationBlockedOperatorSentence(input: {
	blockerCount: number;
	/** The shared setup-state label, so there is one source of truth. */
	setupLabel: string;
}): string {
	if (input.blockerCount > 0) {
		const item = input.blockerCount === 1 ? 'item' : 'items';
		return `${input.setupLabel} before ATLAS can generate a timetable. ${input.blockerCount} setup ${item} must be fixed first, and the readiness chip below lists each one with the place to fix it.`;
	}
	return `${input.setupLabel} before ATLAS can generate a timetable. The schedule check did not finish, so nothing can be listed. Retry the check to see where it stands.`;
}

export type ExpectedGenerationScope = {
	schoolId: number | null;
	schoolYearId: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseBlocker(raw: unknown): TimetableGenerationBlocker | null {
	if (!isRecord(raw)) return null;
	const code = asString(raw.code);
	if (!code) return null;
	return {
		code,
		category: asString(raw.category) ?? 'DATA_GAP',
		termIdentity: asString(raw.termIdentity),
		sectionId: asFiniteNumber(raw.sectionId),
		subjectId: asFiniteNumber(raw.subjectId),
		subjectCode: asString(raw.subjectCode),
		entity: asString(raw.entity) ?? code,
		reason: asString(raw.reason) ?? 'Generation is blocked by this item.',
		owningSurface: asString(raw.owningSurface) ?? 'Setup',
		nextAction: asString(raw.nextAction) ?? 'Resolve this item, then check generation readiness again.',
	};
}

function parseTeachingLoadCoverage(raw: unknown): TimetableTeachingLoadCoverage | null {
	if (!isRecord(raw)) return null;
	return {
		requiredPairs: asFiniteNumber(raw.requiredPairs) ?? 0,
		ownedPairs: asFiniteNumber(raw.ownedPairs) ?? 0,
		missingPairs: asFiniteNumber(raw.missingPairs) ?? 0,
		inactiveOrStalePairs: asFiniteNumber(raw.inactiveOrStalePairs) ?? 0,
		outsideScopePairs: asFiniteNumber(raw.outsideScopePairs) ?? 0,
	};
}

function parseTermStructure(raw: unknown): TimetableGenerationReadinessDiagnostic['termStructure'] {
	if (!isRecord(raw)) return null;
	const format = asString(raw.format) ?? 'TRIMESTER';
	const terms = Array.isArray(raw.terms)
		? raw.terms.reduce<Array<{ identity: string; order: number }>>((acc, entry) => {
			if (!isRecord(entry)) return acc;
			const identity = asString(entry.identity);
			const order = asFiniteNumber(entry.order);
			if (identity && order !== null) acc.push({ identity, order });
			return acc;
		}, [])
		: [];
	return { format, terms };
}

function parseTotals(raw: unknown): TimetableGenerationReadinessDiagnostic['totals'] {
	if (!isRecord(raw)) return { lines: 0, pairs: 0, sessionsByTerm: {} };
	const sessionsRaw = isRecord(raw.sessionsByTerm) ? raw.sessionsByTerm : {};
	const sessionsByTerm: Record<string, number> = {};
	for (const [key, value] of Object.entries(sessionsRaw)) {
		const numeric = asFiniteNumber(value);
		if (numeric !== null) sessionsByTerm[key] = numeric;
	}
	return {
		lines: asFiniteNumber(raw.lines) ?? 0,
		pairs: asFiniteNumber(raw.pairs) ?? 0,
		sessionsByTerm,
	};
}

/**
 * Parse an unknown diagnostic payload into the client model. Returns null when
 * the payload is not a usable diagnostic (caller maps to failed/unavailable).
 * Every field is validated before it is trusted.
 */
export function parseGenerationReadinessDiagnostic(raw: unknown): TimetableGenerationReadinessDiagnostic | null {
	if (!isRecord(raw)) return null;
	const scopeRaw = isRecord(raw.scope) ? raw.scope : null;
	// A diagnostic without a usable scope object cannot be trusted or bound to
	// the actor's school/year: treat it as unreadable rather than ready.
	if (!scopeRaw) return null;
	const generateAllowed = raw.generateAllowed === true;
	const databaseSignature = isRecord(raw.databaseSignature) ? raw.databaseSignature : null;
	const zeroWrite = raw.zeroWrite === true || databaseSignature?.zeroWrite === true;
	const blockers = Array.isArray(raw.blockers)
		? raw.blockers.reduce<TimetableGenerationBlocker[]>((acc, entry) => {
			const parsed = parseBlocker(entry);
			if (parsed) acc.push(parsed);
			return acc;
		}, [])
		: [];
	return {
		scope: {
			schoolId: scopeRaw ? asFiniteNumber(scopeRaw.schoolId) : null,
			schoolYearId: scopeRaw ? asFiniteNumber(scopeRaw.schoolYearId) : null,
		},
		status: asString(raw.status) ?? (generateAllowed ? 'READY' : 'BLOCKED'),
		generateAllowed,
		schedulerExecuted: raw.schedulerExecuted === true || isRecord(raw.scheduler) && raw.scheduler.ran === true,
		derivedDemandRevision: asString(raw.derivedDemandRevision),
		termStructure: parseTermStructure(raw.termStructure),
		totals: parseTotals(raw.totals),
		teachingLoadCoverage: parseTeachingLoadCoverage(raw.teachingLoadCoverage),
		blockers,
		zeroWrite,
	};
}

/** The one smallest repair for the exact first blocker, chosen by owning code
 * then category. Never the retired requirements page and never a self-link back
 * to the route that already rendered the blocked state. */
export function deriveTimetableReadinessRepair(blocker: TimetableGenerationBlocker | null): TimetableReadinessRepair {
	if (!blocker) return { kind: 'navigate', label: 'Open Year Setup', href: '/admin/year-setup' };
	const code = blocker.code.toUpperCase();
	if (code.includes('OWNERSHIP') || code.includes('OWNER') || code.includes('TEACHING_LOAD')) {
		return { kind: 'navigate', label: 'Open Teaching Load', href: '/teaching-load' };
	}
	if (code.includes('ROOM') || blocker.category === 'RESOURCE_INFEASIBLE') {
		return { kind: 'navigate', label: 'Review rooms', href: '/map' };
	}
	if (blocker.category === 'ALGORITHM_LIMIT') {
		// The bounded scheduler search could not place the session (the server
		// owning surface is the generation algorithm itself, with "re-run
		// readiness after data/policy fixes" as its next action). Re-running the
		// readiness check in place is the only real repair here; navigating to
		// the current /timetable route would be a no-op self-link.
		return { kind: 'retry', label: 'Recheck generation readiness' };
	}
	return { kind: 'navigate', label: 'Open Year Setup', href: '/admin/year-setup' };
}

function describeBlocker(blocker: TimetableGenerationBlocker): string {
	const parts = [`${blocker.entity}: ${blocker.reason}`];
	if (blocker.nextAction) parts.push(blocker.nextAction);
	return parts.join(' ');
}

function blockedMessage(
	diagnostic: TimetableGenerationReadinessDiagnostic,
): { message: string; code: string | null; repair: TimetableReadinessRepair } {
	const first = diagnostic.blockers[0] ?? null;
	if (first) {
		return { message: describeBlocker(first), code: first.code, repair: deriveTimetableReadinessRepair(first) };
	}
	if (!diagnostic.zeroWrite) {
		return {
			message: 'Generation readiness could not prove a zero-write check. Retry the readiness check before generating.',
			code: 'ZERO_WRITE_UNPROVEN',
			repair: { kind: 'retry', label: 'Retry readiness check' },
		};
	}
	if (!diagnostic.schedulerExecuted) {
		return {
			message: 'The scheduling dry run did not complete. Retry the readiness check before generating.',
			code: 'SCHEDULER_NOT_EXECUTED',
			repair: { kind: 'retry', label: 'Retry readiness check' },
		};
	}
	return {
		message: 'Generation readiness is blocked. Resolve the reported setup items, then check again.',
		code: 'GENERATION_BLOCKED',
		repair: { kind: 'navigate', label: 'Open Year Setup', href: '/admin/year-setup' },
	};
}

/**
 * UX-C01R — the sole client gate from the canonical generation diagnostic.
 *
 * A diagnostic is `ready` only when it is present, belongs to the exact
 * expected actor school/year, `generateAllowed === true`, the zero-write proof
 * is true, the scheduler dry run executed, and there are no blocking items.
 * Everything else is `blocked` with exactly one repair, or `failed`/
 * `unavailable` when the payload cannot be trusted. A previous ready result is
 * never reused for a failed/unavailable or out-of-scope read.
 */
export function deriveGenerationReadinessState(
	rawDiagnostic: unknown,
	expected: ExpectedGenerationScope,
): TimetableCurriculumReadinessState {
	const diagnostic = parseGenerationReadinessDiagnostic(rawDiagnostic);
	if (!diagnostic) {
		return { state: 'failed', message: 'Generation readiness could not be read. Retry before generating.' };
	}

	const expectedSchoolId = expected.schoolId;
	const expectedSchoolYearId = expected.schoolYearId;
	if (expectedSchoolId === null || expectedSchoolYearId === null) {
		return { state: 'unavailable', message: 'Your school and school year scope could not be verified.' };
	}
	if (diagnostic.scope.schoolId !== expectedSchoolId || diagnostic.scope.schoolYearId !== expectedSchoolYearId) {
		return {
			state: 'unavailable',
			message: 'Generation readiness was returned for a different school or school year. Refresh before generating.',
		};
	}

	const clean = diagnostic.blockers.length === 0;
	if (diagnostic.generateAllowed === true && diagnostic.zeroWrite === true && diagnostic.schedulerExecuted && clean) {
		const line = diagnostic.totals.lines;
		const pair = diagnostic.totals.pairs;
		return {
			state: 'ready',
			message: `Generation readiness verified: ${pair} subject-section pair${pair === 1 ? '' : 's'}, ${line} session${line === 1 ? '' : 's'} checked with zero writes.`,
			diagnostic,
		};
	}

	const { message, code, repair } = blockedMessage(diagnostic);
	return { state: 'blocked', message, code, repair, diagnostic };
}

/** Compact gate view used by the capability model. */
export function summarizeGenerationReadiness(
	readiness: TimetableCurriculumReadinessState | null | undefined,
): TimetableReadinessDiagnosticSummary | null {
	if (!readiness || readiness.state !== 'ready') return null;
	return {
		generateAllowed: readiness.diagnostic.generateAllowed,
		zeroWrite: readiness.diagnostic.zeroWrite,
		blockerCount: readiness.diagnostic.blockers.length,
	};
}
