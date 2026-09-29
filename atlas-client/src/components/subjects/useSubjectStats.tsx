import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { Subject, SubjectCoverageRow } from '@/types';
import type { SubjectCoverageVerdict } from '@/components/subjects/subjects-coverage-truth';
import { splitSubjectFeatures } from './subject-feature-presentation';

type SubjectStatsInput = {
	subjects: Subject[];
	coverageBySubjectId: Map<number, SubjectCoverageRow> | null;
	/**
	 * A6 c10 — the shared verdict, when the page has resolved it. It is a SEPARATE
	 * argument rather than a replacement for `coverageBySubjectId` because the row
	 * list still needs the server's own `SubjectCoverageRow` (its `ownedSectionCount`
	 * and `relevantSectionCount` are not re-derivable here), and adding a second map
	 * is cheaper than teaching one map two shapes. When it is absent this hook
	 * falls back to the superseded predicate and says so through the spinner's help
	 * text — it never silently prints a confident 0.
	 */
	coverageVerdictBySubjectId?: Map<number, SubjectCoverageVerdict> | null;
};

/**
 * A3-C5-SUBJECTS-STATS: does this subject need a specialized room?
 *
 * ONE definition, TWO consumers. The "Room constrained" TILE on this page is a
 * count, and the `room-constrained` ATTENTION FILTER beside it is a list of the
 * same concept — so the two must answer with the same question, or the operator
 * reads a number and a row list that disagree on the same screen. The predicate
 * below is that single question; `countRoomConstrainedSubjects` is derived from
 * it, and `Subjects.tsx` filters with it directly. There is no second place
 * where the rule is written down.
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
 * drift the moment the marker prefix is normalised. Reuse, so every surface
 * moves together.
 *
 * Exported and pure so the acceptance suite can drive it with controlled
 * inputs. An earlier stream shipped a source-shape ratchet that QA defeated
 * while the defect was fully back; a control only discriminates when it
 * exercises the value, not the text.
 */
export function isRoomConstrainedSubject(subject: Subject): boolean {
	return (
		subject.isActive &&
		(subject.preferredRoomType !== 'CLASSROOM' ||
			splitSubjectFeatures(subject.requiredFeatures).roomFeatures.length > 0)
	);
}

/** The tile's number. Derived from the predicate, never written out again. */
export function countRoomConstrainedSubjects(subjects: Subject[]): number {
	return subjects.filter(isRoomConstrainedSubject).length;
}

export function useSubjectStats({ subjects, coverageBySubjectId, coverageVerdictBySubjectId }: SubjectStatsInput) {
	return useMemo(() => {
		const activeCount = subjects.filter((s) => s.isActive).length;
		const archivedCount = subjects.length - activeCount;
		const roomConstrainedCount = countRoomConstrainedSubjects(subjects);
		/*
		 * A6 c10 — the count reads the SHARED VERDICT, not `uncoveredSectionCount`.
		 *
		 * `uncoveredSectionCount > 0` is the predicate that printed `MISSING COVERAGE
		 * 0` while 50 classes sat on to-be-hired records (Codex audit, 2026-09-29):
		 * a placeholder-held class has an owner, so it was never "uncovered" and the
		 * subject was counted as safe. `subjectCoverageVerdict` is the same decision
		 * the row's own label makes, so the header and the row cannot disagree — and
		 * a subject whose coverage read has not resolved is NOT counted as safe, it
		 * is counted as not-yet-known, which is why the branch is `null`.
		 */
		const coverageRiskCount = coverageVerdictBySubjectId
			? subjects.filter((s) => s.isActive && !coverageVerdictBySubjectId.get(s.id)?.fullyCoveredByRealTeachers).length
			: coverageBySubjectId
				? subjects.filter((s) => s.isActive && (coverageBySubjectId.get(s.id)?.uncoveredSectionCount ?? 0) > 0).length
				: null;
		const placeholderOnlyCount = coverageVerdictBySubjectId
			? subjects.filter((s) => {
				const verdict = coverageVerdictBySubjectId.get(s.id);
				return s.isActive && verdict != null && !verdict.fullyCoveredByRealTeachers && verdict.label.startsWith('Covered by a to-be-hired teacher');
			}).length
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
				// A6 c10: the help text now says what is being counted, because the
				// whole defect was a figure whose meaning its own label did not carry.
				// A to-be-hired record is named here as one of the two ways a class
				// is short, so a scheduler reading 0 can tell 0-from-nothing-apart
				// from 0-not-yet-checked.
				helpText: coverageRiskCount === null
					? 'ATLAS is checking teaching-load coverage.'
					: placeholderOnlyCount && placeholderOnlyCount > 0
						? `Active subjects with a class that has no real teacher — ${placeholderOnlyCount} of them are covered only by a to-be-hired record.`
						: 'Active subjects with a class that has no real teacher. A to-be-hired record does not count as one.',
			},
			{
				label: 'Room constrained',
				value: roomConstrainedCount,
				tone: roomConstrainedCount > 0 ? 'warning' as const : 'success' as const,
				helpText: 'Active subjects that need a specialized room type or room feature.',
			},
		];
	}, [coverageBySubjectId, coverageVerdictBySubjectId, subjects]);
}

type CoverageDetailInput = {
	coverageSubject: Subject | null;
	teacherCoverage: Record<number, {
		// A5 (17.1): sections are structured (`{ id, grade, name }`), matching
		// `SubjectCoverageDetail` — the dialog renders the grade as a pill.
		assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: { id: number | null; grade: number | null; name: string }[] }[];
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
