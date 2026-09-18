import type { ExternalSection, ScheduledEntry } from '@/types';
import { resolveSectionGradeNumber } from './schedule-review-helpers';

/**
 * GRID-SHAPE-AUTHORITY
 *
 * The generation run summary exposes BOTH a per-shape `displaySlots` array
 * (inside each `timetableShapeContracts` entry) and a run-wide
 * `timetableDisplaySlots` union built from every shape. Rendering the union for
 * a single entity is wrong: a Grade 7 section then shows the Grade 9/Grade 10
 * afternoon grid and duplicated rows for intervals that carry both a class
 * period and a day-scoped overlay (Monday Flag/HGP).
 *
 * These pure helpers are the one authority the Timetable workspace uses to
 * project a shape contract set into grid rows:
 *   - `resolveSectionShapeContract` selects one section's own contract.
 *   - `resolveEntityDisplaySlots` selects the contract(s) a section, teacher, or
 *     room actually consumes (never a blind union of all shapes).
 *   - `buildGridRows` collapses the selected slots to one row per
 *     `(startTime, endTime)`, merging a day-scoped overlay into its containing
 *     period so the Monday Flag/HGP shares the underlying period instead of
 *     becoming an extra grid row.
 */

export type GridDisplaySlot = {
	startTime: string;
	endTime: string;
	isSpecialEvent?: boolean;
	eventName?: string;
	dayOfWeek?: string;
};

export type TimetableShapeContractLike = {
	gradeLevel: number;
	programType: string;
	displaySlots: GridDisplaySlot[];
};

function normalizeProgramType(programType?: string | null): string {
	return (programType ?? 'REGULAR').trim().toUpperCase() || 'REGULAR';
}

/**
 * Resolve the shape contract that a section consumes.
 * Priority: exact grade + exact program → exact grade + REGULAR → exact grade.
 * Returns undefined when the contract set is empty or the section's grade
 * cannot be determined; callers must then fall back deliberately rather than
 * silently rendering every shape.
 */
export function resolveSectionShapeContract(
	section: ExternalSection,
	contracts: TimetableShapeContractLike[] | undefined,
): TimetableShapeContractLike | undefined {
	if (!contracts || contracts.length === 0) return undefined;
	const gradeNumber = resolveSectionGradeNumber(section);
	if (gradeNumber == null) return undefined;
	const normalizedProgram = normalizeProgramType(section.programType);
	return contracts.find(
		(contract) => contract.gradeLevel === gradeNumber && normalizeProgramType(contract.programType) === normalizedProgram,
	) ?? contracts.find(
		(contract) => contract.gradeLevel === gradeNumber && normalizeProgramType(contract.programType) === 'REGULAR',
	) ?? contracts.find(
		(contract) => contract.gradeLevel === gradeNumber,
	);
}

/**
 * Resolve the display slots an entity actually consumes.
 *   - section view: exactly the selected section's own shape contract.
 *   - teacher/room view: the union of the shapes belonging to the sections the
 *     entity is actually scheduled against (never all 16 contracts).
 * Returns undefined when no entity-specific shape can be resolved.
 */
export function resolveEntityDisplaySlots(input: {
	viewMode: 'section' | 'faculty' | 'room';
	entityFilter: string;
	sectionMap: Map<number, ExternalSection>;
	entries: ScheduledEntry[];
	contracts: TimetableShapeContractLike[] | undefined;
}): GridDisplaySlot[] | undefined {
	const { contracts } = input;
	if (!contracts || contracts.length === 0) return undefined;
	const selectedId = Number(input.entityFilter);
	if (!Number.isInteger(selectedId) || selectedId <= 0) return undefined;

	if (input.viewMode === 'section') {
		const section = input.sectionMap.get(selectedId);
		if (!section) return undefined;
		const contract = resolveSectionShapeContract(section, contracts);
		return contract ? contract.displaySlots : undefined;
	}

	const sectionIds = new Set<number>();
	for (const entry of input.entries) {
		const matchesEntity = input.viewMode === 'faculty'
			? entry.facultyId === selectedId
			: entry.roomId === selectedId;
		if (matchesEntity) sectionIds.add(entry.sectionId);
	}
	if (sectionIds.size === 0) return undefined;

	const slots: GridDisplaySlot[] = [];
	const seenContracts = new Set<string>();
	for (const sectionId of sectionIds) {
		const section = input.sectionMap.get(sectionId);
		if (!section) continue;
		const contract = resolveSectionShapeContract(section, contracts);
		if (!contract) continue;
		const contractKey = `${contract.gradeLevel}:${normalizeProgramType(contract.programType)}`;
		if (seenContracts.has(contractKey)) continue;
		seenContracts.add(contractKey);
		slots.push(...contract.displaySlots);
	}
	return slots.length > 0 ? slots : undefined;
}

/**
 * Collapse display slots to one row per `(startTime, endTime)`.
 *
 * A non-special period row wins the interval. A day-scoped overlay
 * (Monday Flag/HGP) that shares that interval is attached to the period row as
 * `eventName` + `dayOfWeek` so the grid can render it inside the period cell
 * instead of as a duplicate row. Genuine non-teaching intervals with no period
 * row (Health Break, Lunch) stay as their own special-event row.
 *
 * The source `displaySlots` arrays are never mutated, so the export/shape
 * contract keeps the event row intact.
 */
export function buildGridRows(slots: GridDisplaySlot[] | undefined | null): GridDisplaySlot[] {
	if (!slots || slots.length === 0) return [];
	const groups = new Map<string, GridDisplaySlot[]>();
	const order: string[] = [];
	for (const slot of slots) {
		if (!slot || typeof slot.startTime !== 'string' || typeof slot.endTime !== 'string') continue;
		const key = `${slot.startTime}-${slot.endTime}`;
		const group = groups.get(key);
		if (group) {
			group.push(slot);
		} else {
			groups.set(key, [slot]);
			order.push(key);
		}
	}

	const rows: GridDisplaySlot[] = [];
	for (const key of order) {
		const group = groups.get(key)!;
		const period = group.find((slot) => !slot.isSpecialEvent);
		const events = group.filter((slot) => slot.isSpecialEvent);
		if (period) {
			// Prefer a day-scoped overlay as the annotation; otherwise keep the
			// first event label so genuine breaks merged into a period interval
			// still carry their identity.
			const annotation = events.find((slot) => slot.dayOfWeek) ?? events[0];
			rows.push({
				startTime: period.startTime,
				endTime: period.endTime,
				isSpecialEvent: false,
				eventName: annotation?.eventName,
				dayOfWeek: annotation?.dayOfWeek,
			});
			continue;
		}
		const event = events.find((slot) => slot.dayOfWeek) ?? events[0];
		if (!event) continue;
		rows.push({
			startTime: event.startTime,
			endTime: event.endTime,
			isSpecialEvent: true,
			eventName: event.eventName,
			dayOfWeek: event.dayOfWeek,
		});
	}

	return rows.sort(
		(left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime),
	);
}

/**
 * True when a slot is a day-scoped overlay carried by an ordinary period row.
 * Used by the grid cell and the live conflict index to scope the block to one
 * weekday without turning the whole interval into a five-day event.
 */
export function isDayScopedOverlay(slot: Pick<GridDisplaySlot, 'isSpecialEvent' | 'eventName' | 'dayOfWeek'>): boolean {
	return !slot.isSpecialEvent && Boolean(slot.eventName && slot.dayOfWeek);
}

/** True when a slot blocks placement on the given weekday. */
export function slotBlocksDay(
	slot: Pick<GridDisplaySlot, 'isSpecialEvent' | 'eventName' | 'dayOfWeek'>,
	day: string,
): boolean {
	if (slot.isSpecialEvent) return !slot.dayOfWeek || slot.dayOfWeek === day;
	return isDayScopedOverlay(slot) && slot.dayOfWeek === day;
}
