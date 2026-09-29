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

/**
 * A8 C3 — one ROOT CAUSE, counted in classes.
 *
 * The server folds 570 session rows and 50 pair rows of the same 50 unstaffed
 * classes into ONE of these. `count` is always classes (or distinct items for a
 * year-wide cause); `sessionCount` is the raw row count it folds and is never
 * used as a headline.
 */
export type TimetableGenerationBlockerGroup = {
	cause: string;
	code: string;
	codes: string[];
	count: number;
	sessionCount: number;
	unit: 'classes' | 'items';
	examples: string[];
	action: { label: string; target: string };
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
	/** The COMPLETE row list. It is the disclosed detail, and it is never the gate. */
	blockers: TimetableGenerationBlocker[];
	/**
	 * A8 C3 — the BLOCKING count. This, not `blockers.length`, is what the server
	 * gate reads. Absent on a payload from before the split, in which case the
	 * adapter falls back to `blockers.length` so an old payload fails closed.
	 */
	blockerCount: number;
	/** GAP rows: a setup fact the run carries and names. */
	gaps: TimetableGenerationBlocker[];
	gapCount: number;
	/** Distinct classes among the gaps. */
	gapClassCount: number;
	/** One entry per root cause, counted in classes, deterministic order. */
	groups: TimetableGenerationBlockerGroup[];
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
	/**
	 * A8 C3 — the BLOCKING count. Carried for reporting ONLY. The capability gate
	 * reads `generateAllowed`/`zeroWrite`: a raw count must never independently
	 * block, because 620 of the operator's 651 live rows were one fact at two
	 * grains.
	 */
	blockerCount: number;
	/** A8 C3 — gap rows and the classes among them, reported not gated. */
	gapCount: number;
	gapClassCount: number;
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
 * A8 C3 — the operator sentence for a blocked generation.
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

/* ------------------------------------------------------------------ *
 * A8 C3 — one line per ROOT CAUSE
 * ------------------------------------------------------------------ */

export type TimetableGenerationBlockerGroupPresentation = {
	/** Stable row key. Carries no engine text into the DOM. */
	key: string;
	/** Plain headline with the CLASS count. Never a code or a session count. */
	headline: string;
	/** The examples sentence, or null when the server named none. */
	detail: string | null;
	/**
	 * A8 C3 ITEM 8: the real repair for this root cause, and it is always a
	 * `navigate` to the surface that fixes that cause. The type is narrowed
	 * deliberately: an in-place recheck is a PANEL-level control, and modelling it
	 * per group would have produced a dead branch in the rendered list.
	 */
	action: { kind: 'navigate'; label: string; href: string };
};

const GENERIC_CAUSE_PHRASE = 'need attention';

/**
 * The noun and the verb for one root cause, so the line reads as a sentence an
 * older scheduler can act on: "50 classes need a teacher", "4 teachers are over
 * their weekly limit". The COUNT is the server's; only the wording is here.
 */
const GROUP_CAUSE_COPY: Record<string, { noun: string; verb: string }> = {
	TEACHER_COVERAGE_GAP: { noun: 'classes', verb: 'need a teacher' },
	FACULTY_OVERLOAD: { noun: 'teachers', verb: 'are over their weekly limit' },
	WORKLOAD_POLICY_BLOCK: { noun: 'classes', verb: 'have no free period with their teacher' },
	FACULTY_SUBJECT_NOT_QUALIFIED: { noun: 'classes', verb: 'are with a teacher outside their subjects' },
	ROOM_RESOURCE_UNAVAILABLE: { noun: 'classes', verb: 'have no suitable room' },
	TL_OWNERSHIP_CONFLICT: { noun: 'classes', verb: 'have more than one teacher' },
	TEACHING_LOAD_REVIEW_REQUIRED: { noun: 'classes', verb: 'have no teaching load yet' },
};

/**
 * A8 C3 — present one line per root cause, counted in CLASSES.
 *
 * The 651-row live list becomes a handful of lines, and the headline count is
 * the class count an operator can act on. A server payload with no groups (an
 * older server) falls back to ONE line derived from the raw rows, so the panel
 * can never render an empty list beside a non-empty blocker array.
 */
export function presentGenerationBlockerGroups(input: {
	diagnostic: TimetableGenerationReadinessDiagnostic;
	labelForSection?: (id: number) => string;
}): TimetableGenerationBlockerGroupPresentation[] {
	const { diagnostic } = input;
	if (diagnostic.groups.length > 0) {
		return diagnostic.groups.map((group, index) => ({
			key: `generation-blocker-group-${group.cause}-${index}`,
			headline: groupHeadline(group),
			detail: group.examples.length > 0 ? `For example: ${group.examples.join(', ')}.` : null,
			action: { kind: 'navigate', label: group.action.label, href: group.action.target },
		}));
	}
	return [{
		key: 'generation-blocker-group-legacy',
		headline: `${diagnostic.blockerCount} ${diagnostic.blockerCount === 1 ? 'item needs' : 'items need'} ${GENERIC_CAUSE_PHRASE}`,
		detail: null,
		action: { kind: 'navigate', label: 'Open Year Setup', href: '/admin/year-setup' },
	}];
}

function groupHeadline(group: TimetableGenerationBlockerGroup): string {
	const copy = GROUP_CAUSE_COPY[group.cause];
	if (!copy) return `${group.count} ${group.count === 1 ? 'item' : 'items'} ${GENERIC_CAUSE_PHRASE}`;
	// The server has already counted THIS group in classes, so the line reads
	// `group.count`. It must not borrow the panel-wide `gapClassCount`: that is a
	// different population (every class in any gap), and a group that is not the
	// whole coverage cause would otherwise print someone else's number.
	return `${group.count} ${group.count === 1 ? singular(copy.noun) : copy.noun} ${copy.verb}`;
}

function singular(noun: string): string {
	if (noun.endsWith('es')) return noun.slice(0, -2);
	if (noun.endsWith('s')) return noun.slice(0, -1);
	return noun;
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

function parseBlockerGroups(raw: unknown): TimetableGenerationBlockerGroup[] {
	if (!Array.isArray(raw)) return [];
	return raw.reduce<TimetableGenerationBlockerGroup[]>((acc, entry) => {
		if (!isRecord(entry)) return acc;
		const cause = asString(entry.cause);
		const action = isRecord(entry.action) ? entry.action : null;
		const target = action ? asString(action.target) : null;
		if (!cause || !target) return acc;
		const count = asFiniteNumber(entry.count);
		if (count === null) return acc;
		acc.push({
			cause,
			code: asString(entry.code) ?? cause,
			codes: Array.isArray(entry.codes) ? entry.codes.filter((value): value is string => typeof value === 'string') : [],
			count,
			sessionCount: asFiniteNumber(entry.sessionCount) ?? count,
			unit: entry.unit === 'classes' ? 'classes' : 'items',
			examples: Array.isArray(entry.examples) ? entry.examples.filter((value): value is string => typeof value === 'string') : [],
			action: { label: asString(action?.label) ?? 'Open Year Setup', target },
		});
		return acc;
	}, []);
}

function parseBlockers(raw: unknown): TimetableGenerationBlocker[] {
	if (!Array.isArray(raw)) return [];
	return raw.reduce<TimetableGenerationBlocker[]>((acc, entry) => {
		const parsed = parseBlocker(entry);
		if (parsed) acc.push(parsed);
		return acc;
	}, []);
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
	const blockers = parseBlockers(raw.blockers);
	const gaps = parseBlockers(raw.gaps);
	const serverBlockerCount = asFiniteNumber(raw.blockerCount);
	// A payload from before the A8 C3 split carries no `blockerCount`. Falling back
	// to the row count there FAILS CLOSED: an old payload blocks exactly as it did
	// before, and only a payload that states its blocking count can allow a run
	// with gaps.
	const blockerCount = serverBlockerCount ?? blockers.length;
	const gapCount = asFiniteNumber(raw.gapCount) ?? gaps.length;
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
		blockerCount,
		gaps,
		gapCount,
		gapClassCount: asFiniteNumber(raw.gapClassCount) ?? gaps.length,
		groups: parseBlockerGroups(raw.groups),
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
 * is true, the scheduler dry run executed, and it reports no BLOCKING items.
 * A8 C3: "no blocking items" is the server's `blockerCount`, not
 * `blockers.length` — a teacher gap is a setup fact the run carries and names,
 * and it must not read as "setup needs attention". Everything else is `blocked`
 * with exactly one repair, or `failed`/`unavailable` when the payload cannot be
 * trusted. A previous ready result is never reused for a failed/unavailable or
 * out-of-scope read.
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

	// A8 C3 — `blockerCount` is the BLOCKING count the server computed. When the
	// payload carries none, the parser already fell back to the raw row count, so
	// this fails closed for an older payload.
	const clean = diagnostic.blockerCount === 0;
	if (diagnostic.generateAllowed === true && diagnostic.zeroWrite === true && diagnostic.schedulerExecuted && clean) {
		const line = diagnostic.totals.lines;
		const pair = diagnostic.totals.pairs;
		if (diagnostic.gapClassCount > 0) {
			const classes = diagnostic.gapClassCount;
			const noun = classes === 1 ? 'class' : 'classes';
			return {
				state: 'ready',
				message: `Generation readiness verified: ${pair} subject-section pair${pair === 1 ? '' : 's'}, ${line} session${line === 1 ? '' : 's'} checked with zero writes. ${classes} ${noun} still need a teacher and will be listed in the schedule.`,
				diagnostic,
			};
		}
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
	if (!readiness || (readiness.state !== 'ready' && readiness.state !== 'blocked')) return null;
	return {
		generateAllowed: readiness.diagnostic.generateAllowed,
		zeroWrite: readiness.diagnostic.zeroWrite,
		blockerCount: readiness.diagnostic.blockerCount,
		gapCount: readiness.diagnostic.gapCount,
		gapClassCount: readiness.diagnostic.gapClassCount,
	};
}
