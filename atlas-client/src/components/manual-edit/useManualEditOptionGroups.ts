/**
 * Manual-edit option groups — the room and faculty choices offered by the
 * ManualEditPanel action form.
 *
 * Both selectors are grouped rather than flat: rooms by building, faculty by
 * department. Within a department, faculty options are ordered by qualification
 * tier then name, and each label is prefixed `[Department Match]`,
 * `[Secondary Match]` or `[Unqualified]` so the ordering is legible in the list.
 *
 * KNOWN GAP, stated here because this module is the authority for the derivation:
 * each room option also carries a computed `disabled: !isCompatible` and a
 * `subLabel` naming the features it lacks, but the current `SearchableSelect`
 * does not consume either — it renders `<span>{item.label}</span>` only, its
 * `items` type is `{ value: string; label: string }`, and it never reads
 * `subLabel`, `disabled` or `tier`. **So a feature-incompatible room is
 * currently selectable and the officer gets no warning.** The fields are kept
 * because they are the intended contract for that guard; wiring `SearchableSelect`
 * to honour them is separate work, not something this derivation can deliver.
 *
 * This module is derivation only — the panel owns the selection state, and no
 * rendered markup lives here.
 */
import { useMemo } from 'react';

import { getQualificationTier, type QualificationTier } from '@/lib/grade-labels';
import type { FacultyMirror, ScheduledEntry, Subject } from '@/types';
import type { SearchableSelectGroup } from '@/ui/searchable-select';
import type { ManualEditRoomInfo } from './manual-edit-foundation';

export interface ManualEditOptionGroupInput {
	/** Rooms visible to the officer, keyed by room id. */
	roomMap: Map<number, ManualEditRoomInfo>;
	/** Faculty available for scheduling, keyed by faculty id. */
	facultyMap: Map<number, FacultyMirror>;
	/** Subjects keyed by subject id; supplies the required room features. */
	subjectMap: Map<number, Subject>;
	/** The current draft, used to compute each faculty member's load. */
	draftEntries: ScheduledEntry[];
	/** Subject the edited entry belongs to; drives feature and qualification checks. */
	subjectId: number;
}

export interface ManualEditOptionGroups {
	/**
	 * Rooms grouped by building. Options are ordered by name within a building.
	 * A `disabled` flag and a `subLabel` naming the missing features are computed
	 * per option, but the current `SearchableSelect` ignores both — see the KNOWN
	 * GAP note above.
	 */
	roomSearchGroups: SearchableSelectGroup[];
	/** Faculty grouped by department, ordered by qualification tier then name. */
	facultySearchGroups: SearchableSelectGroup[];
}

/**
 * Build the room and faculty `SearchableSelect` groups for one entry.
 *
 * Memoised on exactly the inputs each group reads, so the returned arrays keep
 * the identity stability the panel's `useMemo` dependency lists rely on.
 */
export function useManualEditOptionGroups({
	roomMap,
	facultyMap,
	subjectMap,
	draftEntries,
	subjectId,
}: ManualEditOptionGroupInput): ManualEditOptionGroups {
	const facultyLoadMap = useMemo(() => {
		const loads = new Map<number, number>();
		for (const e of draftEntries) {
			if (e.facultyId != null) {
				loads.set(e.facultyId, (loads.get(e.facultyId) ?? 0) + e.durationMinutes);
			}
		}
		return loads;
	}, [draftEntries]);

	const roomsByBuilding = useMemo(() => {
		const groups: Array<{ buildingId: number; label: string; rooms: ManualEditRoomInfo[] }> = [];
		const buildingMap = new Map<number, { label: string; rooms: ManualEditRoomInfo[] }>();
		for (const [, r] of roomMap) {
			if (!r.isTeachingSpace) continue;
			let group = buildingMap.get(r.buildingId);
			if (!group) {
				group = { label: r.buildingShortCode || r.buildingName, rooms: [] };
				buildingMap.set(r.buildingId, group);
			}
			group.rooms.push(r);
		}
		for (const [buildingId, group] of buildingMap) {
			group.rooms.sort((a, b) => a.name.localeCompare(b.name));
			groups.push({ buildingId, ...group });
		}
		groups.sort((a, b) => a.label.localeCompare(b.label));
		return groups;
	}, [roomMap]);

	/** SearchableSelect groups for rooms — grouped by building */
	const roomSearchGroups: SearchableSelectGroup[] = useMemo(() => {
		const subject = subjectMap.get(subjectId);
		const required = subject?.requiredFeatures || [];

		return roomsByBuilding.map((group) => ({
			label: group.label,
			items: group.rooms.map((r) => {
				const missing = required.filter((f: string) => !(r.features || []).includes(f));
				const isCompatible = missing.length === 0;

				return {
					value: String(r.id),
					label: `${r.name} · Floor ${r.floor}${r.capacity != null ? ` · Cap ${r.capacity}` : ''} · ${r.type}`,
					subLabel: !isCompatible ? `Lacks: ${missing.join(', ')}` : r.features?.length ? `Features: ${r.features.join(', ')}` : undefined,
					disabled: !isCompatible, // Optional: could just warn instead of disable
				};
			}),
		}));
	}, [roomsByBuilding, subjectMap, subjectId]);

	/** SearchableSelect groups for faculty — grouped by department */
	const facultySearchGroups: SearchableSelectGroup[] = useMemo(() => {
		const deptMap = new Map<string, { value: string; label: string; subLabel?: string; tier?: QualificationTier }[]>();
		const subject = subjectMap.get(subjectId);

		for (const [, f] of facultyMap) {
			if (!f.isActiveForScheduling) continue;
			const dept = f.department || 'Unassigned Department';
			if (!deptMap.has(dept)) deptMap.set(dept, []);
			const loadMinutes = facultyLoadMap.get(f.id) ?? 0;
			const loadHours = Math.round(loadMinutes / 60);

			const tier = subject ? getQualificationTier(f, subject) : null;
			let tierLabel = '';
			if (tier === 1 || tier === 2) tierLabel = '[Department Match] ';
			else if (tier === 3) tierLabel = '[Secondary Match] ';
			else tierLabel = '[Unqualified] ';

			deptMap.get(dept)!.push({
				value: String(f.id),
				label: `${tierLabel}${f.lastName}, ${f.firstName}`,
				subLabel: `${loadHours}h / ${f.maxHoursPerWeek}h max${f.department ? ` · ${f.department}` : ''}${f.specialization ? ` · ${f.specialization}` : ''}`,
				tier,
			});
		}
		return Array.from(deptMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([dept, items]) => ({
				label: dept,
				items: items.sort((a, b) => {
					// Sort by tier first, then name
					const tA = a.tier ?? 99;
					const tB = b.tier ?? 99;
					if (tA !== tB) return tA - tB;
					return a.label.localeCompare(b.label);
				}),
			}));
	}, [facultyMap, facultyLoadMap, subjectMap, subjectId]);

	return { roomSearchGroups, facultySearchGroups };
}
