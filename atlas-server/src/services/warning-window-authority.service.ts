/**
 * TT-WARNING-REALISM-C07A — configured non-teaching (break) windows and the
 * teaching-shift window authority consumed by the constraint validator.
 *
 * The validator must never treat a configured break as idle time and must never
 * count time outside a teacher's applicable shift as idle. Both authorities are
 * derived here from sources that already exist in every real validator-context
 * builder — the persisted scheduling policy row, `PolicySpecialEvent` rows, the
 * persisted `GradeShiftWindow` rows, and the section roster (school/year
 * section snapshot). No new store is introduced.
 *
 * Contract:
 *   - `breakWindows` are the configured non-teaching windows: recess, lunch,
 *     flag ceremony (policy row) plus the shift-specific `PolicySpecialEvent`
 *     break rows (`HEALTH_BREAK`, `LUNCH_BREAK`, `CUSTOM`).
 *   - `shiftWindows` are the teaching-shift windows a teacher is engaged for.
 *   - `sectionScope` maps a section to the grade/program scope used to resolve
 *     which window applies to an entry.
 *
 * A window with `gradeLevel`/`programType` set applies only inside that exact
 * scope; an unscoped window applies to every scope. `dayOfWeek` is null when the
 * window applies to every weekday (an absent `PolicySpecialEvent.dayOfWeek`
 * column resolves through `resolveSpecialEventDayOfWeek`).
 */

import {
	getEffectiveEvents,
	isFlagCeremonyEvent,
	resolveSpecialEventDayOfWeek,
	type SpecialEventRowLike,
} from '../lib/policy-special-events.js';

// ─── Public shapes ───

export interface BreakWindowRef {
	/** Authority identity: `RECESS` | `LUNCH_BREAK` | `FLAG_OR_HGP` | `HEALTH_BREAK` | `CUSTOM`. */
	eventType: string;
	label: string;
	startTime: string;
	endTime: string;
	/** Scope filter — null means "every scope". */
	gradeLevel: number | null;
	programType: string | null;
	/** Weekday filter — null means "every weekday". */
	dayOfWeek: string | null;
}

export interface ShiftWindowRef {
	startTime: string;
	endTime: string;
	/** Scope filter — null means "every scope". */
	gradeLevel: number | null;
	programType: string | null;
}

export interface SectionScopeRef {
	gradeLevel: number;
	programType: string | null;
}

export interface WarningWindowPolicyRow {
	enableRecess?: unknown;
	recessStartTime?: unknown;
	recessEndTime?: unknown;
	enableLunchWindow?: unknown;
	lunchStartTime?: unknown;
	lunchEndTime?: unknown;
	enableFlagCeremony?: unknown;
	flagCeremonyStartTime?: unknown;
	flagCeremonyEndTime?: unknown;
}

export interface SectionScopeSource {
	id: number;
	gradeLevel: number;
	programType?: string | null;
}

export interface GradeShiftWindowSource {
	gradeLevel?: number | null;
	programType?: string | null;
	startTime: string;
	endTime: string;
}

export interface WarningWindowAuthority {
	breakWindows: BreakWindowRef[];
	shiftWindows: ShiftWindowRef[];
	sectionScope: Map<number, SectionScopeRef>;
}

// ─── Helpers ───

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isTime(value: unknown): value is string {
	return typeof value === 'string' && HH_MM.test(value);
}

export function normalizeWarningProgramType(value: unknown): string | null {
	if (typeof value !== 'string' || value.trim().length === 0) return null;
	return value.trim().toUpperCase();
}

function windowKey(startTime: string, endTime: string): string {
	return `${startTime}-${endTime}`;
}

/**
 * Persisted policy-row non-teaching windows. Gated by the same enable flags the
 * constructor/grid already honor, so a disabled window is never excluded here.
 */
export function resolvePolicyRowBreakWindows(
	policyRow: WarningWindowPolicyRow | null | undefined,
): BreakWindowRef[] {
	const row = policyRow ?? {};
	const windows: BreakWindowRef[] = [];

	if (row.enableRecess === true && isTime(row.recessStartTime) && isTime(row.recessEndTime)) {
		windows.push({
			eventType: 'RECESS',
			label: 'Recess',
			startTime: row.recessStartTime,
			endTime: row.recessEndTime,
			gradeLevel: null,
			programType: null,
			dayOfWeek: null,
		});
	}

	if (row.enableLunchWindow === true && isTime(row.lunchStartTime) && isTime(row.lunchEndTime)) {
		windows.push({
			eventType: 'LUNCH_BREAK',
			label: 'Lunch Break',
			startTime: row.lunchStartTime,
			endTime: row.lunchEndTime,
			gradeLevel: null,
			programType: null,
			dayOfWeek: null,
		});
	}

	if (row.enableFlagCeremony === true && isTime(row.flagCeremonyStartTime) && isTime(row.flagCeremonyEndTime)) {
		windows.push({
			eventType: 'FLAG_OR_HGP',
			label: 'Flag Ceremony',
			startTime: row.flagCeremonyStartTime,
			endTime: row.flagCeremonyEndTime,
			gradeLevel: null,
			programType: null,
			// Flag/HGP is Monday-only authority (R3); the policy row has no day column.
			dayOfWeek: 'MONDAY',
		});
	}

	return windows;
}

/**
 * Effective `PolicySpecialEvent` break rows for one grade/program scope.
 * Resolution reuses the constructor's `getEffectiveEvents` priority so the
 * validator and the shape contract never disagree about which row applies.
 */
export function resolveSpecialEventBreakWindows(
	specialEvents: SpecialEventRowLike[] | null | undefined,
	gradeLevel: number,
	programType: string | null,
): BreakWindowRef[] {
	if (!specialEvents || specialEvents.length === 0) return [];
	return getEffectiveEvents(specialEvents, gradeLevel, programType)
		// Flag/HGP is policy-row owned; the policy row is the flag authority.
		.filter((event) => !isFlagCeremonyEvent(event.eventType, event.label))
		.map((event) => ({
			eventType: String(event.eventType).trim().toUpperCase(),
			label: event.label,
			startTime: event.startTime,
			endTime: event.endTime,
			gradeLevel,
			programType,
			dayOfWeek: resolveSpecialEventDayOfWeek(event.eventType, event.dayOfWeek ?? null, event.label),
		}));
}

/** Deduplicated break windows for one grade/program scope. */
export function resolveBreakWindowsForScope(args: {
	policyRow?: WarningWindowPolicyRow | null;
	specialEvents?: SpecialEventRowLike[] | null;
	gradeLevel: number;
	programType: string | null;
}): BreakWindowRef[] {
	const candidates = [
		...resolvePolicyRowBreakWindows(args.policyRow),
		...resolveSpecialEventBreakWindows(args.specialEvents, args.gradeLevel, args.programType),
	];

	const seen = new Set<string>();
	const windows: BreakWindowRef[] = [];
	for (const window of candidates) {
		const key = `${window.eventType}:${windowKey(window.startTime, window.endTime)}:${window.dayOfWeek ?? '*'}`;
		if (seen.has(key)) continue;
		seen.add(key);
		// A policy-row window is unscoped; a special-event window is already scoped
		// to this grade/program, so carry the exact scope for deterministic matching.
		windows.push(window);
	}
	return windows.sort((left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime));
}

function scopeKey(scope: SectionScopeRef): string {
	return `${scope.gradeLevel}:${scope.programType ?? '*'}`;
}

/**
 * Build the full window authority for a roster. One break window set is
 * resolved per distinct (gradeLevel, programType) scope so the validator can
 * match an entry's scope exactly instead of re-deriving priority order.
 */
export function buildWarningWindowAuthority(args: {
	sections: SectionScopeSource[];
	policyRow?: WarningWindowPolicyRow | null;
	specialEvents?: SpecialEventRowLike[] | null;
	shiftWindows?: GradeShiftWindowSource[] | null;
}): WarningWindowAuthority {
	const sectionScope = new Map<number, SectionScopeRef>();
	for (const section of args.sections) {
		if (!Number.isInteger(section.id)) continue;
		sectionScope.set(section.id, {
			gradeLevel: section.gradeLevel,
			programType: normalizeWarningProgramType(section.programType),
		});
	}

	const scopes = new Map<string, SectionScopeRef>();
	for (const scope of sectionScope.values()) scopes.set(scopeKey(scope), scope);

	const breakWindows: BreakWindowRef[] = [];
	for (const scope of scopes.values()) {
		breakWindows.push(...resolveBreakWindowsForScope({
			policyRow: args.policyRow,
			specialEvents: args.specialEvents,
			gradeLevel: scope.gradeLevel,
			programType: scope.programType,
		}));
	}

	const shiftWindows: ShiftWindowRef[] = (args.shiftWindows ?? [])
		.filter((window) => isTime(window.startTime) && isTime(window.endTime))
		.map((window) => ({
			startTime: window.startTime,
			endTime: window.endTime,
			gradeLevel: typeof window.gradeLevel === 'number' ? window.gradeLevel : null,
			programType: normalizeWarningProgramType(window.programType),
		}));

	return { breakWindows, shiftWindows, sectionScope };
}
