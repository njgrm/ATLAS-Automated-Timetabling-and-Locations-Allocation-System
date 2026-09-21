import { useCallback, useMemo, useRef } from 'react';

import { gradeLabel } from '@/lib/grade-labels';
import { getProgramBadgeLabel, resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import { formatWarningMessageText } from '@/lib/violation-presentation';
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
		const gradePrefix = section?.displayOrder ? `${gradeLabel(section.displayOrder)} · ` : '';
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
		const sectionFormatted = facultyFormatted.replace(/\bsection\s+#?(\d+)\b/gi, (match, rawId: string) => {
			return sectionMap.get(Number(rawId))?.name ?? match;
		});
		// WARNING-READABILITY-C01 (R2): bare "180 min on MONDAY" reads as
		// "180 minutes on Monday" on the operator surface.
		return formatWarningMessageText(sectionFormatted);
	}, [facultyMap, roomLabelShort, roomMap, sectionMap]);

	const gradeForSection = useCallback((sectionId: number): number | null => {
		const section = sectionMap.get(sectionId);
		if (!section) return null;
		// Use the shared resolver, NOT `displayOrder`: displayOrder is the section's
		// order WITHIN its grade (Luna=1, Aguinaldo=2, …), so reading it as the grade
		// labelled every Grade 10 section "Grade 1" and sorted it first.
		// The resolver also normalizes EnrollPro's internal gradeLevelId (17→7 … 20→10).
		return resolveSectionGradeNumber(section);
	}, [sectionMap]);

	const rawGroupedPivotEntities = useMemo(() => {
		const grouped = new Map<string, { ids: number[]; grade: number | null }>();
		for (const id of pivotEntityIds) {
			let label = 'Unassigned';
			let grade: number | null = null;
			if (viewMode === 'room') {
				const room = roomMap.get(id);
				label = room ? room.buildingShortCode || room.buildingName : 'Unknown';
			} else if (viewMode === 'section') {
				const section = sectionMap.get(id);
				const program = section?.programType && section.programType !== 'REGULAR'
					? getProgramBadgeLabel(section.programType, section.programCode)
					: 'Regular';
				grade = gradeForSection(id);
				label = grade ? `${gradeLabel(grade)} · ${program}` : program;
			} else {
				label = facultyMap.get(id)?.department || 'Unassigned';
			}
			const bucket = grouped.get(label) ?? { ids: [], grade };
			bucket.ids.push(id);
			grouped.set(label, bucket);
		}
		// Sort by GRADE NUMBER first, then label. A plain `localeCompare` on the label
		// ordered "Grade 10 · …" before "Grade 7 · …" (string order), so Grade 10 led
		// the section dropdown instead of coming last.
		return Array.from(grouped, ([label, bucket]) => ({ label, ids: bucket.ids, grade: bucket.grade }))
			.sort((a, b) => {
				const ag = a.grade ?? Number.MAX_SAFE_INTEGER;
				const bg = b.grade ?? Number.MAX_SAFE_INTEGER;
				if (ag !== bg) return ag - bg;
				return a.label.localeCompare(b.label);
			})
			.map(({ label, ids }) => ({ label, ids }));
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
