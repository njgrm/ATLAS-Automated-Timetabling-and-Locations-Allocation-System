/**
 * FacultyRosterActions — the Teachers page header actions, plus the Fix 25
 * in-page "Review teachers" entry point.
 *
 * Extracted from `pages/Faculty.tsx` so that page does not grow past the
 * AGENTS.md §8 1000-line cap.
 *
 * Fix 24: the copy was `Create Temporary` (ambiguous Title Case) and
 * `Refresh teacher roster` (21 chars). Both sat in the same flex row as the
 * review control and were the widest strings in it, so the row could wrap or
 * clip at 1366x768 once the label and icon were combined. The labels are now
 * shorter and unambiguous, and every button carries `whitespace-nowrap` so it
 * can never wrap; the full specific wording moves to `title`/`aria-label` so
 * assistive tech and hover still get the precise intent.
 *
 * Fix 25: `Review teachers` no longer navigates to `/teaching-load`. It opens the
 * in-page review modal, so the roster keeps its filters, scroll position, and
 * selection. (The per-row repair action still routes to `/teaching-load`
 * because it carries a `task=` intent consumed by `useTeachingLoadRouteIntent`
 * — see the handoff for that scoped deviation.)
 */
import { BookOpenCheck, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';

type FacultyRosterActionsProps = {
	/**
	 * `AdminWorkspaceFrame` renders a primary slot and a secondary slot. Keeping
	 * the same split preserves the existing header layout exactly.
	 */
	slot: 'primary' | 'secondary';
	onOpenReview: () => void;
	onCreateTemporary: () => void;
	onRefreshRoster: () => void;
	syncing: boolean;
	isOnline: boolean;
	refreshing: boolean;
};

export function FacultyRosterActions({
	slot,
	onOpenReview,
	onCreateTemporary,
	onRefreshRoster,
	syncing,
	isOnline,
	refreshing,
}: FacultyRosterActionsProps) {
	const refreshLabel = syncing
		? 'Refreshing...'
		: !isOnline
		? 'Offline'
		: refreshing
		? 'Checking...'
		: 'Refresh roster';

	if (slot === 'primary') {
		return (
			<Button
				type="button"
				onClick={onOpenReview}
				size="sm"
				data-testid="faculty-review-open"
				className="hidden gap-2 whitespace-nowrap font-semibold shadow-sm sm:inline-flex"
			>
				<BookOpenCheck className="size-4" />
				Review teachers
			</Button>
		);
	}

	return (
		<>
			{/* Mobile variant of the same in-page review. */}
			<Button
				type="button"
				onClick={onOpenReview}
				size="sm"
				data-testid="faculty-review-open-mobile"
				className="gap-2 whitespace-nowrap font-semibold shadow-sm sm:hidden"
			>
				<BookOpenCheck className="size-4" />
				Review
			</Button>

			<Button
				type="button"
				onClick={onCreateTemporary}
				size="sm"
				title="Add a temporary teacher record"
				aria-label="Add temporary teacher"
				className="gap-2 whitespace-nowrap font-semibold shadow-sm"
			>
				<Plus className="size-4" />
				Add temporary
			</Button>

			<Button
				type="button"
				variant="outline"
				onClick={onRefreshRoster}
				disabled={syncing || !isOnline}
				size="sm"
				title="Refresh teacher list from EnrollPro"
				aria-label="Refresh teacher list"
				className="gap-2 whitespace-nowrap font-semibold"
			>
				<RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
				{refreshLabel}
			</Button>
		</>
	);
}
