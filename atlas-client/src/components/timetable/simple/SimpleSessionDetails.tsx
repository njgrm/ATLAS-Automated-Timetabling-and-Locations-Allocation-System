/**
 * LANE-C DRAFT-UX-C01 (S4) — the Simple session details.
 *
 * Operator decision (2026-09-25): from 768 px up (Tailwind `md`,
 * `SESSION_DETAILS_DIALOG_MIN_WIDTH` via `useMediaMinWidth`) the details open
 * as a centred `@/ui` Dialog (≤720 px wide, scrolling inside, no page
 * scrollbar); below it the bottom drawer stays. The same content renders in
 * both. The TIME card shows the session's day and start–end time (it used to
 * show the view name), warnings use the grid's severity signs, and each action
 * appears once in one button row. Every action keeps its existing handler.
 */
import type { ReactNode } from 'react';
import { ArrowRightLeft, BookOpen, Clock, DoorOpen, GraduationCap, Move, UserRoundX, X } from 'lucide-react';

import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { SeveritySign } from '@/components/timetable/TimetableGridConflictBadge';
import { SESSION_DETAILS_DIALOG_MIN_WIDTH, useMediaMinWidth } from '@/hooks/useTimetableState';

const DAY_NAMES: Record<string, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
	SATURDAY: 'Saturday',
	SUNDAY: 'Sunday',
};

/** "Tuesday · 09:00–10:00" — the session's own day and time. */
export function formatSessionTime(entry: { day: string; startTime: string; endTime: string }): string {
	const day = DAY_NAMES[entry.day] ?? entry.day;
	return `${day} · ${entry.startTime}–${entry.endTime}`;
}

type SessionEntry = {
	entryId: string;
	sectionId: number;
	subjectId: number;
	facultyId?: number | null;
	roomId?: number | null;
	day: string;
	startTime: string;
	endTime: string;
};

type SessionWarning = { severity: string; message: string };

export type SimpleSessionDetailsProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entry: SessionEntry | null;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	teacherLabel: (id: number) => string;
	roomLabel: (id: number) => string;
	warnings: readonly SessionWarning[];
	formatWarningMessage?: (message: string) => string;
	onMoveTime: () => void;
	onChangeRoom: () => void;
	onSwap: () => void;
	onChangeOwner: () => void;
	onExpertDetails: () => void;
	/** Rendered above the details (the workspace's redo strip). */
	topSlot?: ReactNode;
};

function SummaryCard({ icon: Icon, label, children, testId }: { icon: typeof Clock; label: string; children: ReactNode; testId?: string }) {
	return (
		<div className="rounded-xl border border-border bg-muted/20 p-3" data-testid="simple-details-summary-card">
			<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
				<Icon className="size-3.5" aria-hidden="true" />
				{label}
			</p>
			<p className="mt-1 font-semibold text-foreground" data-testid={testId}>{children}</p>
		</div>
	);
}

function SessionDetailsBody(props: SimpleSessionDetailsProps & { entry: SessionEntry }) {
	const { entry, warnings, onOpenChange } = props;
	const run = (action: () => void) => () => {
		onOpenChange(false);
		action();
	};
	return (
		<>
			{props.topSlot}
			<div className="grid gap-2 text-sm sm:grid-cols-2">
				<SummaryCard icon={BookOpen} label="Class">{props.sectionLabel(entry.sectionId)}</SummaryCard>
				<SummaryCard icon={UserRoundX} label="Teacher">{entry.facultyId ? props.teacherLabel(entry.facultyId) : 'No teacher assigned'}</SummaryCard>
				<SummaryCard icon={DoorOpen} label="Room">{entry.roomId ? props.roomLabel(entry.roomId) : 'No room assigned'}</SummaryCard>
				<SummaryCard icon={Clock} label="Time" testId="simple-details-time">{formatSessionTime(entry)}</SummaryCard>
			</div>
			{warnings.length > 0 ? (
				<section className="rounded-xl border border-amber-300 bg-amber-50/60 p-3" data-testid="timetable-simple-schedule-notes" aria-label="Schedule notes">
					<h3 className="text-xs font-bold uppercase tracking-wide text-amber-950">Warnings · {warnings.length}</h3>
					<p className="mt-1 text-xs text-muted-foreground">Read-only information about this class. Each item says whether it blocks saving or publishing.</p>
					<ul className="mt-2 space-y-1.5 text-sm text-foreground">
						{warnings.map((warning, index) => {
							const hard = warning.severity === 'HARD';
							return (
								<li key={`${warning.severity}-${index}`} className="flex items-start gap-1.5" data-testid="simple-details-warning">
									<SeveritySign severity={hard ? 'HARD' : 'SOFT'} className="mt-0.5" />
									<span>
										<span className="font-semibold">{hard ? 'Must fix: ' : 'Warning: '}</span>
										{props.formatWarningMessage?.(warning.message) ?? warning.message}{' '}
										<span className="text-xs font-medium">{hard ? '(Blocks saving and publishing.)' : '(Does not block saving or publishing.)'}</span>
									</span>
								</li>
							);
						})}
					</ul>
				</section>
			) : null}
			<div className="flex flex-wrap gap-2" data-testid="simple-details-actions">
				<Button type="button" variant="outline" size="sm" onClick={run(props.onMoveTime)} data-testid="timetable-simple-details-move-time">
					<Move className="mr-1.5 size-3.5" aria-hidden="true" />Move time
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={run(props.onChangeRoom)} data-testid="timetable-simple-details-change-room">
					<DoorOpen className="mr-1.5 size-3.5" aria-hidden="true" />Change room
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={run(props.onSwap)} data-testid="timetable-simple-details-swap">
					<ArrowRightLeft className="mr-1.5 size-3.5" aria-hidden="true" />Swap
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={run(props.onChangeOwner)} data-testid="timetable-simple-details-owner-repair">
					<GraduationCap className="mr-1.5 size-3.5" aria-hidden="true" />Change owner
				</Button>
				<Button type="button" size="sm" onClick={run(props.onExpertDetails)} data-testid="timetable-simple-details-expert">
					<GraduationCap className="mr-1.5 size-3.5" aria-hidden="true" />Expert details
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} data-testid="timetable-simple-details-close">
					<X className="mr-1.5 size-3.5" aria-hidden="true" />Close
				</Button>
			</div>
		</>
	);
}

const DESCRIPTION = 'Class summary. Each action below opens its usual review before anything is saved.';

export function SimpleSessionDetails(props: SimpleSessionDetailsProps) {
	const desktop = useMediaMinWidth(SESSION_DETAILS_DIALOG_MIN_WIDTH);
	const { open, onOpenChange, entry } = props;
	const title = entry ? props.subjectLabel(entry.subjectId) : '';
	if (desktop) {
		return (
			<Dialog open={open && entry != null} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-[720px] max-h-[85svh] overflow-y-auto gap-3" data-testid="timetable-simple-details-dialog">
					{entry ? (
						<>
							<DialogHeader>
								<DialogTitle className="text-base">{title}</DialogTitle>
								<DialogDescription>{DESCRIPTION}</DialogDescription>
							</DialogHeader>
							<SessionDetailsBody {...props} entry={entry} />
						</>
					) : null}
				</DialogContent>
			</Dialog>
		);
	}
	return (
		<Sheet open={open && entry != null} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" className="max-h-[86svh] overflow-y-auto rounded-t-2xl p-4" data-testid="timetable-simple-details-sheet">
				{entry ? (
					<div className="flex flex-col gap-3">
						<SheetHeader>
							<SheetTitle className="text-base">{title}</SheetTitle>
							<SheetDescription>{DESCRIPTION}</SheetDescription>
						</SheetHeader>
						<SessionDetailsBody {...props} entry={entry} />
					</div>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
