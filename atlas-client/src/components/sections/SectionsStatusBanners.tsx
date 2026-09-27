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
 *     because Phase 0C.1 reserves red for grade-level meaning (G9). A banner
 *     that went red here would read as a grade.
 */
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import type { HomeRoomEditStatus } from './homeRoomEditStatus';

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
	editStatus: HomeRoomEditStatus;
};

export function SectionsStatusBanners({
	stateStatus,
	stateMessage,
	syncError,
	cacheNotice,
	syncing,
	isOnline,
	onSync,
	editStatus,
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
				<div className="shrink-0 mx-4 mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300 lg:mx-5">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-semibold text-amber-900">{cacheNotice ?? (syncError ? 'EnrollPro is temporarily unavailable.' : 'Enrollment service unavailable.')}</span>
					<Button size="sm" variant="outline" onClick={onSync} disabled={syncing || !isOnline} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold"><RefreshCw className={`mr-1.5 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry Sync</Button>
				</div>
			)}
			{stateStatus === 'ok' && editStatus.tone !== 'ready' && (
				<div
					role={editStatus.tone === 'blocked' ? 'alert' : 'status'}
					className={cn(
						"pointer-events-none shrink-0 mx-4 mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm animate-in fade-in duration-300 lg:mx-5",
						editStatus.tone === 'queued' && 'border-sky-200 bg-sky-50 text-sky-900',
						editStatus.tone === 'checking' && 'border-amber-200 bg-amber-50 text-amber-900',
						// Phase 0C.1: blocked uses the destructive semantic token so the
						// G9 grade red stays reserved for grade-level meaning only.
						editStatus.tone === 'blocked' && 'border-destructive/30 bg-destructive/10 text-destructive',
					)}>
					{editStatus.tone === 'queued' ? <WifiOff className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
					<span className="flex-1 font-semibold">{editStatus.message}</span>
				</div>
			)}
		</>
	);
}
