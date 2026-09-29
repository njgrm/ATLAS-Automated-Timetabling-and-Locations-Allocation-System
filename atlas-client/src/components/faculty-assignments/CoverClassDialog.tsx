/**
 * A6 c10 — `Cover this class`: ONE window, opened from anywhere a class is open.
 *
 * WHAT IT IS, in the operator's shape. Before this, covering a class meant
 * reaching a percentage, then a chip, then a subject, then a dialog that
 * proposed a to-be-hired record. The Codex audit recorded the result: on
 * `/subjects`, "MISSING COVERAGE 0" and "Full coverage" while the Teaching Load
 * header said 72 classes still needed a real teacher, and on the open-class list
 * "no open class is reachable" — clicks-to-cover-with-real-teacher: 0. This
 * window is the missing door, and it is ONE door: the same component from
 * Sections, from Subjects' coverage review, from the staffing figure's class
 * list, and from a placeholder's own card.
 *
 * THE SHAPE, and why it is this shape and not a table.
 *
 *  · The header names ONE class: `Grade 8 – Rizal · MAPEH · 4 h/week`. The
 *    window is about a class, so it says which one. The hours clause is dropped
 *    when no read supplied it (see `coverClassHeaderLine`).
 *  · THREE plain groups, in the order the packet names them, and no fourth:
 *    teachers for this subject, teachers from other departments, anyone with free
 *    hours. A group with nobody in it is not rendered — an empty heading above a
 *    quiet last-resort link is noise.
 *  · Each row: name, department, `18 h → 22 h of 30 h`, ONE outline `Assign`
 *    button. The load consequence is on the row, where the decision is made, and
 *    never as a helper sentence under a control (AGENTS.md §8).
 *  · An over-cap row is greyed with the reason READABLE, and its button is the
 *    only one disabled. Hidden is not an option: a scheduler who cannot see the
 *    over-cap teacher cannot decide that the over-cap teacher is the right answer.
 *  · The to-be-hired path is the LAST element, visually last, and a quiet
 *    link-button — the operator's "absolute last resort" made into a position on
 *    the screen rather than a promise in a document.
 *
 * ONE LOOK PER CONTROL (§8). Every `Assign` is the same `@/ui/button` `outline`
 * at `h-8 … text-xs`, the same control as `Cover these classes` and
 * `Review load` on Teaching Load. The last-resort row is the same primitive in
 * `variant="link"`, the same look as the `+N more` control beside it. There is no
 * page-local chrome, and no second Assign look anywhere in the window.
 *
 * THE ALLOW PROMPT IS A QUESTION, NOT A TOAST. Choosing a cross-department
 * teacher asks ONCE — "Allow Maria Reyes to teach MAPEH?  She is in Science" —
 * and the answer retries the identical request with the permission. It is a
 * `@/ui` `AlertDialog`-shaped decision rendered inside the same window rather
 * than a second window stacked on the first, because a scheduler who has just
 * chosen a teacher should be answering a question about THAT choice, not
 * navigating away from it. Cancel is the same weight as the positive control and
 * leaves nothing behind.
 */
import { CheckCircle2, CircleAlert, Loader2, UserRoundPlus } from 'lucide-react';

import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

import {
	COVER_LAST_RESORT_LABEL,
	coverCandidateAssignDisabled,
	coverCandidateHoursLine,
	coverCandidateNameLine,
	coverCandidateTierBadge,
	groupCoverCandidates,
	type CoverCandidate,
} from '@/components/faculty-assignments/coverClassCandidates';
import { PERMISSION_ALLOW_LABEL } from '@/components/faculty-assignments/coverClassCandidates';
import type { useCoverClass } from '@/hooks/useCoverClass';

type Cover = ReturnType<typeof useCoverClass>;

export type CoverClassDialogProps = {
	cover: Cover;
	/** The page's own write gate, so a read-only workspace never offers a write. */
	writeBlockedReason: string | null;
	/** The last-resort path: the existing to-be-hired dialog, on the existing hook. */
	onAddToBeHired: () => void;
	/** Faculty ids the roster marks as to-be-hired; a placeholder is never a row. */
	placeholderFacultyIds?: ReadonlySet<number>;
};

export function CoverClassDialog({
	cover,
	writeBlockedReason,
	onAddToBeHired,
	placeholderFacultyIds,
}: CoverClassDialogProps) {
	const open = cover.target != null;
	const groups = groupCoverCandidates(cover.candidates, placeholderFacultyIds);
	const hasAnyone = groups.length > 0;

	return (
		/*
		 * A6 c10 — THE DIALOG CARRIES ITS OWN `TooltipProvider`.
		 *
		 * Every row's disabled reason lives in a Tooltip, and Radix's Tooltip throws
		 * without a provider above it. This dialog is mounted from four different
		 * parents, only one of which happens to wrap its slot in a provider — so
		 * relying on a parent would make the window work on Teaching Load and crash
		 * on Sections. A component that cannot be mounted on its own is a component
		 * that gets a provider added at the call site, and then a fourth call site
		 * forgets. The provider is here so the window is self-sufficient.
		 */
		<TooltipProvider delayDuration={200}>
		<Dialog open={open} onOpenChange={(next) => { if (!next) cover.close(); }}>
			<DialogContent
				className="flex max-w-2xl flex-col"
				data-testid="cover-class-dialog"
				data-subject-id={cover.target?.subjectId ?? ''}
				data-section-id={cover.target?.sectionId ?? ''}
			>
				<DialogHeader>
					<DialogTitle className="text-base font-bold" data-testid="cover-class-title">
						{cover.outcome ? 'Class covered' : 'Cover this class'}
					</DialogTitle>
					<DialogDescription className="text-xs" data-testid="cover-class-header-line">
						{cover.headerLine}
					</DialogDescription>
				</DialogHeader>

				{cover.outcome && (
					<div
						className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
						data-testid="cover-class-outcome"
					>
						<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-hidden="true" />
						<p className="text-foreground">
							<span className="font-semibold">{cover.outcome.name}</span> now teaches this class
							{cover.outcome.permissionCreated ? ', and may teach this subject from now on.' : '.'}
						</p>
					</div>
				)}

				{/* THE ONE SCROLL REGION (§8). Every dialog in this client carries it on
				    the base list so a Radix-locked page still leaves the footer
				    reachable — A5 c6 found two dialogs that had confined it to a
				    branch, and a scheduler could not reach the footer. */}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="cover-class-scroll">
					{cover.loading && (
						<p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" data-testid="cover-class-loading">
							<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							ATLAS is looking for teachers who can take this class…
						</p>
					)}

					{cover.loadError && (
						<p
							className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-muted px-3 py-2 text-sm text-warning-foreground"
							data-testid="cover-class-load-error"
						>
							<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							{cover.loadError}
						</p>
					)}

					{cover.permission && (
						<AllowPrompt
							question={cover.permission.question}
							detail={cover.permission.detail}
							busy={cover.assigningFacultyId != null}
							onAllow={cover.allowAndAssign}
							onCancel={cover.cancelPermission}
						/>
					)}

					{!cover.loading && !cover.permission && !cover.outcome && hasAnyone && (
						<div className="space-y-4" data-testid="cover-class-groups">
							{groups.map((group) => (
								<section key={group.id} data-testid={`cover-class-group-${group.id}`}>
									<header className="flex flex-wrap items-baseline gap-x-2">
										<h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
										{group.id === 'OTHER_DEPARTMENT' && (
											<span className="text-xs text-muted-foreground">{group.hint}</span>
										)}
									</header>
									<ul className="mt-1 divide-y divide-border/40">
										{group.candidates.map((candidate) => (
											<CoverRow
												key={candidate.facultyId}
												candidate={candidate}
												writeBlockedReason={writeBlockedReason}
												busy={cover.assigningFacultyId === candidate.facultyId}
												disabled={cover.assigningFacultyId != null}
												onAssign={() => cover.assign(candidate.facultyId, false)}
											/>
										))}
									</ul>
								</section>
							))}
						</div>
					)}

					{!cover.loading && !cover.permission && !cover.outcome && !hasAnyone && !cover.loadError && (
						<p className="py-6 text-sm text-muted-foreground" data-testid="cover-class-empty">
							ATLAS found no teacher who can take this class.
						</p>
					)}

					{cover.assignError && (
						<p
							className="mt-3 rounded-lg border border-warning-border bg-warning-muted px-3 py-2 text-sm text-warning-foreground"
							data-testid="cover-class-assign-error"
							aria-live="polite"
						>
							{cover.assignError}
						</p>
					)}
				</div>

				<DialogFooter className="flex flex-wrap items-center justify-between gap-2">
					{/*
					 * THE LAST-RESORT PATH, visually last and quiet. It is the
					 * operator's "absolute last resort" as a POSITION: the only
					 * greyed, link-shaped control in the window, below everything
					 * else, with no icon and no emphasis. It opens the EXISTING
					 * to-be-hired dialog on the EXISTING hook — this window has no
					 * second create path.
					 */}
					<Button
						type="button"
						variant="link"
						size="sm"
						className="h-auto cursor-pointer px-0 text-xs font-semibold text-muted-foreground"
						data-testid="cover-class-add-to-be-hired"
						onClick={onAddToBeHired}
					>
						{COVER_LAST_RESORT_LABEL}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="h-8 cursor-pointer px-3 text-xs"
						data-testid="cover-class-close"
						onClick={cover.close}
					>
						{cover.outcome ? 'Close' : 'Cancel'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		</TooltipProvider>
	);
}

/**
 * ONE row: name, department, the load consequence, and one outline Assign.
 *
 * The grey is `text-muted-foreground` on the row and `opacity-60` on the whole row
 * when over cap — the reason stays at full contrast inside it, because a
 * disabled control a scheduler cannot read the reason for is the §8 violation
 * the packet names. The badge is null for a `QUALIFIED` teacher, because the
 * group heading already said it.
 */
function CoverRow({
	candidate,
	writeBlockedReason,
	busy,
	disabled,
	onAssign,
}: {
	candidate: CoverCandidate;
	writeBlockedReason: string | null;
	busy: boolean;
	disabled: boolean;
	onAssign: () => void;
}) {
	const { name, context } = coverCandidateNameLine(candidate);
	const hours = coverCandidateHoursLine(candidate);
	const badge = coverCandidateTierBadge(candidate);
	const { disabled: assignDisabled, reason } = coverCandidateAssignDisabled(candidate, writeBlockedReason);
	const greyed = candidate.overCapAfter === true;

	return (
		<li
			className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 ${greyed ? 'opacity-70' : ''}`}
			data-testid={`cover-class-row-${candidate.facultyId}`}
			data-tier={candidate.tier}
			data-over-cap={greyed ? 'true' : 'false'}
		>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium text-foreground">
					{name}
					{badge && <span className="ml-2 text-xs font-normal text-muted-foreground">{badge}</span>}
				</p>
				<p className="text-xs text-muted-foreground">
					{context ? `${context} · ` : ''}{hours || 'Hours are not confirmed yet'}
				</p>
			</div>

			<Tooltip>
				<TooltipTrigger asChild>
					{/* A DISABLED control is wrapped in a span: Radix cannot open a
					    tooltip from a control that cannot take focus, and the reason a
					    row is greyed is the most important thing on it. */}
					<span className="shrink-0">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 cursor-pointer gap-1.5 px-3 text-xs"
							disabled={assignDisabled || disabled}
							aria-busy={busy}
							data-testid={`cover-class-assign-${candidate.facultyId}`}
							data-disabled-reason={reason ?? ''}
							onClick={onAssign}
						>
							{busy
								? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
								: <UserRoundPlus className="size-3.5" aria-hidden="true" />}
							Assign
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-80 font-semibold">
					{reason ?? `Give this class to ${name}.`}
				</TooltipContent>
			</Tooltip>
		</li>
	);
}

/**
 * THE ALLOW PROMPT — one question, two answers, nothing else in the window while
 * it is up.
 *
 * It is rendered INSTEAD of the candidate list rather than beside it, so a
 * scheduler answering the question is not looking at nine other teachers at the
 * moment they confirm a cross-department assignment. The positive control's label
 * is the packet's own `Allow and assign`, and the negative control is `Cancel` at
 * the same weight: this is a permission grant that lasts, so it is a decision and
 * not a confirmation toast.
 */
function AllowPrompt({
	question,
	detail,
	busy,
	onAllow,
	onCancel,
}: {
	question: string;
	detail: string;
	busy: boolean;
	onAllow: () => void;
	onCancel: () => void;
}) {
	return (
		<div
			className="rounded-lg border border-border bg-muted/30 px-4 py-4"
			data-testid="cover-class-permission-prompt"
		>
			<p className="text-sm font-semibold text-foreground" data-testid="cover-class-permission-question">
				{question}
			</p>
			<p className="mt-1 text-sm text-muted-foreground" data-testid="cover-class-permission-detail">
				{detail}
			</p>
			<div className="mt-3 flex flex-wrap justify-end gap-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-8 cursor-pointer px-3 text-xs"
					data-testid="cover-class-permission-cancel"
					onClick={onCancel}
				>
					Cancel
				</Button>
				<Button
					type="button"
					size="sm"
					className="h-8 cursor-pointer gap-1.5 px-3 text-xs"
					aria-busy={busy}
					disabled={busy}
					data-testid="cover-class-permission-allow"
					onClick={onAllow}
				>
					{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
					{PERMISSION_ALLOW_LABEL}
				</Button>
			</div>
		</div>
	);
}
