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
// A8-C5 S2.2: the ONE code → sentence → route table. Every headline and every
// fix button in the blocker panel is composed from it, so there is no second
// copy of this vocabulary anywhere in the client.
import { BLOCKER_CODE_COPY, blockerFixAction, blockerSentence } from './timetable-blocker-code-copy';

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

/**
 * A8 C5 CORRECTION 2 (F4) — HOW MANY READS ACTUALLY HAPPENED.
 *
 * `unavailable` and `failed` are reached by two genuinely different roads, and
 * telling them apart by the state name is what made the dialog claim "ATLAS
 * already tried this check twice" on a path that tried ZERO times:
 *
 *  - the scope guard refused before any read, so nothing was attempted;
 *  - a read (or its single automatic retry) did not come back.
 *
 * `attempts` is therefore carried as a FACT on the state the retry module
 * publishes, never inferred from `state`. It is absent (not 0) on a state that
 * did not come from a read, so "no attempt" and "one attempt" cannot be
 * confused with "two attempts".
 */
export type TimetableReadinessAttemptCount = number;

/**
 * Read the attempt fact off a readiness state WITHOUT narrowing on `state`.
 *
 * A direct `readiness?.attempts` does not type-check, because only the
 * `unavailable` and `failed` members carry it and the union is not narrowed at
 * the call site. This is the one place the fact is read, and it is deliberately
 * total: a `loading` or `ready` state has no attempts and reads as `null`, which
 * is the honest "no read finished" answer rather than a silent zero.
 */
export function readReadinessAttempts(
	state: TimetableCurriculumReadinessState | null | undefined,
): TimetableReadinessAttemptCount | null {
	if (!state) return null;
	if (state.state !== 'unavailable' && state.state !== 'failed') return null;
	return typeof state.attempts === 'number' ? state.attempts : null;
}

export type TimetableCurriculumReadinessState =
	| { state: 'loading'; message: string }
	| { state: 'ready'; message: string; diagnostic: TimetableGenerationReadinessDiagnostic }
	| { state: 'blocked'; message: string; code: string | null; repair: TimetableReadinessRepair; diagnostic: TimetableGenerationReadinessDiagnostic }
	| { state: 'unavailable'; message: string; attempts?: TimetableReadinessAttemptCount }
	| { state: 'failed'; message: string; attempts?: TimetableReadinessAttemptCount };

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

/**
 * The fallback noun for a cause the table does not know, and for the
 * groups-less legacy line. It is the COMPLEMENT of the verb the caller already
 * supplies ("items need …"), so the sentence reads once. A8-C5 S2.0 fixed the
 * previous pair, which produced "2 items need need attention".
 */
const GENERIC_CAUSE_PHRASE = 'need attention';
/** The bare noun, for the call sites that already carry the verb themselves. */
const LEGACY_CAUSE_NOUN = 'attention';

/**
 * A8-C5 S2.2 — the representative CODE for one root cause: the first code the
 * shared table knows among the group's own codes.
 *
 * A folded group (the two coverage codes, the placeholder state) carries several
 * codes and therefore ONE line, so exactly one of them speaks for the line. It
 * is chosen from the group, never from a private list, so the headline and the
 * button below are guaranteed to describe the same cause.
 *
 * Null means the table knows none of this group's codes. That is a defect the A7
 * table test fails on; the panel still renders (a scheduler must not meet a blank
 * panel because the server grew a code), and says so in plain words.
 *
 * A group field is guarded with `Array.isArray` for the same reason
 * `presentGenerationBlockerGroups` guards `groups` (A8-C5 S2.0): this function
 * is reachable with a diagnostic a caller BUILT rather than parsed — a payload
 * whose group predates the `codes` field, or a fixture — and the parser's
 * defaults are not a guarantee to code outside the parser. The single-code
 * fallback below is what keeps such a group on its real, counted sentence.
 */
export function representativeBlockerCode(group: TimetableGenerationBlockerGroup): string | null {
	const codes = Array.isArray(group.codes) ? group.codes : [];
	return codes.find((code) => Object.prototype.hasOwnProperty.call(BLOCKER_CODE_COPY, code))
		?? (Object.prototype.hasOwnProperty.call(BLOCKER_CODE_COPY, group.code) ? group.code : null);
}

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
	// A8-C5 S2.0: `groups` is guarded, exactly as the comment above promises. A
	// diagnostic built by a test fixture, an older payload, or any caller that
	// omits the field must take the legacy one-line fallback, not throw on
	// `.length` of undefined. `Array.isArray` is the single guard: a non-array
	// `groups` is treated as empty, and the fallback below names the count it can
	// actually measure (`blockerCount`).
	const groups = Array.isArray(diagnostic.groups) ? diagnostic.groups : [];
	if (groups.length > 0) {
		return groups.map((group, index) => {
			// A8-C5 S2.2, same rule as `groups` above and for the same reason: the
			// examples are optional detail, so an absent or malformed field costs
			// the "For example" clause and nothing else. It must never cost the
			// line.
			const examples = Array.isArray(group.examples)
				? group.examples.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
				: [];
			return {
				key: `generation-blocker-group-${group.cause}-${index}`,
				headline: groupHeadline(group),
				detail: examples.length > 0 ? `For example: ${examples.join(', ')}.` : null,
				action: groupFixAction(group),
			};
		});
	}
	// A8-C5 S2.0: the fallback line. The verb is spelled out here, so the phrase
	// constant is the COMPLEMENT ("attention", not "need attention") — the previous
	// pair rendered "2 items need need attention", a doubled word a scheduler reads
	// on the one line this fallback produces.
	return [{
		key: 'generation-blocker-group-legacy',
		headline: `${diagnostic.blockerCount} ${diagnostic.blockerCount === 1 ? 'item needs' : 'items need'} ${LEGACY_CAUSE_NOUN}`,
		detail: null,
		action: { kind: 'navigate', label: 'Open Year Setup', href: '/admin/year-setup' },
	}];
}

/**
 * A8-C5 S2.2 — ONE fix button per cause, resolved from the ONE table.
 *
 * Before this, `GROUP_CAUSE_COPY` (the headline, here), `actionForCause` (the
 * server) and `deriveTimetableReadinessRepair` (here) each decided what a code
 * meant and where it is fixed, and they could disagree — a headline about
 * teaching load could sit above a button that opened rooms. The table is now the
 * single authority for the PANEL: the same representative code that supplies the
 * sentence supplies the route and the label, so a line and its button cannot
 * describe two different problems.
 *
 * The server's own `group.action` remains the FALLBACK for a code the table does
 * not carry. It is a real mounted route, so the line keeps working; the missing
 * table row is a defect the A7 test fails on, which is where it belongs — not in
 * a blank panel in front of a scheduler.
 */
function groupFixAction(group: TimetableGenerationBlockerGroup): TimetableGenerationBlockerGroupPresentation['action'] {
	const representative = representativeBlockerCode(group);
	const fromTable = representative === null ? null : blockerFixAction(representative);
	if (fromTable) return { kind: 'navigate', label: fromTable.label, href: fromTable.href };
	return { kind: 'navigate', label: group.action.label, href: group.action.target };
}

/**
 * A8-C5 S2.2 — the headline for a group, composed from the ONE shared
 * code→sentence table. The count is the server's; the words and the unit are the
 * table's, so a line can never read as a session count or a bare number.
 */
function groupHeadline(group: TimetableGenerationBlockerGroup): string {
	// The server has already counted THIS group in classes, so the line reads
	// `group.count`. It must not borrow the panel-wide `gapClassCount`: that is a
	// different population (every class in any gap), and a group that is not the
	// whole coverage cause would otherwise print someone else's number.
	//
	// A folded group (the two coverage codes) has several codes; the FIRST one the
	// table knows is the representative sentence, and because both coverage codes
	// share one table row they produce the SAME words — one line, not two.
	const representative = representativeBlockerCode(group);
	if (representative) {
		const sentence = blockerSentence(representative, group.count);
		assertPlainGroupSentence(sentence, group);
		return sentence;
	}
	return `${group.count} ${group.count === 1 ? 'item' : 'items'} ${GENERIC_CAUSE_PHRASE}`;
}

/**
 * A rendered headline must never leak a raw engine token or a truncated name
 * (AGENTS.md §8). The shared table's own test proves this per code; this is the
 * RENDERED guard, so a future edit that bypasses the table is caught here too.
 */
function assertPlainGroupSentence(sentence: string, group: TimetableGenerationBlockerGroup): void {
	if (/\b[A-Z][A-Z0-9_]{5,}\b/.test(sentence) || sentence.includes('…') || sentence.includes('..')) {
		throw new Error(
			`blocker group "${group.cause}" rendered a non-plain headline: ${JSON.stringify(sentence)}. `
			+ 'A scheduler-facing line must be words, never a code, an id or a truncated name.',
		);
	}
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

/**
 * Compact gate view used by the capability model.
 *
 * A8-C5 S2.3 FOLLOW-UP (executor finding, 2026-09-29) — FAIL CLOSED INSTEAD OF
 * THROWING. This read `readiness.diagnostic.generateAllowed` unguarded, so a
 * readiness a caller BUILT rather than one `deriveGenerationReadinessState`
 * produced — a hand-written `{ state: 'ready' }`, a test fixture, a restored
 * cached value from an older shape — threw a `TypeError` where every other
 * capability derivation in this lane returns an answer. A summary that cannot be
 * read is an UNVERIFIED decision, and the capability model already has an
 * honest rendering for that: `generationStoppers` names it as
 * `readiness-unverified` and the Generate dialog explains it. Throwing here
 * instead took the whole header down.
 *
 * This is the same rule `presentGenerationBlockerGroups` already applies to
 * `groups` (A8-C5 S2.0) for the same reason: the parser's defaults are a
 * guarantee about the parser, not about code outside it. `null` is the correct
 * answer here — it is exactly what an `unavailable`/`failed`/`loading`
 * readiness already returns, so the caller needs no new branch.
 */
export function summarizeGenerationReadiness(
	readiness: TimetableCurriculumReadinessState | null | undefined,
): TimetableReadinessDiagnosticSummary | null {
	if (!readiness || (readiness.state !== 'ready' && readiness.state !== 'blocked')) return null;
	// The union says `diagnostic` is present on these two states, so this is
	// narrowed away by the type system; the runtime check is deliberate. The
	// read is untyped in practice because a `TimetableCurriculumReadinessState`
	// is rebuilt by hand in fixtures and restored from cache, and a guard that
	// only the compiler can see is not a guard.
	const diagnostic: TimetableGenerationReadinessDiagnostic | undefined = readiness.diagnostic;
	if (!diagnostic || typeof diagnostic !== 'object') return null;
	return {
		generateAllowed: diagnostic.generateAllowed,
		zeroWrite: diagnostic.zeroWrite,
		blockerCount: diagnostic.blockerCount,
		gapCount: diagnostic.gapCount,
		gapClassCount: diagnostic.gapClassCount,
	};
}
