/**
 * A2 mc R2 — the selected-class action menu, extracted from
 * `ScheduleReviewWorkspace.tsx`.
 *
 * WHY: that file sits at 1000 physical lines against the AGENTS.md §8 cap, and
 * item 7 had to add a real action row to it. §8 says EXTRACT rather than grow.
 * This menu is the seam: it is one `DropdownMenuContent` with a fixed list of
 * handlers, referenced once, and it decides nothing — every action is passed in.
 *
 * IT IS NOT A HEADER. The operator's 21:50 addendum reserves the Class Schedule
 * header, tabs and panel wording for A7 c10 and forbids this lane adding a
 * control, banner or sentence there. This is the SELECTED-CLASS action menu —
 * `Choose a new time`, `Change room`, `Swap with another class` — which is where
 * `Lock this class` belongs. No header file is imported or touched.
 *
 * A MOVED BLOCK IS NOT A CHANGED BLOCK: every testid, class and label below is
 * byte-identical to the workspace's own, and the only addition is the item 7 lock
 * row, which is disabled WITH ITS REASON VISIBLE when the server's own two
 * prerequisites (an explicit teacher and an explicit room) are unmet — so no
 * control ever appears that cannot act.
 */
import { ArrowRightLeft, BookOpen, DoorOpen, GraduationCap, Lock, Move, UserRoundX } from 'lucide-react';

import type { SelectedClassLock } from '@/hooks/useTimetableLocks';
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '@/ui/dropdown-menu';

export function ScheduleReviewWorkspaceSelectedActions({
	onDismissSelection,
	onChooseNewTime,
	onChangeRoom,
	onSwap,
	lock,
	onViewDetails,
	onChangeOwner,
	onTeacherLeaving,
	onExpertDetails,
}: {
	onDismissSelection: () => void;
	onChooseNewTime: () => void;
	onChangeRoom: () => void;
	onSwap: () => void;
	/** The ONE derived lock state — label, line and enabled state agree by construction. */
	lock: SelectedClassLock;
	onViewDetails: () => void;
	onChangeOwner: () => void;
	onTeacherLeaving: () => void;
	onExpertDetails: () => void;
}) {
	return (
		<DropdownMenuContent align="end" className="w-64">
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onDismissSelection(); }} data-testid="timetable-simple-dismiss-selection">
				Dismiss selection
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onChooseNewTime(); }}>
				<Move className="mr-2 size-3.5" aria-hidden="true" />
				Choose a new time
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onChangeRoom(); }} data-testid="timetable-simple-selected-change-room-action">
				<DoorOpen className="mr-2 size-3.5" aria-hidden="true" />
				Change room
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onSwap(); }} data-testid="timetable-simple-selected-swap-action">
				<ArrowRightLeft className="mr-2 size-3.5" aria-hidden="true" />
				Swap with another class
			</DropdownMenuItem>
			<DropdownMenuItem
				disabled={lock.blockReason !== null}
				onSelect={(event) => { event.preventDefault(); void lock.toggle(); }}
				data-testid="timetable-simple-selected-lock-action"
				data-lock-state={lock.isLocked ? 'locked' : 'unlocked'}
				className={lock.blockReason !== null ? 'opacity-60' : undefined}
			>
				<Lock className="mr-2 size-3.5" aria-hidden="true" />
				<span className="flex flex-col">
					<span>{lock.label}</span>
					<span className="text-xs text-muted-foreground">{lock.line}</span>
				</span>
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onViewDetails(); }} data-testid="timetable-simple-selected-details-action">
				<BookOpen className="mr-2 size-3.5" aria-hidden="true" />
				View class details
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onChangeOwner(); }} data-testid="timetable-simple-selected-owner-repair-action">
				<GraduationCap className="mr-2 size-3.5" aria-hidden="true" />
				<span className="flex flex-col">
					<span>Change Teaching Load owner</span>
					<span className="text-xs text-muted-foreground">Opens Teaching Load for this subject, section, and teacher</span>
				</span>
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onTeacherLeaving(); }} data-testid="teacher-departure-selected-action">
				<UserRoundX className="mr-2 size-3.5" aria-hidden="true" />
				<span className="flex flex-col">
					<span>Teacher leaving (all classes)</span>
					<span className="text-xs text-muted-foreground">Bulk repair for every class this teacher handles</span>
				</span>
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={(event) => { event.preventDefault(); onExpertDetails(); }}>
				<GraduationCap className="mr-2 size-3.5" aria-hidden="true" />
				Expert details
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}
