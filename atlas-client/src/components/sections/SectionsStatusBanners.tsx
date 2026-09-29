/**
 * A3 C4 — the Sections page's status banners (extracted from
 * `pages/Sections.tsx`).
 *
 * WHY THIS MOVED OUT (review finding B1, 2026-09-28): the page passed the
 * 1000-line AGENTS.md §8 cap at 1063 physical lines (982 at base). The three
 * banners are one coherent presentational unit — "what is blocking roster edits
 * right now, and what can the operator do about it" — and they were inline in
 * the page body between the workspace frame and the table shell.
 *
 * The three banners are deliberately kept together rather than split, because
 * they are mutually exclusive statements about ONE state and their ordering is
 * the message: no active school year, then source/sync failure, then the
 * edit-status notice. Splitting them would scatter one decision across three
 * files.
 *
 * Behaviour and copy are carried across unchanged. Two details are load-bearing
 * and were preserved deliberately:
 *
 *   - The edit-status banner is `pointer-events-none`, so it can never
 *     intercept a click meant for the table beneath it while it animates in.
 *   - Its blocked variant uses the DESTRUCTIVE semantic token rather than red,
 *     because Phase 0C1 reserves red for grade-level meaning (G9). A banner
 *     that went red here would read as a grade.
 *
 * ── A9 C3 (2026-09-29): THE EDIT-STATUS BANNER MOVED OUT, AND THIS IS THE SUBTRACTION ────
 *
 * The older-user audit rejected this page for jargon, and this file was one of the three
 * places it lived: a second, differently-worded statement of the same writability fact as the
 * one beside the action. `AGENTS.md` §8 forbids two chips saying the same thing, and the two
 * sentences could disagree (`ready` here vs "edits can be queued if saving fails" in the
 * source chip), which is worse than a duplicate — it is an unreliable one.
 *
 * The one line now lives in `SectionsHomeRoomActions`, beside the ONE action it qualifies, and
 * it is still produced by the same pure `deriveHomeRoomEditStatus` contract this file consumed.
 * Nothing is lost: the two banners that REMAIN are the ones that are genuinely a different
 * kind of statement — "there is no school year" and "the roster could not be read, retry" —
 * and both of those carry an action a scheduler can take. The removed banner carried no
 * action at all, which is why it was the redundant one.
 *
 * The `pointer-events-none` guard moved with the markup it existed for: the surviving banners
 * are interactive (Retry Sync) and must be clickable, and the removed one was the only
 * reason that guard was here.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';

type Props = {
	/** The page's own fetch state, narrowed to what a banner needs to read. */
	stateStatus: 'loading' | 'ok' | 'unavailable' | 'no-year';
	stateMessage: string;
	/** True when the last sync attempt failed, even if data is still shown. */
	syncError: boolean;
	/** The operator-facing explanation for the current source state, if any. */
	cacheNotice: string | null;
	syncing: boolean;
	isOnline: boolean;
	/** Opens the same `handleSync` the workspace header's Retry Sync uses. */
	onSync: () => void;
};

export function SectionsStatusBanners({
	stateStatus,
	stateMessage,
	syncError,
	cacheNotice,
	syncing,
	isOnline,
	onSync,
}: Props) {
	return (
		<>
			{stateStatus === 'no-year' && (
				<div className="shrink-0 mx-4 mt-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 shadow-sm animate-in fade-in duration-300 lg:mx-5">
					<AlertTriangle className="size-4 shrink-0 text-blue-600" />
					<span className="flex-1 font-semibold">No active school year. {stateMessage}</span>
				</div>
			)}
			{(stateStatus === 'unavailable' || syncError) && (
				<div className="shrink-0 mx-4 mt-2 flex items-center gap-2 rounded-lg border border-warning-border bg-warning-muted px-3 py-2 text-sm text-warning-foreground shadow-sm animate-in fade-in duration-300 lg:mx-5">
					<AlertTriangle className="size-4 shrink-0 text-warning" />
					<span className="flex-1 font-semibold text-warning-foreground">{cacheNotice ?? (syncError ? 'EnrollPro is temporarily unavailable.' : 'Enrollment service unavailable.')}</span>
					<Button size="sm" variant="outline" onClick={onSync} disabled={syncing || !isOnline} className="shrink-0 h-7 border-warning-border hover:bg-warning/10 text-warning-foreground font-bold"><RefreshCw className={`mr-1.5 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry Sync</Button>
				</div>
			)}
		</>
	);
}
