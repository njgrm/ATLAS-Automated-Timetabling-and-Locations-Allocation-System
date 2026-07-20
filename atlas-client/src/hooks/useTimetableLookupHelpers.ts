import { useCallback, useMemo, useRef } from 'react';

import { getProgramBadgeLabel } from '@/lib/schedule-review-helpers';
import type { ExternalSection, FacultyMirror, ScheduledEntry, Subject, UnassignedItem } from '@/types';
import type { RoomInfo, ViewMode } from '@/components/timetable/ScheduleReviewWorkspace.constants';

type LookupOptions = {
	viewMode: ViewMode;
	pivotEntityIds: number[];
	roomMap: Map<number, RoomInfo>;
	facultyMap: Map<number, FacultyMirror>;
	sectionMap: Map<number, ExternalSection>;
	subjectMap: Map<number, Subject>;
	draftEntries: ScheduledEntry[];
	sectionLabel: (id: number) => string;
	roomLabelShort: (id: number) => string;
};

export function useTimetableLookupHelpers({
	viewMode,
	pivotEntityIds,
	roomMap,
	facultyMap,
	sectionMap,
	subjectMap,
	draftEntries,
	sectionLabel,
	roomLabelShort,
}: LookupOptions) {
	const resolveEntryProgramType = useCallback(
		(entry: ScheduledEntry | UnassignedItem) => entry.programType ?? sectionMap.get(entry.sectionId)?.programType ?? null,
		[sectionMap],
	);

	const resolveEntryProgramCode = useCallback(
		(entry: ScheduledEntry | UnassignedItem) => entry.programCode ?? sectionMap.get(entry.sectionId)?.programCode ?? null,
		[sectionMap],
	);

	const entryContextLabel = useCallback((entry: ScheduledEntry | UnassignedItem): string => {
		if (entry.entryKind === 'COHORT' && entry.cohortCode) {
			const memberCount = entry.cohortMemberSectionIds?.length ?? 0;
			const specializationLabel = entry.cohortName?.trim();
			const prefix = specializationLabel ? `${entry.cohortCode} · ${specializationLabel}` : entry.cohortCode;
			return `${prefix}${memberCount > 0 ? ` · ${memberCount} section${memberCount === 1 ? '' : 's'}` : ''}`;
		}
		const section = sectionMap.get(entry.sectionId);
		const gradePrefix = section?.displayOrder ? `G${section.displayOrder} · ` : '';
		const adviser = entry.adviserName ?? section?.adviserName;
		return adviser
			? `${gradePrefix}${sectionLabel(entry.sectionId)} · Adviser ${adviser}`
			: `${gradePrefix}${sectionLabel(entry.sectionId)}`;
	}, [sectionLabel, sectionMap]);

	const formatConstraintMessage = useCallback((message: string): string => {
		const roomFormatted = message.replace(/\broom\s+#?(\d+)\b/gi, (match, rawId: string) => {
			const id = Number(rawId);
			return Number.isFinite(id) && roomMap.has(id) ? roomLabelShort(id) : match;
		});
		const facultyFormatted = roomFormatted.replace(/\bfaculty\s+#?(\d+)\b/gi, (match, rawId: string) => {
			const faculty = facultyMap.get(Number(rawId));
			return faculty ? `${faculty.lastName}, ${faculty.firstName}` : match;
		});
		return facultyFormatted.replace(/\bsection\s+#?(\d+)\b/gi, (match, rawId: string) => {
			return sectionMap.get(Number(rawId))?.name ?? match;
		});
	}, [facultyMap, roomLabelShort, roomMap, sectionMap]);

	const gradeForSection = useCallback((sectionId: number): number | null => {
		const section = sectionMap.get(sectionId);
		if (section?.displayOrder) return section.displayOrder;
		const gradeMatch = section?.gradeLevelName?.match(/(\d+)/);
		return gradeMatch ? Number(gradeMatch[1]) : null;
	}, [sectionMap]);

	const rawGroupedPivotEntities = useMemo(() => {
		const grouped = new Map<string, number[]>();
		for (const id of pivotEntityIds) {
			let label = 'Unassigned';
			if (viewMode === 'room') {
				const room = roomMap.get(id);
				label = room ? room.buildingShortCode || room.buildingName : 'Unknown';
			} else if (viewMode === 'section') {
				const section = sectionMap.get(id);
				const program = section?.programType && section.programType !== 'REGULAR'
					? getProgramBadgeLabel(section.programType, section.programCode)
					: 'Regular';
				const grade = gradeForSection(id);
				label = grade ? `G${grade} · ${program}` : program;
			} else {
				label = facultyMap.get(id)?.department || 'Unassigned';
			}
			grouped.set(label, [...(grouped.get(label) ?? []), id]);
		}
		return Array.from(grouped, ([label, ids]) => ({ label, ids })).sort((a, b) => a.label.localeCompare(b.label));
	}, [facultyMap, gradeForSection, pivotEntityIds, roomMap, sectionMap, viewMode]);

	const prevGroupedRef = useRef(rawGroupedPivotEntities);
	const groupedPivotEntities = useMemo(() => {
		if (JSON.stringify(rawGroupedPivotEntities) !== JSON.stringify(prevGroupedRef.current)) {
			prevGroupedRef.current = rawGroupedPivotEntities;
		}
		return prevGroupedRef.current;
	}, [rawGroupedPivotEntities]);


	return {
		resolveEntryProgramType,
		resolveEntryProgramCode,
		entryContextLabel,
		formatConstraintMessage,
		gradeForSection,
		groupedPivotEntities,
	};
}
