/**
 * A7-C4 — the three confirmation dialogs, EXTRACTED from `RolloverGuidanceCard`.
 *
 * WHY THIS FILE EXISTS. `RolloverGuidanceCard.tsx` stood at 1008 physical lines
 * against the AGENTS.md §8 limit of 1000 — over the cap before this packet
 * touched it. Adding the two year-setup carry switches to that file was therefore
 * not allowed, so the three confirmation dialogs (`termRepairDialog`,
 * `recoveryConfirmDialog`, `markTestDataConfirmDialog`) moved here, in one piece,
 * leaving the card under the limit.
 *
 * IT IS A MOVE, NOT A REWRITE — and where the first draft of this comment
 * overclaimed, the independent review of 2026-09-29 caught it and the code was
 * changed rather than the sentence. Every prop below is a value or a handler the
 * card already held, and the JSX, the `data-testid`s and the typed-confirmation
 * gates are the same. TWO CORRECTIONS, both now true:
 *
 *   1. CANCEL. The first extraction routed both Cancel buttons through the
 *      dialogs' `onOpenChange` handlers, which is the escape/X/overlay close path
 *      and also clears the typed confirmation text and the acknowledgement. The
 *      base tree's Cancel called the state setter DIRECTLY and so left the text in
 *      place. That silently changed behaviour on the five mounts other lanes own,
 *      so `onRecoveryCancel` / `onMarkTestDataCancel` were added and restore the
 *      base semantics exactly. The reset-on-Close behaviour described in the old
 *      comment is unchanged; only the Cancel button is back to what it was.
 *
 *   2. THE COMPACT BRANCH. Base rendered only `termRepairDialog` on the compact
 *      branch; this component is mounted there and carries all three. No
 *      user-visible difference — a closed Radix `Dialog` emits no DOM, and the
 *      only setters that open the other two dialogs are outside that branch, so
 *      their open state is unreachable there. It is a component-TREE difference,
 *      not a rendered-output one, and the claim "nothing about which mount shows
 *      which dialog has changed" is about rendered output.
 */
import { Loader2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import {
	isTermRepairPreviewApplicable,
	type TermRepairScopeState,
} from '@/lib/term-authority-repair-scope';
import type { RecoveryClassifierResult, TermCachePreviewResult } from '@/lib/settings';

export type RolloverConfirmationDialogsProps = {
	/** A7-C1: the opt-in plain wording. Only `/admin/year-setup` passes it. */
	plainLanguageNextStep: boolean;
	/** The actor school, used by the term dialog's scope resets. */
	schoolId: number;

	// ── RR-TERM-CACHE-C01 / C01R: the shared term-repair dialog ──────────────
	termRepair: TermRepairScopeState;
	termPreview: TermCachePreviewResult | null;
	termPreviewLoading: boolean;
	termApplying: boolean;
	onTermRepairOpenChange: (open: boolean) => void;
	onTermConfirmationTextChange: (value: string) => void;
	onTermApply: () => void;

	// ── A7-C1: the test-data recovery confirmation ───────────────────────────
	showRecoveryConfirm: boolean;
	recoveryConfirmText: string;
	recoveryAckPublished: boolean;
	recovering: boolean;
	recoveryClassification: RecoveryClassifierResult | null;
	onRecoveryOpenChange: (open: boolean) => void;
	onRecoveryConfirmTextChange: (value: string) => void;
	onRecoveryAckPublishedChange: (acknowledged: boolean) => void;
	onRecoveryApply: () => void;
	/**
	 * A7-C4 CORRECTION (independent review, finding N3) — Cancel must do EXACTLY
	 * what it did before the dialogs were extracted: close, and nothing else.
	 *
	 * This is deliberately NOT `onRecoveryOpenChange(false)`. That handler is
	 * Radix's close path (escape, X, overlay) and it ALSO clears the typed
	 * confirmation text and the published acknowledgement. Before the extraction
	 * the Cancel button called `setShowRecoveryConfirm(false)` directly, so a
	 * cancel left the text in place. Routing Cancel through the open-change
	 * handler silently changed that on the FIVE NON-PLAIN MOUNTS other lanes own.
	 * Both behaviours are defensible on their own, but changing another lane's
	 * surface is not this packet's to do (AGENTS §14), so the base semantics are
	 * restored here rather than the new ones being documented.
	 */
	onRecoveryCancel: () => void;

	// ── A7-C1: the mark-as-test-data confirmation ─────────────────────────────
	showMarkTestDataConfirm: boolean;
	markTestDataAcknowledged: boolean;
	markingTestData: boolean;
	onMarkTestDataOpenChange: (open: boolean) => void;
	onMarkTestDataAcknowledgedChange: (acknowledged: boolean) => void;
	onMarkTestData: () => void;
	/** See `onRecoveryCancel` — same reason, same restoration. */
	onMarkTestDataCancel: () => void;
};

export function RolloverConfirmationDialogs(props: RolloverConfirmationDialogsProps) {
	const {
		plainLanguageNextStep, schoolId,
		termRepair, termPreview, termPreviewLoading, termApplying,
		onTermRepairOpenChange, onTermConfirmationTextChange, onTermApply,
		showRecoveryConfirm, recoveryConfirmText, recoveryAckPublished, recovering,
		recoveryClassification,
		onRecoveryOpenChange, onRecoveryConfirmTextChange, onRecoveryAckPublishedChange, onRecoveryApply,
		onRecoveryCancel,
		showMarkTestDataConfirm, markTestDataAcknowledged, markingTestData,
		onMarkTestDataOpenChange, onMarkTestDataAcknowledgedChange, onMarkTestData,
		onMarkTestDataCancel,
	} = props;
	const showTermRepair = termRepair.dialogOpen;
	const termConfirmText = termRepair.confirmationText;

	return (
		<>
			{/* RR-TERM-CACHE-C01 / C01R: the ONE persistence surface for the narrow
			    term catch-up. It never calls the broad rollover apply. */}
			<Dialog open={showTermRepair} onOpenChange={(open) => {
				onTermRepairOpenChange(open);
			}}>
				<DialogContent resizable={false} className="w-[calc(100%-2rem)] sm:max-w-md" hideClose={termApplying} data-testid="rollover-term-repair-dialog">
					<DialogHeader>
						<DialogTitle>Save school year terms</DialogTitle>
						<DialogDescription>
							{termPreview?.message ?? 'Loading the ordered terms from EnrollPro...'}
						</DialogDescription>
					</DialogHeader>
					{termPreviewLoading ? (
						<p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading ordered terms...</p>
					) : null}
					{termPreview ? (
						<>
							<ul className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700" data-testid="rollover-term-repair-terms">
								{termPreview.terms.map((term) => (
									<li key={term.identity} className="flex items-center justify-between gap-2">
										<span className="font-medium">{term.order}. {term.displayLabel}</span>
										<span className="text-xs text-muted-foreground">{term.identity}</span>
									</li>
								))}
							</ul>
							<div className="space-y-2">
								{/* A7-C2 R5 (2026-09-29). The SENTENCE is now plain and the
								    code sits in a readable box. The required PHRASE and the
								    COMPARISON are deliberately untouched: this is the human
								    interlock on a live-data write (AGENTS.md §13) and the server
								    compares the typed value to `termPreview.confirmationText`.
								    Whether to keep the interlock at all is the operator's call and
								    is handed back to Lane C as an open row, not decided here. */}
								<p className="text-sm text-slate-700" data-testid="rollover-term-repair-instruction">
									Copy the code below, paste it in the box, then press Save terms.
								</p>
								<div className="rounded-md border border-slate-300 bg-slate-50 p-2">
									<p className="text-xs font-medium uppercase tracking-wide text-slate-500">Code to type</p>
									<code
										className="mt-0.5 block select-all break-all font-mono text-sm font-semibold tracking-wide text-slate-800"
										data-testid="rollover-term-repair-code"
									>
										{termPreview.confirmationText}
									</code>
								</div>
								<Label htmlFor="term-repair-confirmation" className="sr-only">
									Code to type
								</Label>
								<Input
									id="term-repair-confirmation"
									value={termConfirmText}
									onChange={(event) => onTermConfirmationTextChange(event.target.value)}
									placeholder={termPreview.confirmationText}
									disabled={termApplying}
									autoComplete="off"
								/>
								<p className="text-xs text-muted-foreground" data-testid="rollover-term-repair-effect">
									Saving stores only this school year's ordered terms. Nothing else in ATLAS or EnrollPro changes, and no data is deleted.
								</p>
							</div>
						</>
					) : null}
					<DialogFooter>
						<Button type="button" variant="outline" size="sm" onClick={() => onTermRepairOpenChange(false)} disabled={termApplying}>Cancel</Button>
						<Button
							type="button"
							size="sm"
							onClick={onTermApply}
							disabled={!isTermRepairPreviewApplicable(termRepair, schoolId, termConfirmText) || termPreviewLoading}
							data-testid="rollover-term-repair-apply"
						>
							{termApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Save terms
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* A7-C1: hoisted from the card so BOTH branches render the same dialog. */}
			<Dialog open={showRecoveryConfirm} onOpenChange={(open) => {
				onRecoveryOpenChange(open);
			}}>
				<DialogContent resizable={false} className="w-[calc(100%-2rem)] sm:max-w-md" hideClose={recovering}>
					<DialogHeader>
						<DialogTitle>{plainLanguageNextStep ? 'Clear leftover test data and start the new year' : 'Clear test data and sync EnrollPro'}</DialogTitle>
						<DialogDescription>
							{plainLanguageNextStep
								? 'This will delete ATLAS data for this school year and start the new school year from EnrollPro. This action cannot be undone.'
								: `This will delete ATLAS-owned data for school year #${recoveryClassification?.enrollProActiveYear?.id} and re-sync from EnrollPro. This action cannot be undone.`}
						</DialogDescription>
					</DialogHeader>
					{recoveryClassification?.publishedResetBlocked ? (
						<div className="flex items-start gap-2 text-sm text-warning">
							<Checkbox id="recovery-ack-published" checked={recoveryAckPublished} onCheckedChange={(checked) => onRecoveryAckPublishedChange(checked === true)} disabled={recovering} />
							<Label htmlFor="recovery-ack-published" className="leading-5">I acknowledge that published schedule artifacts exist for this school year and will be cleared.</Label>
						</div>
					) : null}
					<div className="space-y-2">
						<Label htmlFor="recovery-confirmation">Type <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{recoveryClassification?.confirmationText}</code> to confirm</Label>
						<Input id="recovery-confirmation" value={recoveryConfirmText} onChange={(event) => onRecoveryConfirmTextChange(event.target.value)} placeholder={recoveryClassification?.confirmationText ?? ''} disabled={recovering} autoComplete="off" />
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" size="sm" onClick={onRecoveryCancel} disabled={recovering}>Cancel</Button>
						<Button type="button" size="sm" onClick={onRecoveryApply} disabled={recovering || recoveryConfirmText !== recoveryClassification?.confirmationText || (Boolean(recoveryClassification?.publishedResetBlocked) && !recoveryAckPublished)} data-testid="recovery-confirm-apply">
							{recovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							{plainLanguageNextStep ? 'Yes, erase and start the new year' : 'Clear and sync'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showMarkTestDataConfirm} onOpenChange={(open) => {
				onMarkTestDataOpenChange(open);
			}}>
				<DialogContent resizable={false} className="w-[calc(100%-2rem)] sm:max-w-md" hideClose={markingTestData}>
					<DialogHeader>
						<DialogTitle>Mark school year as test data</DialogTitle>
						<DialogDescription>
							{plainLanguageNextStep
								? 'Mark this school year as test data only when its ATLAS data is disposable test data. This enables a separate cleanup review; it does not clear anything now.'
								: `Mark school year #${recoveryClassification?.enrollProActiveYear?.id} only when its ATLAS data is disposable test data. This enables a separate cleanup review; it does not clear anything now.`}
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-start gap-2 text-sm text-warning">
						<Checkbox id="mark-test-data-confirmation" checked={markTestDataAcknowledged} onCheckedChange={(checked) => onMarkTestDataAcknowledgedChange(checked === true)} disabled={markingTestData} />
						<Label htmlFor="mark-test-data-confirmation" className="leading-5">I confirm that this school year contains only disposable test data.</Label>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" size="sm" onClick={onMarkTestDataCancel} disabled={markingTestData}>Cancel</Button>
						<Button type="button" size="sm" onClick={onMarkTestData} disabled={markingTestData || !markTestDataAcknowledged} data-testid="rollover-mark-test-data-confirm">
							{markingTestData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Mark test data
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
