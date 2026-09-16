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
import {
	resolveCanonicalSlotsFromRows,
	type ClassProgramSlotRow,
} from './class-program-slot.service.js';
import type { ProgramType } from '@prisma/client';

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

/**
 * SLOT-BREAK-AUTHORITY-C11 — the persisted canonical `classProgramSlot` grid.
 *
 * Only the fields the window authority consumes are required; the resolver
 * (`resolveCanonicalSlotsFromRows`) reads exactly these, so the production read
 * selects no more than this shape.
 */
export type CanonicalSlotWindowSource = Pick<
	ClassProgramSlotRow,
	'gradeLevel' | 'programType' | 'startTime' | 'endTime' | 'rowKind'
> & {
	subjectLabel?: string | null;
	dayOfWeek?: string | null;
};

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

function toMinutes(value: string): number {
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

/**
 * SLOT-BREAK-AUTHORITY-C11 — the event-type identity carried by a canonical
 * BREAK row. Mirrors the `PolicySpecialEvent` vocabulary so a canonical break
 * and its equivalent configured event never look like two different families.
 */
function canonicalBreakEventType(subjectLabel: string | null | undefined): string {
	const label = (subjectLabel ?? '').trim().toLowerCase();
	if (label.includes('health')) return 'HEALTH_BREAK';
	if (label.includes('lunch')) return 'LUNCH_BREAK';
	if (label.includes('recess')) return 'RECESS';
	return 'CUSTOM';
}

/**
 * SLOT-BREAK-AUTHORITY-C11 — resolve the canonical grid rows that govern one
 * (gradeLevel, programType) scope, using the SAME exact-match / grade-generic
 * fallback / ordering semantics as the live resolver
 * (`resolveClassProgramSlots` -> `resolveCanonicalSlotsFromRows`). A known
 * program type never falls back to the grade-generic rows, exactly like the
 * scheduler.
 */
function resolveCanonicalRowsForScope(
	rows: readonly CanonicalSlotWindowSource[],
	gradeLevel: number,
	programType: string | null,
): ClassProgramSlotRow[] {
	if (rows.length === 0) return [];
	return resolveCanonicalSlotsFromRows(
		rows as readonly ClassProgramSlotRow[],
		gradeLevel,
		[programType as ProgramType | null],
	) as ClassProgramSlotRow[];
}

/**
 * SLOT-BREAK-AUTHORITY-C11 — when a scope HAS canonical `classProgramSlot` rows,
 * those rows ARE the break-window and shift-bound authority for that scope:
 *
 *   - `rowKind = 'BREAK'` rows (Health Break, Lunch Break) become the effective
 *     break windows, carrying the exact (gradeLevel, programType) scope.
 *   - `rowKind = 'CLASS'` rows define the effective teaching-shift bounds.
 *
 * Returns `hasCanonicalRows: false` when the scope has no canonical rows, so the
 * caller preserves the persisted policy-row / special-event authority.
 */
export function resolveCanonicalWindowAuthorityForScope(args: {
	rows?: readonly CanonicalSlotWindowSource[] | null;
	gradeLevel: number;
	programType: string | null;
}): { hasCanonicalRows: boolean; breakWindows: BreakWindowRef[]; shiftWindows: ShiftWindowRef[] } {
	const scopeProgram = normalizeWarningProgramType(args.programType);
	const resolved = resolveCanonicalRowsForScope(args.rows ?? [], args.gradeLevel, scopeProgram);
	if (resolved.length === 0) {
		return { hasCanonicalRows: false, breakWindows: [], shiftWindows: [] };
	}

	const seen = new Set<string>();
	const breakWindows: BreakWindowRef[] = [];
	for (const row of resolved) {
		if (row.rowKind !== 'BREAK') continue;
		if (!isTime(row.startTime) || !isTime(row.endTime)) continue;
		const eventType = canonicalBreakEventType(row.subjectLabel);
		const key = `${eventType}:${windowKey(row.startTime, row.endTime)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		breakWindows.push({
			eventType,
			label: (row.subjectLabel ?? '').trim() || 'Break',
			startTime: row.startTime,
			endTime: row.endTime,
			// The canonical grid is grade+program specific: carry the exact scope so
			// the validator matches it deterministically, never grade-wide.
			gradeLevel: args.gradeLevel,
			programType: scopeProgram,
			dayOfWeek: null,
		});
	}
	breakWindows.sort((left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime));

	const classRows = resolved.filter((row) => row.rowKind === 'CLASS' && isTime(row.startTime) && isTime(row.endTime));
	const shiftWindows: ShiftWindowRef[] = classRows.length > 0
		? [{
			startTime: classRows.reduce((min, row) => (toMinutes(row.startTime) < toMinutes(min) ? row.startTime : min), classRows[0].startTime),
			endTime: classRows.reduce((max, row) => (toMinutes(row.endTime) > toMinutes(max) ? row.endTime : max), classRows[0].endTime),
			gradeLevel: args.gradeLevel,
			programType: scopeProgram,
		}]
		: [];

	return { hasCanonicalRows: true, breakWindows, shiftWindows };
}

/** Whether a persisted `GradeShiftWindow` already covers a scope. */
function shiftWindowCoversScope(
	window: { gradeLevel?: number | null; programType?: string | null },
	scope: { gradeLevel?: number | null; programType?: string | null },
): boolean {
	if (window.gradeLevel != null && window.gradeLevel !== scope.gradeLevel) return false;
	const windowProgram = normalizeWarningProgramType(window.programType);
	if (windowProgram == null) return true;
	// A persisted grade-wide `ALL` window covers every program of that grade.
	if (windowProgram === 'ALL') return true;
	return windowProgram === normalizeWarningProgramType(scope.programType);
}

/**
 * Build the full window authority for a roster. One break window set is
 * resolved per distinct (gradeLevel, programType) scope so the validator can
 * match an entry's scope exactly instead of re-deriving priority order.
 *
 * SLOT-BREAK-AUTHORITY-C11: when `classProgramSlots` carries canonical rows for
 * a scope, those rows are the break and shift authority for that scope. Scopes
 * with NO canonical rows keep the persisted policy-row + special-event path.
 * The Monday-only Flag/HGP policy-row overlay is preserved on both paths
 * (canonical BREAK rows cover the Health/Lunch breaks, never the flag overlay).
 */
export function buildWarningWindowAuthority(args: {
	sections: SectionScopeSource[];
	policyRow?: WarningWindowPolicyRow | null;
	specialEvents?: SpecialEventRowLike[] | null;
	shiftWindows?: GradeShiftWindowSource[] | null;
	/** Persisted canonical `classProgramSlot` rows (all grade/program scopes). */
	classProgramSlots?: readonly CanonicalSlotWindowSource[] | null;
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

	const canonicalRows = args.classProgramSlots ?? [];
	const hasCanonicalGrid = canonicalRows.length > 0;
	// The policy-row Flag/HGP window is a Monday-only overlay owned by the policy
	// row; it is preserved even when the canonical grid owns the break windows.
	const policyFlagWindows = resolvePolicyRowBreakWindows(args.policyRow)
		.filter((window) => window.eventType === 'FLAG_OR_HGP');

	const breakWindows: BreakWindowRef[] = [];
	const canonicalShiftWindows: ShiftWindowRef[] = [];
	for (const scope of scopes.values()) {
		if (hasCanonicalGrid) {
			const canonical = resolveCanonicalWindowAuthorityForScope({
				rows: canonicalRows,
				gradeLevel: scope.gradeLevel,
				programType: scope.programType,
			});
			if (canonical.hasCanonicalRows) {
				breakWindows.push(...canonical.breakWindows, ...policyFlagWindows);
				canonicalShiftWindows.push(...canonical.shiftWindows);
				continue;
			}
		}
		breakWindows.push(...resolveBreakWindowsForScope({
			policyRow: args.policyRow,
			specialEvents: args.specialEvents,
			gradeLevel: scope.gradeLevel,
			programType: scope.programType,
		}));
	}

	const persistedShiftWindows: ShiftWindowRef[] = (args.shiftWindows ?? [])
		.filter((window) => isTime(window.startTime) && isTime(window.endTime))
		.map((window) => ({
			startTime: window.startTime,
			endTime: window.endTime,
			gradeLevel: typeof window.gradeLevel === 'number' ? window.gradeLevel : null,
			programType: normalizeWarningProgramType(window.programType),
		}));
	// Canonical CLASS rows define the effective shift bounds only where no
	// persisted `GradeShiftWindow` already covers the scope.
	const shiftWindows = [
		...persistedShiftWindows,
		...canonicalShiftWindows.filter((canonical) => !persistedShiftWindows.some((persisted) => shiftWindowCoversScope(persisted, canonical))),
	];

	return { breakWindows, shiftWindows, sectionScope };
}
