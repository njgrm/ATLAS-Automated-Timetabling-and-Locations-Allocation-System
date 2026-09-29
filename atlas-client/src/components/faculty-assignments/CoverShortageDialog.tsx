/**
 * A6 c5 §2 — `Cover these classes`: the one-step cover dialog.
 *
 * THE DEFECT IT REMOVES, in the operator's own shape. The shortage existed, and
 * reaching it took FOUR decisions the scheduler had to make before anything
 * happened: read a percentage, read a chip, open a repair-queue item, then click
 * through to Subject Coverage to work out which subject was short. The fix is
 * that the subject is already named on the line, and this dialog opens on this
 * screen — no side-nav detour, no route change, no reload. That is why it is
 * mounted by the PAGE rather than navigated to.
 *
 * WHY THE PREVIEW IS NOT OPTIONAL AND NOT THE SAME CALL.
 *
 * `POST /faculty-assignments/coverage/repair` is a WRITE endpoint. It takes
 * `apply`, and the server returns `plannedAssignments` IDENTICALLY for
 * `apply:false` and `apply:true` — so the preview is exactly what the apply
 * would do, and it is free. The primary action is therefore disabled until a
 * preview has RESOLVED, not merely until the dialog opened: a scheduler must
 * never be able to write a plan they have not seen. `previewPending` is the
 * single gate and it is passed in rather than derived, so the hook that owns
 * the request owns the gate too.
 *
 * `teach outside department` IS DELIBERATELY ABSENT. The A8 endpoint takes
 * `schoolId`, `schoolYearId`, `subjectCodes`, `subjectIds`, `maxHoursPerWeek`,
 * `teacherName` and `apply` — and nothing else. A control promising it would be
 * a control that lies, and the packet forbids stubbing it. It is recorded as
 * follow-up 1, naming the missing server field.
 *
 * EVERY CONTROL IS AN `@/ui` PRIMITIVE (AGENTS.md §8): `@/ui/dialog` for the
 * frame, `@/ui/button` for every action, `@/ui/label` for the option names. No
 * native `<select>`, no raw `<button>`, no `<details>`, no `title` attribute.
 * The options are a labelled `role="radiogroup"` of `@/ui/button`s rather than
 * an invented card pattern, because `@radix-ui/react-radio-group` is not a
 * dependency of this client and inventing a fourth picker look is the defect
 * §8's "one look per control" names.
 */
import { useEffect } from 'react';
import { CheckCircle2, CircleAlert, Loader2, UserRoundPlus } from 'lucide-react';

import { Button } from '@/ui/button';
import { Label } from '@/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';

import {
	COVER_OPTIONS,
	coverPreviewNumber,
	isCoverOptionApplicable,
	type CoverDriftModel,
	type CoverOption,
	type CoverOptionId,
	type CoverOutcomeModel,
} from '@/components/faculty-assignments/teachingLoadOutage';

export type CoverPreviewState = {
	/** The server's `plannedPairCount` for the option, or null before it resolves. */
	plannedPairCount: number | null;
};

export type CoverShortageDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The subject's own name, so the title never says "classes" about nothing. */
	subjectName: string;
	/** How many classes in this subject have no real teacher. */
	shortClassCount: number;
	selectedOptionId: CoverOptionId;
	onSelectOption: (optionId: CoverOptionId) => void;
	/** `apply:false` only. Keyed by option id; absent while pending. */
	previews: Record<string, CoverPreviewState | undefined>;
	/**
	 * The classes the SELECTED option's plan would assign, already mapped to
	 * class names by the caller.
	 *
	 * The server's `plannedAssignments[].assignableSectionIds` and
	 * `assignedPairs` are both id lists, and `assignedPairs` is empty on a
	 * preview, so the plan's own section list is the only source. The mapping
	 * needs the page's `subjects` and `sectionMap`, so it is done there — the
	 * alternative is a second authority for a class name.
	 */
	previewClassNames: string[];
	/** True from open until the first preview resolves. Gates the primary action. */
	previewPending: boolean;
	previewError: string | null;
	/** The apply-409 drift surface, or null while no drift has happened. */
	drift: CoverDriftModel | null;
	/** The after-apply state, or null before an apply succeeds. */
	outcome: CoverOutcomeModel | null;
	applying: boolean;
	applyError: string | null;
	/** The page's own write gate, so a read-only workspace never offers the action. */
	writeBlockedReason: string | null;
	onPreview: () => void;
	onApply: () => void;
};

function optionPreviewText(
	option: CoverOption,
	previews: Record<string, CoverPreviewState | undefined>,
	shortClassCount: number,
	previewPending: boolean,
): string {
	if (!isCoverOptionApplicable(option)) return 'No preview needed. Nothing is saved.';
	const preview = previews[option.id];
	if (previewPending && !preview) return 'Checking what this would assign…';
	const number = coverPreviewNumber({
		plannedPairCount: preview?.plannedPairCount ?? null,
		shortClassCount,
	});
	return number ?? 'ATLAS could not plan classes for this load yet.';
}

/**
 * The primary action's gate, as ONE function.
 *
 * `selectedPreviewMissing` is the load-bearing half: `previewPending` alone
 * would let the button re-enable after a FAILED preview, which is how a write
 * path becomes reachable without a plan. Three independent reasons to hold it —
 * no preview, a preview in flight, a workspace that cannot be written to — and
 * the read-only reason is passed in rather than derived, because the page
 * already owns the truth (`workspaceState.writeBlockedReason`) and a second
 * copy of that rule is a second answer to "can I write?".
 */
export function coverApplyDisabledReason(input: {
	selectedOptionId: CoverOptionId;
	selectedPreview: CoverPreviewState | undefined;
	previewPending: boolean;
	applying: boolean;
	drift: CoverDriftModel | null;
	writeBlockedReason: string | null;
}): string | null {
	const option = COVER_OPTIONS.find((row) => row.id === input.selectedOptionId);
	if (option && !isCoverOptionApplicable(option)) return 'Choose a load before assigning a teacher.';
	if (!input.selectedPreview) return 'Check what this would assign before you save it.';
	if (input.previewPending) return 'ATLAS is still checking what this would assign.';
	if (input.applying) return 'ATLAS is assigning now.';
	if (input.drift) return 'Teaching Load changed. Review again before assigning.';
	if (input.writeBlockedReason) return input.writeBlockedReason;
	return null;
}

export function CoverShortageDialog({
	open,
	onOpenChange,
	subjectName,
	shortClassCount,
	selectedOptionId,
	onSelectOption,
	previews,
	previewClassNames,
	previewPending,
	previewError,
	drift,
	outcome,
	applying,
	applyError,
	writeBlockedReason,
	onPreview,
	onApply,
}: CoverShortageDialogProps) {
	// `Leave it open` is a decision, so its selected state must not look like a
	// contract that could be saved. The panel is a `@/ui` `Button` in radio role
	// with `aria-checked`, and the selected one carries the primary tint.
	useEffect(() => {
		if (!open) onSelectOption('standard-30');
	}, [open, onSelectOption]);

	const selectedPreview = previews[selectedOptionId];
	const disabledReason = coverApplyDisabledReason({
		selectedOptionId,
		selectedPreview,
		previewPending,
		applying,
		drift,
		writeBlockedReason,
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-2xl"
				data-testid="teaching-load-cover-dialog"
				data-subject={subjectName}
			>
				<DialogHeader>
					{/* The title names the SUBJECT, because the whole point of the
					    shortage line is that the scheduler no longer has to find
					    out which subject this is. */}
					<DialogTitle data-testid="teaching-load-cover-title">
						Cover these {subjectName} classes
					</DialogTitle>
					<DialogDescription>
						{shortClassCount === 1
							? 'One class here has no real teacher.'
							: `${shortClassCount} classes here have no real teacher.`}
					</DialogDescription>
				</DialogHeader>

				{outcome && (
					<div
						data-testid="teaching-load-cover-outcome"
						data-complete={outcome.isComplete ? 'true' : 'false'}
						className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
					>
						<p className="font-semibold text-foreground">{outcome.assignedLine}</p>
						<p className="text-muted-foreground" data-testid="teaching-load-cover-still-open">
							{outcome.stillOpenLine}
						</p>
						<p className="text-muted-foreground" data-testid="teaching-load-cover-next-step">
							{outcome.nextStep}
						</p>
					</div>
				)}

				{/* S8: `complete` is a word this surface may only print for a
				    COMPLETE result, and `buildCoverOutcomeModel` decides that
				    from the server's own still-open list. The control below
				    asserts it in both directions. */}
				{!outcome && (
					<div role="radiogroup" aria-label="How much to assign" className="space-y-2">
						{COVER_OPTIONS.map((option) => {
							const selected = option.id === selectedOptionId;
							return (
								<div
									key={option.id}
									className="rounded-lg border border-border/60 p-3"
									data-testid={`teaching-load-cover-option-${option.id}`}
									data-selected={selected ? 'true' : 'false'}
								>
									<Button
										type="button"
										role="radio"
										aria-checked={selected}
										variant={selected ? 'secondary' : 'ghost'}
										className="h-auto w-full justify-start gap-2 p-0 text-left"
										onClick={() => onSelectOption(option.id)}
									>
										<UserRoundPlus className="size-4 shrink-0" aria-hidden="true" />
										<span className="min-w-0">
											<Label asChild>
												<span className="block text-sm font-semibold text-foreground">{option.label}</span>
											</Label>
											{/* The consequence, on the option, where the decision
											    is made — never as a helper sentence under a
											    button (AGENTS.md §8). */}
											<span className="mt-0.5 block text-xs text-muted-foreground">{option.consequence}</span>
										</span>
									</Button>
									<p
										className="mt-1.5 pl-6 text-xs font-semibold text-foreground"
										data-testid={`teaching-load-cover-preview-${option.id}`}
									>
										{optionPreviewText(option, previews, shortClassCount, previewPending)}
									</p>
								</div>
							);
						})}
					</div>
				)}

				{/* The PREVIEW, in words. `plannedAssignments[].assignableSectionIds`
				    are ids; `assignedPairs` is empty on a preview, so the plan's own
				    section list is what this renders — mapped to class names by the
				    caller and passed in as `previewClassNames`. */}
				{!outcome && previewClassNames.length > 0 && (
					<div
						data-testid="teaching-load-cover-preview-classes"
						className="rounded-lg border border-border/60 px-3 py-2 text-sm"
					>
						<p className="text-xs font-bold uppercase text-muted-foreground">
							See what it will assign
						</p>
						<ul className="mt-1 list-inside list-disc text-sm text-foreground">
							{previewClassNames.map((name) => (
								<li key={name}>{name}</li>
							))}
						</ul>
					</div>
				)}

				{previewError && (
					<p
						data-testid="teaching-load-cover-preview-error"
						className="rounded-lg border border-warning-border bg-warning-muted px-2 py-1 text-xs font-semibold text-warning-foreground"
						aria-live="polite"
					>
						{previewError}
					</p>
				)}

				{applyError && (
					<p
						data-testid="teaching-load-cover-apply-error"
						className="rounded-lg border border-warning-border bg-warning-muted px-2 py-1 text-xs font-semibold text-warning-foreground"
						aria-live="polite"
					>
						{applyError}
					</p>
				)}

				{drift && (
					<div
						data-testid="teaching-load-cover-drift"
						className="rounded-lg border border-warning-border bg-warning-muted px-3 py-2 text-sm text-warning-foreground"
					>
						<p className="flex items-start gap-1.5 font-semibold">
							<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<span>{drift.headline}</span>
						</p>
						<p className="mt-1" data-testid="teaching-load-cover-drift-changed">
							{drift.changedLine}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="mt-2 h-7 gap-1.5 px-2 text-xs"
							data-testid="teaching-load-cover-review-again"
							onClick={onPreview}
						>
							{drift.retryLabel}
						</Button>
					</div>
				)}

				<DialogFooter className="flex flex-wrap items-center justify-between gap-2">
					<div className="min-w-0 text-xs text-muted-foreground">
						{outcome ? (
							<span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
								<CheckCircle2 className="size-3.5" aria-hidden="true" />
								{outcome.isComplete ? 'These classes are covered.' : 'Some classes are still open.'}
							</span>
						) : (
							<span>Nothing is saved until you choose `Assign this teacher now`.</span>
						)}
					</div>
					<div className="flex flex-wrap justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
							data-testid="teaching-load-cover-close"
						>
							{outcome ? 'Close' : 'Cancel'}
						</Button>
						{!outcome && (
							<>
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-9 gap-1.5 px-3"
												disabled={previewPending}
												aria-busy={previewPending}
												data-testid="teaching-load-cover-preview-action"
												onClick={onPreview}
											>
												{previewPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
												See what it will assign
											</Button>
										</span>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="max-w-64">
										ATLAS checks the plan without saving anything.
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<Button
												type="button"
												size="sm"
												className="h-9 gap-1.5 px-3"
												disabled={Boolean(disabledReason)}
												data-testid="teaching-load-cover-apply"
												data-disabled-reason={disabledReason ?? ''}
												onClick={onApply}
											>
												Assign this teacher now
											</Button>
										</span>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="max-w-64 font-semibold">
										{disabledReason ?? 'Save a to-be-hired teacher and the classes this load covers.'}
									</TooltipContent>
								</Tooltip>
							</>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
