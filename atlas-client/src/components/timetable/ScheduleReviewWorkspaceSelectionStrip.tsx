/**
 * A2 move-swap, item 1 — the selected-class strip, extracted from
 * `ScheduleReviewWorkspace.tsx` (§8: that file sat at 998 physical lines against
 * the 1000 cap, and this cycle must add a strip control and a status-line prop,
 * so §8 says EXTRACT rather than grow).
 *
 * A MOVED BLOCK IS NOT A CHANGED BLOCK. The strip, its testids, its classes and
 * its menu are byte-identical to the workspace's own; the only change is the
 * item 1 copy: the hint used to promise `Review the change before saving.
 * Nothing changes until you confirm.` — but a move commits the moment the slot
 * is picked, so that sentence described a step that does not exist. It is
 * replaced by the truth, in fewer words.
 *
 * IT IS NOT A HEADER. The Class Schedule header, tabs and panel wording belong
 * to A7; this is the selected-class strip and its action menu.
 */
import { MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { SelectedClassLock } from '@/hooks/useTimetableLocks';
import type { ScheduledEntry } from '@/types';
import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { ScheduleReviewWorkspaceSelectedActions } from '@/components/timetable/ScheduleReviewWorkspaceSelectedActions';

export type SelectionStripPrimaryAction = {
	label: string;
	icon: LucideIcon;
	onClick: () => void;
};

export function ScheduleReviewWorkspaceSelectionStrip({
	selectedEntry,
	subjectLabel,
	sectionLabel,
	publishedChangeScope,
	primaryAction,
	lock,
	onDismissSelection,
	onChooseNewTime,
	onChangeRoom,
	onSwap,
	onViewDetails,
	onChangeOwner,
	onTeacherLeaving,
	onExpertDetails,
	onRemoveFromDraft,
}: {
	selectedEntry: ScheduledEntry;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	/** A published run is a dated change; a draft saves on the pick. */
	publishedChangeScope: boolean;
	primaryAction: SelectionStripPrimaryAction;
	/** The ONE derived lock state — label, line and enabled state agree by construction. */
	lock: SelectedClassLock;
	onDismissSelection: () => void;
	onChooseNewTime: () => void;
	onChangeRoom: () => void;
	onSwap: () => void;
	onViewDetails: () => void;
	onChangeOwner: () => void;
	onTeacherLeaving: () => void;
	onExpertDetails: () => void;
	/** A2 move-swap item 3 — present only for a selected DRAFT class. */
	onRemoveFromDraft?: () => void;
}) {
	const SelectedPrimaryIcon = primaryAction.icon;
	return (
		<div
			role="status"
			aria-live="polite"
			data-testid="timetable-selection-strip"
			className="pointer-events-auto fixed inset-x-3 bottom-3 z-40 mx-auto flex max-h-[112px] max-w-2xl flex-col items-stretch justify-between gap-2 overflow-hidden rounded-xl border border-border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur sm:flex-row sm:items-center sm:gap-3 [@media(max-height:500px)]:max-h-[72px] [@media(max-height:500px)]:py-1.5"
		>
			<div className="min-w-0 flex-1">
				<p className="truncate font-semibold text-foreground">
					Selected: {subjectLabel(selectedEntry.subjectId)} · {sectionLabel(selectedEntry.sectionId)}
				</p>
				<p className="truncate text-muted-foreground [@media(max-height:500px)]:hidden" data-testid="timetable-selection-strip-hint">
					{publishedChangeScope
						? 'Published schedule: a change starts on a date you choose.'
						: 'Changes apply as soon as you pick a slot.'}
				</p>
			</div>
			<div className="flex shrink-0 items-center justify-end gap-2">
				<Button
					type="button"
					variant="default"
					size="sm"
					className="h-8 text-xs"
					data-testid="simple-selected-primary-action"
					aria-label={`${primaryAction.label} for selected class`}
					onClick={primaryAction.onClick}
				>
					<SelectedPrimaryIcon className="mr-1.5 size-3.5" aria-hidden="true" />
					{primaryAction.label}
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid="simple-selected-more-actions" aria-label="More actions for selected class">
							<MoreHorizontal className="size-3.5" aria-hidden="true" />
							<span className="hidden sm:inline">More</span>
						</Button>
					</DropdownMenuTrigger>
					<ScheduleReviewWorkspaceSelectedActions
						onDismissSelection={onDismissSelection}
						onChooseNewTime={onChooseNewTime}
						onChangeRoom={onChangeRoom}
						onSwap={onSwap}
						lock={lock}
						onViewDetails={onViewDetails}
						onChangeOwner={onChangeOwner}
						onTeacherLeaving={onTeacherLeaving}
						onExpertDetails={onExpertDetails}
						onRemoveFromDraft={onRemoveFromDraft}
					/>
				</DropdownMenu>
			</div>
		</div>
	);
}
