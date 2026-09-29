/**
 * A9 C3 (2026-09-29) — THE GUIDED HOME-ROOM STEP.
 *
 * ── WHY THIS FILE IS STILL NAMED `HomeRoomAutoAssignDialog` ──────────────────────────────
 * The route it drives really is `POST /sections/home-rooms/:schoolYearId/auto-assign`, and
 * `a3-c8-warning-token.test.ts` pins this file's `GRADE_COLORS` G8 line by exact content
 * (`GRADE_BADGE_EXEMPTIONS`) while `a3-sections-map-layout.test.ts` lists the path in two
 * inventories. Renaming it would churn three unrelated guards for a cosmetic gain, so the
 * file keeps its name and its transport helper and loses only the jargon.
 *
 * ── WHAT THE OLDER-USER AUDIT FOUND, AND WHAT CHANGED ──────────────────────────────────
 * The old dialog was the page's worst surface. It opened on two switches a scheduler cannot
 * evaluate ("Overwrite existing", "Cross-grade fallback"), led with four count badges
 * ("20 considered", "17 to assign", "3 skipped", "20 preserved"), grouped the list by grade
 * behind `G7` sub-headers, and labelled every row with a translated enum ("Grade match",
 * "Any-grade building"). The count that matters — how many sections got a room — was the
 * smallest text in the header, and the review the operator was asked to perform was spread
 * across four visual systems.
 *
 * Now: ONE preview, ONE review list, ONE apply. Every enum is translated in
 * `@/lib/home-room-review-copy` (a pure module, so the wording is testable rather than
 * greppable), every row is changeable before applying through the SAME `SectionRoomPicker`
 * the page's rows used — no new picker, no page-local clone, §8 "one look per control" — and
 * the outcome is reported in one sentence that names what did NOT save.
 *
 * ── WHY THE APPLY IS THE PER-SECTION `PUT` AND NOT `mode: 'apply'` ───────────────────────
 * The packet allowed either and required ONE choice, used consistently. `mode: 'apply'`
 * re-derives the assignment server-side from the same matching rules and writes THAT set, so
 * it would silently discard every correction the scheduler just made in the review list — the
 * exact data the review exists to produce. So the apply is
 * `PUT /sections/home-rooms/:schoolYearId` with the whole reviewed set, which persists exactly
 * what was shown and approved.
 *
 * The id spaces agree, which is the load-bearing fact: `getSectionSummary` maps
 * `id: m.externalId` (section.service.ts:382), `computeAutoAssign` returns
 * `sectionId: section.externalId`, and `updateSectionHomeRooms` selects on
 * `externalId: { in: uniqueSectionIds }` (section.service.ts:499). One id space, one PUT, no
 * translation — and the same `{ sectionId, homeRoomId }` payload the per-row change path
 * already sends, so the batch is not a second, untested write shape.
 *
 * ── WHY A FAILURE IS ALL-OR-NOTHING ─────────────────────────────────────────────────────
 * `updateSectionHomeRooms` runs the whole batch inside ONE `$transaction`, so a rejected write
 * saves nothing and the failure sentence may say so plainly. The partial case is real and is
 * reported by count instead: the service `continue`s a row whose section is absent from the
 * mirror or whose room is not a teaching room in this school, and returns only `{ updated }`,
 * so `savedOutcomeSentence` names the rows that were left unchanged rather than implying the
 * whole batch landed.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { ScrollArea } from '@/ui/scroll-area';
import { SectionRoomPicker, type RoomOption } from './SectionRoomPicker';
import {
	MANUAL_CHOICE_NOTE,
	applyActionLabel,
	applyFailureSentence,
	assignmentReasonPhrase,
	guidedStepActionLabel,
	saveOutcomeSentence,
	skippedReasonPhrase,
} from '@/lib/home-room-review-copy';

type AutoAssignAssignment = {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	homeRoomId: number;
	roomName: string;
	buildingId: number;
	buildingName: string;
	reason: string;
};

type AutoAssignSkipped = {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	reason: string;
};

type AutoAssignResult = {
	schoolId: number;
	schoolYearId: number;
	mode: string;
	overwriteExisting: boolean;
	allowCrossGradeFallback: boolean;
	assignments: AutoAssignAssignment[];
	skipped: AutoAssignSkipped[];
	counts: {
		sectionsConsidered: number;
		assigned: number;
		skipped: number;
		existingPreserved: number;
		applied: number;
	};
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schoolId: number;
	schoolYearId: number;
	/** The page's own room list, so the review rows offer the same picker as the page. */
	homeRoomOptions: RoomOption[];
	/** Which section currently holds each room, so the picker can warn before a swap. */
	roomOccupancy?: Map<number, string>;
	/** The page's ONE writability gate. False means the review is read-only. */
	canWrite: boolean;
	/** The sentence explaining WHY it is read-only; rendered with the disabled action. */
	notSavedNotice?: string | null;
	onApplied: () => void;
	/** The page's own notice line, for a save the page must also report. */
	onNotice?: (message: string) => void;
};

/**
 * DepEd grade colours (AGENTS.md §8): G7 green, G8 yellow, G9 red, G10 blue.
 *
 * A3-C8r1 swept this file's G8 badge (Tailwind's yellow 100 surface + yellow 700 text) onto
 * the warning family, which was wrong: this is a live grade badge (rendered where
 * `GRADE_COLORS` is consumed in this file — see the guard in
 * a3-c8-warning-token.test.ts, which asserts the reference rather than a line number,
 * because the line moves every time a comment is added here)
 * as `Grade 7`), so the sweep turned G8 from yellow into "needs attention" and broke the §8
 * grade ramp. The entry below is restored to its original shades and is exempted, by exact
 * line, from the A3-C8 ratchet — see GRADE_BADGE_EXEMPTIONS in
 * `src/lib/__tests__/a3-c8-warning-token.test.ts`, which is what makes the exemption safe.
 *
 * Note the class names are deliberately NOT spelled out in this comment: the ratchet counts
 * LINES CONTAINING a raw colour class, so quoting them here would add a false offender.
 *
 * A9 C3: the badge now carries the words `Grade 7` rather than `G7`, because the review list
 * is read by someone who does not know that G7 is a grade. The COLOUR is unchanged, and the
 * exemption below still holds, so §8 still holds too.
 */
const GRADE_COLORS: Record<number, string> = {
	7: 'bg-green-100 text-green-700',
	8: 'bg-yellow-100 text-yellow-700',
	9: 'bg-red-100 text-red-700',
	10: 'bg-blue-100 text-blue-700',
};

/** The grade badge's accessible form. `G7` is the operator's shorthand elsewhere, not a word. */
function gradeBadge(gradeLevel: number): string {
	return `Grade ${gradeLevel}`;
}

export type HomeRoomAutoAssignRequest = {
	schoolId: number;
	schoolYearId: number;
	mode: 'preview' | 'apply';
	overwriteExisting: boolean;
	allowCrossGradeFallback: boolean;
};

/**
 * ACTOR-SCOPE-C01 — fail-closed home-room auto-assign dispatcher.
 *
 * A missing/invalid actor school or school year dispatches NOTHING and returns
 * `null`. Both the preview and the apply paths go through this single function,
 * so an unresolved scope can never POST to the auto-assign route.
 */
export async function requestHomeRoomAutoAssign(input: HomeRoomAutoAssignRequest): Promise<AutoAssignResult | null> {
	if (!Number.isInteger(input.schoolId) || input.schoolId <= 0) return null;
	if (!Number.isInteger(input.schoolYearId) || input.schoolYearId <= 0) return null;
	const { data } = await atlasApi.post<AutoAssignResult>(
		`/sections/home-rooms/${input.schoolYearId}/auto-assign`,
		{
			schoolId: input.schoolId,
			mode: input.mode,
			overwriteExisting: input.overwriteExisting,
			allowCrossGradeFallback: input.allowCrossGradeFallback,
		},
	);
	return data;
}

/** The server's typed message when it refuses, in the operator's words where we have one. */
function typedFailureReason(error: unknown): string {
	const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
	return typeof message === 'string' ? message : 'ATLAS refused to save these rooms.';
}

export function HomeRoomAutoAssignDialog({
	open,
	onOpenChange,
	schoolId,
	schoolYearId,
	homeRoomOptions,
	roomOccupancy,
	canWrite,
	notSavedNotice,
	onApplied,
	onNotice,
}: Props) {
	const [loading, setLoading] = useState(false);
	const [applying, setApplying] = useState(false);
	const [result, setResult] = useState<AutoAssignResult | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [applyError, setApplyError] = useState<string | null>(null);
	const [outcome, setOutcome] = useState<string | null>(null);
	/**
	 * The scheduler's corrections, keyed by `sectionId`. A key that is PRESENT is a row she
	 * changed herself, which is why the presence test — not the value — decides what the row
	 * says about itself. It is reset on every preview, so a closed dialog never resurrects a
	 * stale correction against a fresh suggestion.
	 */
	const [manualChoice, setManualChoice] = useState<Record<number, number | null>>({});

	const fetchPreview = useCallback(async () => {
		// ACTOR-SCOPE-C01: never dispatch while the actor school is unresolved.
		if (!Number.isInteger(schoolId) || schoolId <= 0 || !Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			setLoading(false);
			setResult(null);
			setLoadError(null);
			return;
		}
		setLoading(true);
		setLoadError(null);
		setApplyError(null);
		setOutcome(null);
		setManualChoice({});
		try {
			// `overwriteExisting: false` is not a preference here, it is the whole point: a
			// section that already has a room keeps it, and the review only covers the ones
			// that have none. The old dialog exposed this as a switch.
			const data = await requestHomeRoomAutoAssign({
				schoolId,
				schoolYearId,
				mode: 'preview',
				overwriteExisting: false,
				allowCrossGradeFallback: false,
			});
			setResult(data);
		} catch (error) {
			setResult(null);
			setLoadError(typedFailureReason(error));
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => {
		if (open) {
			void fetchPreview();
		} else {
			setResult(null);
			setLoadError(null);
			setApplyError(null);
			setOutcome(null);
			setManualChoice({});
		}
	}, [open, fetchPreview]);

	/** The room a row will actually be saved with, and whether the scheduler chose it. */
	const rows = useMemo(() => {
		return (result?.assignments ?? []).map((assignment) => {
			const isManual = Object.prototype.hasOwnProperty.call(manualChoice, assignment.sectionId);
			return {
				assignment,
				roomId: isManual ? manualChoice[assignment.sectionId] : assignment.homeRoomId,
				isManual,
			};
		});
	}, [result, manualChoice]);

	const manualCount = useMemo(() => rows.filter((row) => row.isManual).length, [rows]);

	const apply = useCallback(async () => {
		if (!canWrite) return;
		if (!Number.isInteger(schoolId) || schoolId <= 0 || !Number.isInteger(schoolYearId) || schoolYearId <= 0) return;
		const assignments = rows
			.filter((row) => row.roomId != null)
			.map((row) => ({ sectionId: row.assignment.sectionId, homeRoomId: row.roomId }));
		if (assignments.length === 0) return;

		setApplying(true);
		setApplyError(null);
		setOutcome(null);
		try {
			const { data } = await atlasApi.put<{ updated?: number }>(
				`/sections/home-rooms/${schoolYearId}`,
				{ schoolId, assignments },
			);
			const sentence = saveOutcomeSentence({ requested: assignments.length, updated: Number(data?.updated ?? 0) });
			setOutcome(sentence);
			onNotice?.(sentence);
			onApplied();
		} catch (error) {
			const sentence = applyFailureSentence(typedFailureReason(error));
			setApplyError(sentence);
			onNotice?.(sentence);
		} finally {
			setApplying(false);
		}
	}, [canWrite, onApplied, onNotice, rows, schoolId, schoolYearId]);

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	const skipped = result?.skipped ?? [];
	const nothingToDo = result !== null && result.assignments.length === 0 && skipped.length === 0;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="flex max-h-[80vh] max-w-3xl flex-col">
				<DialogHeader>
					<DialogTitle>Give every section a home room</DialogTitle>
					<DialogDescription>
						{loading
							? 'Reading the free rooms\u2026'
							: result
								? `${result.counts.assigned} ${result.counts.assigned === 1 ? 'section gets' : 'sections get'} a room below. Change any row, then apply them together.`
								: 'ATLAS could not read the free rooms.'}
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 space-y-3 overflow-auto">
					{loading ? (
						<div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							Reading the free rooms\u2026
						</div>
					) : null}

					{loadError ? (
						<div
							role="alert"
							data-testid="guided-step-load-error"
							className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						>
							<AlertCircle className="mt-0.5 size-4 shrink-0" />
							<span>{loadError} Nothing was changed.</span>
						</div>
					) : null}

					{applyError ? (
						<div
							role="alert"
							data-testid="guided-step-apply-error"
							className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						>
							<AlertCircle className="mt-0.5 size-4 shrink-0" />
							<span>{applyError}</span>
						</div>
					) : null}

					{outcome ? (
						<div
							role="status"
							data-testid="guided-step-outcome"
							className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
						>
							<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
							<span>{outcome}</span>
						</div>
					) : null}

					{!canWrite && !loading ? (
						<p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" data-testid="guided-step-readonly">
							{notSavedNotice ?? 'Rooms cannot be saved right now. The list below still shows what would change.'}
						</p>
					) : null}

					{rows.length > 0 ? (
						<ul className="space-y-1.5" data-testid="guided-step-review-list">
							{rows.map((row) => {
								const { assignment } = row;
								return (
									/* A9 c2 — THE PICKER OWNS THE ROW'S SPARE WIDTH. The operator's
									 * crop showed the trigger clipped mid-word
									 * (`G7 Room 101  - Grade 7 Academic V`) because the whole room
									 * label competed on ONE flex line with a second, separately
									 * truncated label in the right-hand gutter ("same grade wing").
									 * The gutter label moves to its OWN line under the row (it is a
									 * qualifier, not an identifier), and the freed width goes to the
									 * picker. The dialog is NOT widened and the type is NOT shrunk;
									 * `flex-[2] basis-0` gives the picker two thirds of the slack so a
									 * normal room + building reads in full at 1366x768 and 1280x720
									 * (operator decision #10: normal width, never near full screen). */
									<li key={assignment.sectionId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/70 px-2.5 py-2" data-testid="guided-step-row" data-section-id={assignment.sectionId} data-manual={row.isManual ? 'true' : 'false'}>
										<span
											className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${GRADE_COLORS[assignment.gradeLevel] ?? 'bg-muted text-muted-foreground'}`}
										>
											{gradeBadge(assignment.gradeLevel)}
										</span>
										<span className="min-w-0 flex-1 basis-0 truncate text-sm font-semibold text-foreground">{assignment.sectionName}</span>
										<span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">→</span>
										<div className="min-w-0 flex-[2] basis-0">
											<SectionRoomPicker
												sectionId={assignment.sectionId}
												sectionName={assignment.sectionName}
												value={row.roomId}
												options={homeRoomOptions}
												onSelect={(roomId) => setManualChoice((current) => ({ ...current, [assignment.sectionId]: roomId }))}
												disabled={!canWrite}
												schoolId={schoolId}
												roomOccupancy={roomOccupancy}
											/>
										</div>
										<span className="w-full text-xs text-muted-foreground" data-testid="guided-step-row-reason">
											{row.isManual ? MANUAL_CHOICE_NOTE : assignmentReasonPhrase(assignment.reason)}
										</span>
									</li>
								);
							})}
						</ul>
					) : null}

					{skipped.length > 0 ? (
						<div className="space-y-1.5" data-testid="guided-step-skipped">
							<h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
								{skipped.length} {skipped.length === 1 ? 'section was' : 'sections were'} left out
							</h3>
							<ul className="space-y-1.5">
								{skipped.map((item) => {
									const copy = skippedReasonPhrase(item.reason);
									return (
										<li key={item.sectionId} className="rounded-lg border border-warning-border bg-warning-muted px-2.5 py-2" data-testid="guided-step-skipped-row">
											<p className="text-sm font-semibold text-warning-foreground">
												{gradeBadge(item.gradeLevel)} · {item.sectionName} — {copy.reason}
											</p>
											<p className="mt-0.5 text-xs text-warning-foreground">{copy.fix}</p>
										</li>
									);
								})}
							</ul>
						</div>
					) : null}

					{nothingToDo && !loading ? (
						<div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
							<CheckCircle2 className="size-4" />
							Every section already has a home room.
						</div>
					) : null}
				</div>

				<DialogFooter className="flex-row items-center gap-2 sm:gap-0">
					<Button variant="ghost" size="sm" onClick={handleClose}>
						Close
					</Button>
					<div className="ml-auto flex items-center gap-2">
						{manualCount > 0 ? (
							<span className="text-xs text-muted-foreground" data-testid="guided-step-manual-count">
								{manualCount} changed by you
							</span>
						) : null}
						<Button
							size="sm"
							onClick={apply}
							disabled={loading || applying || !canWrite || rows.length === 0}
							className="font-bold"
							data-testid="guided-step-apply"
						>
							{applying ? 'Saving\u2026' : applyActionLabel(rows.length)}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
