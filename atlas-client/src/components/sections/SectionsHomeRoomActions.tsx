/**
 * A9 C3 (2026-09-29) — THE ONE ACTION BAND for `/sections`.
 *
 * WHAT THE OLDER-USER AUDIT FOUND. The header carried three controls and a click-on-a-badge:
 * an `Auto-assign rooms` button, a `N needs rooms` Popover-wrapped Badge whose `onClick` opened
 * the SAME dialog, and `Sync sections`. The badge and the button were one job stated twice —
 * `AGENTS.md` §8 forbids two chips saying the same thing — and the badge was the worst of the
 * three, because it LOOKED like a label and behaved like a button: the audit read "20 need
 * rooms" as a status and never found the action behind it.
 *
 * WHAT THIS IS NOW. ONE action, in the words of the job rather than the words of the feature
 * ("Give 20 sections a home room", not "Auto-assign rooms"), carrying the count the page has
 * already computed, plus ONE line that answers the only question a scheduler has before every
 * click — does it save now, or is it waiting? That line is the page's writability contract
 * (`deriveHomeRoomEditStatus`), the same one the row picker and the guided step read, so the
 * three cannot disagree; it replaced a second, differently-worded statement of the same fact
 * in `SectionsStatusBanners` (removed there, recorded in that file) and the source chip's
 * "home-room edits can be queued if saving fails" tail (removed in `pages/Sections.tsx`).
 *
 * THE COUNT IS NOT RE-DERIVED HERE. `sectionsNeedingRooms` arrives from the page's
 * `summarizeHomeRoomReadiness().needing`, which is the same number the "Need rooms" stat tile
 * prints — A3 C4 defect A exists because two definitions of "needs a room" once ran at once,
 * and this component deliberately holds no second derivation to reintroduce that.
 *
 * WHY THE BAND IS IN THE PAGE BODY AND NOT THE HEADER. `AGENTS.md` §8's header budget is two
 * calm rows: title, tabs, ONE status chip, the primary action, `More`. The frame's action slot
 * is one flex row, so the save-state line cannot live inside it without either truncating or
 * adding a header row. Putting the action and its one qualifier together, directly above the
 * work, is what makes them read as a single next step; the header keeps only `Sync`, `More` and
 * the source chip.
 *
 * SUBTRACTION LEDGER for this file (line for line, per `AGENTS.md` §11 rule 3):
 *   REMOVED  the `Auto-assign rooms` Button and its `Wand2` icon;
 *   REMOVED  the `N needs rooms` Popover/Badge and the `MapPin` icon;
 *   REMOVED  the Popover body — its "Sections needing home rooms" heading and the sentence
 *            "Use \"Auto-assign rooms\" or the \"Choose home room\" control on each row.",
 *            which named the control this lane deleted and the row picker this lane removed;
 *   REMOVED  `onAutoAssign` from the `canAutoAssign`-paired chip path, so a click can no longer
 *            land on a badge that looks like a statistic.
 *   KEPT     `Sync sections`, byte-identical in behaviour, including its offline label and its
 *            `disabled` gate; a sync is a different job from assigning rooms.
 *   ADDED    the primary action, whose label is derived in `@/lib/home-room-review-copy` so
 *            the wording is testable, and the one save-state line.
 */
import { RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';
import { guidedStepActionLabel } from '@/lib/home-room-review-copy';
import type { HomeRoomEditStatus } from './homeRoomEditStatus';

type SectionsHomeRoomActionsProps = {
	/** False when there is no roster to work from, or every section already has a room. */
	canAutoAssign: boolean;
	syncing: boolean;
	syncingQueuedEdits: boolean;
	stateStatus: string;
	isOnline: boolean;
	/** `summarizeHomeRoomReadiness().needing` — the same figure the stat tile prints. */
	sectionsNeedingRooms: number;
	onAutoAssign: () => void;
	onSync: () => void;
	/** The page's ONE writability contract, rendered as one line beside the action. */
	editStatus: HomeRoomEditStatus;
	/**
	 * A9 c6 — the plain-words receipt of the last rooms action, on the page whose data changed
	 * (operator decision #5, `docs/plans/codex-walk-standard.md`). `null` until an action runs.
	 */
	receipt?: string | null;
};

/**
 * The line's own tone. It is a quiet statement, not a banner: `AGENTS.md` §8 spends a header
 * row on at most ONE status chip, and this is that one, so it carries a colour only when
 * something is genuinely not saving. The `ready` case is deliberately uncoloured.
 */
const LINE_TONE_CLASS: Record<HomeRoomEditStatus['tone'], string> = {
	ready: 'text-muted-foreground',
	queued: 'text-foreground',
	checking: 'text-warning-foreground',
	blocked: 'text-destructive',
};

export function SectionsHomeRoomActions({
	canAutoAssign,
	syncing,
	syncingQueuedEdits,
	stateStatus,
	isOnline,
	sectionsNeedingRooms,
	onAutoAssign,
	onSync,
	editStatus,
	receipt,
}: SectionsHomeRoomActionsProps) {
	return (
		<div
			className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-2 lg:px-5"
			data-testid="sections-home-room-band"
		>
			{canAutoAssign ? (
				<Button size="sm" onClick={onAutoAssign} className="h-9 gap-2 font-bold" data-testid="sections-guided-step-action">
					{guidedStepActionLabel(sectionsNeedingRooms)}
				</Button>
			) : null}
			<p
				role="status"
				data-testid="sections-save-state-line"
				className={`min-w-0 text-xs font-medium ${LINE_TONE_CLASS[editStatus.tone]}`}
			>
				{editStatus.message}
			</p>
			<Button
				variant="outline"
				size="sm"
				onClick={onSync}
				disabled={syncing || syncingQueuedEdits || stateStatus === 'loading' || !isOnline}
				className="ml-auto shrink-0 gap-2 font-bold"
			>
				<RefreshCw className={`size-4 ${syncing || syncingQueuedEdits ? 'animate-spin' : ''}`} />
				{syncing || syncingQueuedEdits ? 'Syncing...' : !isOnline ? 'Offline' : 'Sync sections'}
			</Button>
			{/* A9 c6 — the receipt of the last rooms action, on the page whose data changed. It
			 * takes the full row width so a long plain-words sentence wraps instead of truncating. */}
			{receipt ? (
				<p
					role="status"
					data-testid="sections-home-room-receipt"
					className="w-full min-w-0 text-xs font-medium text-muted-foreground"
				>
					{receipt}
				</p>
			) : null}
		</div>
	);
}
