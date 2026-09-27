import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { Subject, SubjectCoverageRow } from '@/types';
import { splitSubjectFeatures } from './subject-feature-presentation';

type SubjectStatsInput = {
	subjects: Subject[];
	coverageBySubjectId: Map<number, SubjectCoverageRow> | null;
};

/**
 * A3-C5-SUBJECTS-STATS: how many ACTIVE subjects need a specialized room.
 *
 * A subject qualifies on either of two independent grounds, and the tile's own
 * help text ("Active subjects that need a specialized room type or room
 * feature") names exactly those two:
 *
 *  1. `preferredRoomType` is not `CLASSROOM`. `RoomType` is non-nullable
 *     (`types.ts`), so this branch needs no null handling.
 *  2. it declares at least one REAL room feature.
 *
 * Ground 2 was read as `s.requiredFeatures.length > 0`, and that list is MIXED:
 * the server folds an ownership marker `OWNER_DEPT:<code>` into it
 * (atlas-server/src/services/subject-ownership.service.ts:44) alongside real
 * room features. So a subject whose only feature is an ownership marker was
 * counted as "Room constrained" — the tile contradicting both its own help text
 * and its sibling surfaces, which already filter the markers out
 * (`SubjectRow.tsx:84`, `SubjectCoverageSheet.tsx:84`).
 *
 * The split is therefore NOT re-implemented here. `splitSubjectFeatures` is the
 * repository's single definition of the partition and the one the row and the
 * coverage sheet already consume; a second `.filter(f => !f.startsWith(...))`
 * is exactly the two-definition defect class AGENTS.md §11 records, and it would
 * drift the moment the marker prefix is normalised. Reuse, so all three surfaces
 * move together.
 *
 * Exported and pure so the acceptance suite can drive it with controlled
 * inputs. An earlier stream shipped a source-shape ratchet that QA defeated
 * while the defect was fully back; a control only discriminates when it
 * exercises the value, not the text.
 */
export function countRoomConstrainedSubjects(subjects: Subject[]): number {
	return subjects.filter(
		(s) =>
			s.isActive &&
			(s.preferredRoomType !== 'CLASSROOM' ||
				splitSubjectFeatures(s.requiredFeatures).roomFeatures.length > 0),
	).length;
}

export function useSubjectStats({ subjects, coverageBySubjectId }: SubjectStatsInput) {
	return useMemo(() => {
		const activeCount = subjects.filter((s) => s.isActive).length;
		const archivedCount = subjects.length - activeCount;
		const roomConstrainedCount = countRoomConstrainedSubjects(subjects);
		const coverageRiskCount = coverageBySubjectId
			? subjects.filter((s) => s.isActive && (coverageBySubjectId.get(s.id)?.uncoveredSectionCount ?? 0) > 0).length
			: null;
		return [
			{
				label: 'Active subjects',
				value: activeCount,
				tone: activeCount > 0 ? 'success' as const : 'warning' as const,
				helpText: archivedCount > 0
					? `${activeCount} active · ${archivedCount} archived (kept for history, hidden from new setup).`
					: 'Subjects currently available for scheduling this school year.',
			},
			{
				label: 'Missing coverage',
				value: coverageRiskCount === null
					? <Loader2 className="size-3 animate-spin" data-testid="subjects-missing-coverage-spinner" />
					: coverageRiskCount,
				tone: coverageRiskCount === null ? 'info' as const : coverageRiskCount > 0 ? 'warning' as const : 'success' as const,
				helpText: coverageRiskCount === null
					? 'ATLAS is checking teaching-load coverage.'
					: 'Active schedulable subjects with one or more uncovered sections in the current teaching load.',
			},
			{
				label: 'Room constrained',
				value: roomConstrainedCount,
				tone: roomConstrainedCount > 0 ? 'warning' as const : 'success' as const,
				helpText: 'Active subjects that need a specialized room type or room feature.',
			},
		];
	}, [coverageBySubjectId, subjects]);
}

type CoverageDetailInput = {
	coverageSubject: Subject | null;
	teacherCoverage: Record<number, {
		assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: string[] }[];
	}>;
};

export function useCoverageDetail({ coverageSubject, teacherCoverage }: CoverageDetailInput) {
	return useMemo(() => {
		if (!coverageSubject) return null;
		const assigned = teacherCoverage[coverageSubject.id]?.assigned ?? [];
		const coveredGrades = new Set(assigned.flatMap((teacher) => teacher.grades));
		const uncoveredGrades = coverageSubject.gradeLevels.filter((grade) => !coveredGrades.has(grade));
		return {
			assigned,
			uncoveredGrades,
			programScopes: coverageSubject.programScopes ?? [],
		};
	}, [coverageSubject, teacherCoverage]);
}
