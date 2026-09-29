/**
 * ROW 37 / A2-UX-MENU-C2 — the Simple tutorial, extracted from
 * `SimpleHeaderHelpers.tsx` so the header module stays inside the 1000-line
 * component budget while the tutorial grows its own contract.
 *
 * The recorded live measurement that produced this file: step 3 named
 * "More > Schedule data > Export workbook", an item that does not exist
 * (Schedule data holds the run picker and two refresh rows; the export is
 * "Download schedules" under Schedule actions); step 4's "Show me" answered
 * "Expert view is not available in the current view"; and steps 1–2 produced no
 * visible highlight at all.
 *
 * Three rules now hold, and the regression in
 * `src/components/timetable/__tests__/timetable-more-menu-a2.test.tsx` renders
 * the header and checks every one of them:
 *
 *   1. a step names a control that EXISTS on the surface it describes;
 *   2. a step's `targetTestId` is a control the Simple header renders in the
 *      state the step is written for — never a row that only appears inside the
 *      closed More menu, and never a post-selection row;
 *   3. "Show me" either delivers a visible highlight or says plainly that it
 *      cannot. It never silently does nothing.
 *
 * `SimpleHeaderHelpers` re-exports both exports below, so every existing importer
 * and the committed source contracts keep working unchanged.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, CalendarClock, CheckCircle2, ClipboardCheck, Download, ListChecks, Play, Send, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { BUILD_NEW_DRAFT_LABEL, PUBLISHED_SCHEDULE_STAYS_IN_USE } from '@/lib/timetable-plain-language';
import { CLASS_SCHEDULE_LABEL } from '@/lib/class-schedule-naming';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import type { TimetableLifecycleState } from '@/lib/timetable-capabilities';

export type SimpleTutorialStep = {
	title: string;
	body: string;
	target: string;
	/**
	 * The control "Show me" points at. Rule 2 above: it is always a control the
	 * Simple header renders in the state the step is written for.
	 */
	targetTestId: string;
	/**
	 * The same control in its other form. The schedule switcher is one control
	 * with two faces — the inline chooser at desktop widths and the sheet trigger
	 * below them — and only one of the two is visible at a time, so both render
	 * and "Show me" points at whichever is on screen.
	 */
	altTargetTestId?: string;
	icon: LucideIcon;
};

const SCHEDULE_SWITCHER_STEP: SimpleTutorialStep = {
	title: 'Choose whose schedule to see',
	body: 'Use the schedule switcher to switch between Section, Teacher, and Room views without leaving Simple view.',
	target: 'Schedule switcher',
	targetTestId: 'timetable-simple-schedule-switcher',
	altTargetTestId: 'timetable-simple-schedule-sheet-trigger',
	icon: CalendarClock,
};

/**
 * The one sentence that names a path inside More. It reads as a list because the
 * More menu is a set of labelled groups, and the group name plus the item name
 * is exactly what an older, mouse-first scheduler has to look for.
 */
function morePath(group: string, item: string): string {
	return `More, then ${group}, and choose ${item}.`;
}

const NO_RUN_STEPS: readonly SimpleTutorialStep[] = [
	SCHEDULE_SWITCHER_STEP,
	{
		title: 'Check the lifecycle action',
		// DRAFT-UX-C01 — with no generated run, Generate is the header's one primary.
		body: 'With no timetable yet, Generate is the main button: generate a timetable, or open Year Setup from More > Schedule actions > Next step if setup is not ready (Generate then says why it is unavailable).',
		target: 'Generate action',
		targetTestId: 'timetable-simple-generate-action',
		icon: Send,
	},
	{
		title: 'Confirm before generating',
		body: 'Generating opens a confirmation that lists your school year, terms, expected classes, and saved draft anchors. Nothing is published by generating.',
		target: 'Generate confirmation',
		targetTestId: 'timetable-simple-generate-action',
		icon: ListChecks,
	},
	{
		title: 'Repair setup on Year Setup',
		// ROW 37: the old text named no control it could point at. The target is
		// the More trigger, which is on screen; the body names the entry in it.
		body: `If the active year, its terms, or the Subject details are missing, ${morePath('Schedule actions', 'Next step')} That opens Year Setup.`,
		target: 'More menu',
		targetTestId: 'timetable-simple-more-trigger',
		icon: ClipboardCheck,
	},
];

const GENERATED_STEPS: readonly SimpleTutorialStep[] = [
	SCHEDULE_SWITCHER_STEP,
	{
		title: 'Generate a draft',
		// ROW 37: "More > Schedule data > Export workbook" named an item that has
		// never existed. The one action is in Schedule actions, and since #56 its
		// single verb is `BUILD_NEW_DRAFT_LABEL` — the same words the menu item
		// and the confirmation dialog use.
		body: `${morePath('Schedule actions', BUILD_NEW_DRAFT_LABEL)} Use it after setup or data changes. Publish is the main button.`,
		target: 'More menu',
		targetTestId: 'timetable-simple-more-trigger',
		icon: Play,
	},
	{
		title: 'Understand publish blockers',
		body: 'If the readiness chip shows Must fix, tap it to see which classes still need a time slot and why the schedule cannot be published yet.',
		target: 'Readiness chip',
		targetTestId: 'timetable-simple-readiness-chip',
		icon: ListChecks,
	},
	{
		title: 'Fix what blocks publishing',
		// ROW 37: the two former placement steps pointed at
		// `timetable-selection-strip` and `simple-selected-primary-action`, which
		// only render AFTER a class is selected, so a step opened from a cold
		// header could never highlight them. Their guidance is kept, and now hangs
		// off a control that is on screen.
		body: 'Tap the warnings control to open the blocker list and go to what to fix. On the grid, a clean placement is a one-click action and shows a prominent Undo right after saving. Teacher leaving stays a separate bulk task.',
		target: 'Warnings control',
		targetTestId: 'timetable-simple-warnings-control',
		icon: ClipboardCheck,
	},
	{
		title: 'Download a copy for review',
		// ROW 37: the real control, in the real group.
		body: `${morePath('Schedule actions', 'Download schedules')} It saves a copy for offline review or printing.`,
		target: 'More menu',
		targetTestId: 'timetable-simple-more-trigger',
		icon: Download,
	},
];

const PUBLISHED_STEPS: readonly SimpleTutorialStep[] = [
	SCHEDULE_SWITCHER_STEP,
	{
		title: 'This timetable is published',
		body: 'Teachers and students are using the published schedule. It stays in use while you build a new draft.',
		target: 'Published state',
		targetTestId: 'timetable-simple-published-state',
		icon: CheckCircle2,
	},
	{
		// #56 — the tutorial says the same thing the menu item says.
		title: 'Generate a draft',
		body: `${morePath('Schedule actions', BUILD_NEW_DRAFT_LABEL)} ${PUBLISHED_SCHEDULE_STAYS_IN_USE}`,
		target: 'More menu',
		targetTestId: 'timetable-simple-more-trigger',
		icon: Play,
	},
	{
		title: 'Download a copy for review',
		body: `${morePath('Schedule actions', 'Download schedules')} It saves a copy for offline review or printing.`,
		target: 'More menu',
		targetTestId: 'timetable-simple-more-trigger',
		icon: Download,
	},
];

export function simpleTutorialSteps(lifecycle: TimetableLifecycleState | undefined): readonly SimpleTutorialStep[] {
	if (lifecycle === 'published') return PUBLISHED_STEPS;
	if (lifecycle === 'generated-issues' || lifecycle === 'generated-reviewable' || lifecycle === 'pre-generation') return GENERATED_STEPS;
	return NO_RUN_STEPS;
}

export function SimpleTutorialControl({ open, onOpenChange, lifecycle, triggerless = false }: { open: boolean; onOpenChange: (open: boolean) => void; lifecycle?: TimetableLifecycleState; triggerless?: boolean }) {
	const [stepIndex, setStepIndex] = useState(0);
	const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
	const steps = useMemo(() => simpleTutorialSteps(lifecycle), [lifecycle]);
	const step = steps[Math.min(stepIndex, steps.length - 1)];
	const StepIcon = step.icon;
	const isLast = stepIndex >= steps.length - 1;

	useEffect(() => {
		if (open) setStepIndex(0);
	}, [open]);

	useEffect(() => {
		setStepIndex((value) => Math.min(value, steps.length - 1));
	}, [steps.length]);

	useEffect(() => {
		setUnavailableMessage(null);
	}, [stepIndex]);

	const focusStepTarget = () => {
		// ROW 37 — "Show me" must either deliver a visible highlight or say
		// plainly that it cannot. It used to add a ring class to whatever it
		// found and say nothing, so a step whose target was inside the closed
		// More menu, or behind this dialog's own backdrop, produced no visible
		// result at all. Two changes, both in this function:
		//   1. resolve the target, including its alternate face, so the schedule
		//      switcher is found at whichever width is on screen;
		//   2. on success, CLOSE this dialog. The backdrop is what made the ring
		//      invisible, so the highlight now lands on the real control on the
		//      real surface. On failure the dialog stays open and the message
		//      below says why — a step never promises a highlight it cannot
		//      deliver.
		const target = [step.targetTestId, step.altTargetTestId]
			.map((testId) => (testId ? document.querySelector<HTMLElement>(`[data-testid="${testId}"]`) : null))
			.find((element): element is HTMLElement => element != null);
		if (!target) {
			setUnavailableMessage(`"${step.target}" is not on this page. ${step.body}`);
			return;
		}
		setUnavailableMessage(null);
		onOpenChange(false);
		target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
		target.focus({ preventScroll: true });
		target.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
		target.setAttribute('data-tutorial-highlight', 'true');
		window.setTimeout(() => {
			target.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
			target.removeAttribute('data-tutorial-highlight');
		}, 4000);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* A3 — the tutorial trigger moved to More, so the dialog can render
			    without an inline trigger while the More item owns the opening. */}
			{triggerless ? null : (
				<DialogTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 min-h-11 min-w-11 gap-1.5 px-1.5 text-xs sm:min-h-0 sm:min-w-0 sm:px-2.5"
						aria-label={`Open ${CLASS_SCHEDULE_LABEL.toLowerCase()} tutorial`}
						data-testid="timetable-simple-tutorial-trigger"
					>
						<BookOpen className="size-3.5" aria-hidden="true" />
						<span className="hidden sm:inline">Tutorial</span>
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="max-w-md" data-testid="timetable-simple-tutorial">
				<DialogHeader>
					<DialogTitle>Simple schedule tutorial</DialogTitle>
					<DialogDescription>
						Step {stepIndex + 1} of {steps.length}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3" data-testid="timetable-simple-tutorial-step" aria-live="polite">
					<div className="flex gap-1" aria-hidden="true">
						{steps.map((_, index) => (
							<div
								key={index}
								className={cn('h-1 flex-1 rounded-full', index <= stepIndex ? 'bg-primary' : 'bg-border')}
							/>
						))}
					</div>
					<div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-[auto_1fr]" data-testid="simple-visual-help-step">
						<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
							<StepIcon className="size-5" />
						</div>
						<div className="min-w-0">
							<Badge variant="outline" className="mb-2 h-6 max-w-full text-xs">
								<span className="truncate">Look for: {step.target}</span>
							</Badge>
							<p className="text-sm font-semibold text-foreground">{step.title}</p>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
							<Button type="button" variant="secondary" size="sm" className="mt-3 h-8 text-xs" onClick={focusStepTarget}>
								Show me
							</Button>
							{unavailableMessage ? (
								<p
									role="status"
									data-testid="timetable-simple-tutorial-unavailable"
									className="mt-2 text-xs font-medium text-amber-700"
								>
									{unavailableMessage}
								</p>
							) : null}
						</div>
					</div>
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
					<Button
						type="button"
						variant="outline"
						disabled={stepIndex === 0}
						onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
						data-testid="timetable-simple-tutorial-back"
					>
						Back
					</Button>
					<Button
						type="button"
						onClick={() => {
							if (isLast) onOpenChange(false);
							else setStepIndex((value) => Math.min(steps.length - 1, value + 1));
						}}
						data-testid="timetable-simple-tutorial-next"
					>
						{isLast ? 'Finish' : 'Next'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
