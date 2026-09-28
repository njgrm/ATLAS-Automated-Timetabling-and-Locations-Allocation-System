/**
 * The Teachers roster ROW actions, and the repair intent that labels them.
 *
 * Extracted from `pages/Faculty.tsx` so the page stays under the AGENTS.md §8
 * 1000-line cap, and so the Fix 25 navigation change is in one reviewable place.
 *
 * FIX 25 — THE PRIMARY ACTION NO LONGER NAVIGATES.
 *
 * The primary action used to be a react-router `<Link>` to
 * `/teaching-load?facultyId=<id>&task=<intent>`. That unmounted the roster and
 * discarded the scheduler's search, filters, sort, page and scroll position.
 * It is now a `<Button>` that opens the in-page workload modal, for EVERY
 * variant of the intent — `review`, `missing-load`, `over-cap` and
 * `review-placeholders` all share this one control, so leaving any one of them
 * as a link would have left the defect half-fixed.
 *
 * The deep link is preserved, but only as an explicit second control inside the
 * modal ("Edit in Teaching Load"), and it still carries the same `facultyId` and
 * `task=` parameters so `useTeachingLoadRouteIntent` receives exactly the intent
 * it received before.
 *
 * FIX 22 — every `aria-label` in this file uses the shared uppercase display
 * formatter, so the accessible name matches the visible name (WCAG 2.5.3).
 */
import { BookOpenCheck, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { getFacultyLoadPresentation } from '@/components/faculty/FacultyRow';
import { formatFacultyDisplayName } from '@/components/faculty/teacherNameDisplay';
import type { FacultySummary } from '@/types';

export type FacultyRowRepairIntent = {
	task: string;
	label: string;
	helper: string;
};

/**
 * Which repair a row's primary action offers, and the `task=` intent it carries
 * to the optional deep link.
 */
export function getTeacherRepairIntent(teacher: FacultySummary): FacultyRowRepairIntent {
	const loadHours = teacher.policyCreditedHours ?? 0;
	if (teacher.isPlaceholder) {
		return {
			task: 'review-placeholders',
			label: 'Review temporary',
			helper: 'This is a temporary record for a teacher who has not been hired yet. Replace it before publishing.',
		};
	}
	if (!teacher.isActiveForScheduling) {
		return {
			task: 'review',
			label: 'View details',
			helper: 'This teacher is excluded from scheduling. Review before assigning load.',
		};
	}
	if ((teacher.subjectCount ?? 0) === 0) {
		return {
			task: 'missing-load',
			label: 'Assign teaching load',
			helper: 'This active teacher has no Teaching Load yet.',
		};
	}
	if (loadHours > teacher.maxHoursPerWeek) {
		return {
			task: 'over-cap',
			label: 'Move classes',
			helper: 'This teacher is over the weekly maximum. Move classes before generating the timetable.',
		};
	}
	return {
		task: 'review',
		label: 'Review load',
		helper: getFacultyLoadPresentation(teacher).help,
	};
}

type UseFacultyRowActionsArgs = {
	/** Fix 25: opens the in-page workload modal. Receives the click so the page can capture the roster scroll offset. */
	onReviewLoad: (teacher: FacultySummary, event: React.MouseEvent<HTMLElement>) => void;
	onOpenProfile: (teacher: FacultySummary) => void;
	onEditTemporary: (teacher: FacultySummary) => void;
	onDeleteTemporary: (teacher: FacultySummary) => void;
};

export function useFacultyRowActions({
	onReviewLoad,
	onOpenProfile,
	onEditTemporary,
	onDeleteTemporary,
}: UseFacultyRowActionsArgs) {
	return {
		label: 'Teacher actions',
		menuTestId: 'teacher-row-more-actions',
		/**
		 * Fix 25: a button, not a link. Nothing here touches the router.
		 */
		primary: (teacher: FacultySummary) => {
			const repairIntent = getTeacherRepairIntent(teacher);
			return (
				<Button
					size="sm"
					className="h-8 gap-2 px-3 text-xs font-bold"
					data-testid="teacher-row-primary-action"
					onClick={(event) => onReviewLoad(teacher, event)}
					aria-label={`${repairIntent.label} for ${formatFacultyDisplayName(teacher)}`}
				>
					<BookOpenCheck className="size-3.5" />
					{repairIntent.label}
				</Button>
			);
		},
		inlineSecondary: (teacher: FacultySummary) => (
			<Button
				variant="outline"
				size="sm"
				className="h-8 gap-1.5 px-2.5 text-xs font-bold"
				onClick={() => onOpenProfile(teacher)}
				aria-label={`View profile for ${formatFacultyDisplayName(teacher)}`}
				data-testid="teacher-row-profile-action"
			>
				<Eye className="size-3.5" />
				Profile
			</Button>
		),
		secondary: (teacher: FacultySummary) => {
			const actions: { label: string; icon: React.ReactNode; onSelect: () => void }[] = [];
			if (teacher.isPlaceholder) {
				actions.push({
					label: 'Edit temporary teacher details',
					icon: <Pencil className="size-4" />,
					onSelect: () => onEditTemporary(teacher),
				});
			}
			return actions;
		},
		destructive: (teacher: FacultySummary) =>
			teacher.isPlaceholder
				? [{
					label: 'Delete temporary teacher',
					icon: <Trash2 className="size-4" />,
					onSelect: () => onDeleteTemporary(teacher),
				}]
				: [],
	};
}
