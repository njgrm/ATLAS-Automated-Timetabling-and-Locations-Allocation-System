import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Undo2 } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import { identityOverrideFieldLabel } from '@/lib/published-revision-client';
import type { PublishedRevisionIdentityOverrides, ScheduledEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { formatSlot } from './TacticalSandboxDock.helpers';

type RevisionChange = {
	entry: ScheduledEntry;
	targetFacultyId: number;
	targetCapacity: { statusLabel: string } | null;
};

type RevisionSuccess = {
	revisionId: number;
	effectiveDate: string;
	changeCount: number;
};

type PublishedRevisionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	revisionChanges: RevisionChange[];
	revisionSuccess: RevisionSuccess | null;
	aboveStandardWarningCount: number;
	overCapWarningCount: number;
	effectiveDate: string;
	onEffectiveDateChange: (value: string) => void;
	reason: string;
	onReasonChange: (value: string) => void;
	error: string | null;
	actionHint: string | null;
	submitting: boolean;
	onSubmit: () => void;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	/**
	 * D4 — the optional effective-dated identity delta that will be attached under
	 * `metadata.identityOverrides`. Read-only here: the editor is owned by the
	 * caller; this dialog only states truthfully what will be attached.
	 */
	identityOverrides?: PublishedRevisionIdentityOverrides | null;
	identityOverridesError?: string | null;
	/**
	 * D4 — an optional already-scheduled revision the operator may withdraw
	 * (supersede). The action is reason-required; the base publication can never
	 * be withdrawn and the server fails that closed with a typed 409.
	 */
	withdrawCandidate?: { revisionId: number; effectiveDate: string } | null;
	withdrawReason?: string;
	onWithdrawReasonChange?: (value: string) => void;
	onWithdraw?: () => void;
	withdrawing?: boolean;
	withdrawSuccess?: { revisionId: number } | null;
	withdrawError?: string | null;
};

export function PublishedRevisionDialog({
	open,
	onOpenChange,
	revisionChanges,
	revisionSuccess,
	aboveStandardWarningCount,
	overCapWarningCount,
	effectiveDate,
	onEffectiveDateChange,
	reason,
	onReasonChange,
	error,
	actionHint,
	submitting,
	onSubmit,
	subjectLabel,
	sectionLabel,
	facultyLabel,
	identityOverrides,
	identityOverridesError,
	withdrawCandidate,
	withdrawReason,
	onWithdrawReasonChange,
	onWithdraw,
	withdrawing = false,
	withdrawSuccess,
	withdrawError,
}: PublishedRevisionDialogProps) {
	const revisionFeedback = revisionSuccess
		? {
			tone: 'good' as const,
			message: `Revision #${revisionSuccess.revisionId} is scheduled. The original published schedule remains preserved.`,
		}
		: error
			? {
				tone: 'bad' as const,
				message: `${error}${actionHint ? ` ${actionHint}` : ' Check the date and reason, then try again.'}`,
			}
			: submitting
				? { tone: 'neutral' as const, message: 'Creating the published timetable revision now.' }
				: revisionChanges.length === 0
					? { tone: 'bad' as const, message: 'Choose a replacement teacher before creating a published revision.' }
					: !effectiveDate || !reason.trim()
						? { tone: 'warn' as const, message: 'Add an effective date and a short reason before creating the revision.' }
						: { tone: 'good' as const, message: 'Ready to create a revision. ATLAS will keep the old published schedule for earlier dates.' };
	const feedbackToneClass = revisionFeedback.tone === 'good'
		? 'border-emerald-200 bg-emerald-50 text-emerald-800'
		: revisionFeedback.tone === 'bad'
			? 'border-red-200 bg-red-50 text-red-800'
			: revisionFeedback.tone === 'warn'
				? 'border-amber-200 bg-amber-50 text-amber-900'
				: 'border-border bg-muted/30 text-muted-foreground';

	const identityOverrideFields = identityOverrides
		? Object.entries(identityOverrides).filter(([, value]) => value !== undefined && value !== null).map(([field]) => field)
		: [];
	const withdrawToneClass = withdrawSuccess
		? 'border-emerald-200 bg-emerald-50 text-emerald-800'
		: withdrawError
			? 'border-red-200 bg-red-50 text-red-800'
			: 'border-amber-200 bg-amber-50 text-amber-900';
	const withdrawFeedback = withdrawSuccess
		? `Revision #${withdrawSuccess.revisionId} was withdrawn. Earlier dates still use the original published schedule.`
		: withdrawError
			? withdrawError
			: !(withdrawReason ?? '').trim()
				? 'Add a short reason before withdrawing this revision.'
				: 'Ready to withdraw this scheduled revision. Its prior dates keep the original published schedule.';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="isolate max-w-3xl gap-0 bg-background p-0 text-foreground shadow-2xl" data-testid="published-revision-dialog">
				<DialogHeader className="border-b border-border px-5 py-4">
					<div className="flex flex-wrap items-center gap-2">
						<Badge className="h-5 px-2 text-xs">Timetable revision</Badge>
						<Badge variant="outline" className="h-5 px-2 text-xs">History preserved</Badge>
					</div>
					<DialogTitle>Schedule a published repair</DialogTitle>
					<DialogDescription>
						Choose when these ownership changes take effect. Earlier dates will still show the original published schedule.
					</DialogDescription>
				</DialogHeader>
				<div className="grid max-h-[70vh] gap-4 overflow-y-auto scrollbar-thin px-5 py-4">
					{revisionSuccess ? (
						<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
								<div>
									<p className="font-semibold">Revision #{revisionSuccess.revisionId} is scheduled.</p>
									<p className="mt-0.5 text-xs">{revisionSuccess.changeCount} change{revisionSuccess.changeCount === 1 ? '' : 's'} take effect on {new Date(revisionSuccess.effectiveDate).toLocaleDateString()}. Historical reads before that date still use the original published run.</p>
								</div>
							</div>
						</div>
					) : null}
					<div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
						<div className="flex items-start gap-2">
							<ShieldCheck className="mt-0.5 size-4 shrink-0" />
							<p>This creates a future-dated revision record. It does not overwrite the published run that families and teachers may already have viewed.</p>
						</div>
					</div>
					<div className="rounded-lg border border-border bg-card p-3" data-testid="published-revision-summary">
						<p className="text-sm font-semibold text-foreground">What changes after this date?</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{revisionChanges.length} class{revisionChanges.length === 1 ? '' : 'es'} will use the selected replacement teacher from the effective date forward. Earlier schedule history stays unchanged.
						</p>
					</div>
					{identityOverrideFields.length > 0 || identityOverridesError ? (
						<div className="rounded-lg border border-border bg-card p-3" data-testid="published-revision-identity-overrides">
							<p className="text-sm font-semibold text-foreground">Identity changes after this date</p>
							{identityOverrideFields.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{identityOverrideFields.map((field) => (
										<Badge key={field} variant="outline" className="h-5 bg-background px-2 text-xs font-semibold">
											{identityOverrideFieldLabel(field)}
										</Badge>
									))}
								</div>
							) : null}
							<p className="mt-1 text-xs text-muted-foreground">
								These identity changes apply from the effective date forward. The original published revision and its frozen identity stay unchanged for earlier dates.
							</p>
							{identityOverridesError ? (
								<p className="mt-1 text-xs text-red-700" data-testid="published-revision-identity-overrides-error">{identityOverridesError}</p>
							) : null}
						</div>
					) : null}
					<div className="grid gap-2">
						<div>
							<p className="text-sm font-semibold text-foreground">Changed classes</p>
							<p className="text-xs text-muted-foreground">Review the teacher, room, and time before choosing an effective date.</p>
						</div>
						<div className="grid gap-2">
							{revisionChanges.map((change) => (
								<div key={change.entry.entryId} className="rounded-lg border border-border bg-card p-3 text-xs">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="text-sm font-semibold text-foreground">{subjectLabel(change.entry.subjectId)}</p>
											<p className="text-muted-foreground">{sectionLabel(change.entry.sectionId)} - {formatSlot(change.entry, formatTime)}</p>
										</div>
										{change.targetCapacity ? <Badge variant="outline" className="h-5 px-2 text-xs">{change.targetCapacity.statusLabel}</Badge> : null}
									</div>
									<div className="mt-3 grid gap-2 sm:grid-cols-2">
										<div className="rounded-md border border-border/70 bg-muted/20 p-2">
											<p className="text-xs uppercase text-muted-foreground">Current published</p>
											<p className="font-medium text-foreground">{change.entry.facultyId ? facultyLabel(change.entry.facultyId) : 'No teacher assigned'}</p>
											<p className="text-muted-foreground">Room {change.entry.roomId} - {formatSlot(change.entry, formatTime)}</p>
										</div>
										<div className="rounded-md border border-primary/20 bg-primary/5 p-2">
											<p className="text-xs uppercase text-primary/80">After effective date</p>
											<p className="font-medium text-foreground">{facultyLabel(change.targetFacultyId)}</p>
											<p className="text-muted-foreground">Room {change.entry.roomId} - {formatSlot(change.entry, formatTime)}</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
					{aboveStandardWarningCount > 0 || overCapWarningCount > 0 ? (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								<div>
									<p className="font-semibold">Above-standard load warning</p>
									<p className="mt-0.5">{aboveStandardWarningCount} change{aboveStandardWarningCount === 1 ? '' : 's'} require load review before the revision takes effect.</p>
									{overCapWarningCount > 0 ? <p className="mt-1 text-red-700">{overCapWarningCount} change{overCapWarningCount === 1 ? '' : 's'} may be over cap. Review staffing first.</p> : null}
								</div>
							</div>
						</div>
					) : null}
					<div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
						<div className="space-y-1.5">
							<label htmlFor="published-revision-effective-date" className="text-sm font-medium text-foreground">Effective date</label>
							<Input id="published-revision-effective-date" data-testid="published-teacher-departure-effective-date" type="date" value={effectiveDate} onChange={(event) => onEffectiveDateChange(event.target.value)} aria-describedby="published-revision-effective-date-help" />
							<p id="published-revision-effective-date-help" className="text-xs text-muted-foreground">Choose tomorrow or a later school day.</p>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="published-revision-reason" className="text-sm font-medium text-foreground">Reason</label>
							<Textarea id="published-revision-reason" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Example: teacher reassignment for the next school week" maxLength={500} aria-describedby="published-revision-reason-help" />
							<p id="published-revision-reason-help" className="text-xs text-muted-foreground">This note appears in the revision audit trail.</p>
						</div>
					</div>
					{error ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
							<p className="font-semibold">Revision was not created.</p>
							<p className="mt-0.5 text-xs">{error}</p>
							{actionHint ? <p className="mt-1 text-xs">{actionHint}</p> : null}
						</div>
					) : null}
					{withdrawCandidate ? (
						<div className="rounded-lg border border-border bg-card p-3" data-testid="published-revision-withdraw">
							<div className="flex items-center gap-2">
								<Undo2 className="size-4 text-muted-foreground" aria-hidden="true" />
								<p className="text-sm font-semibold text-foreground">Withdraw scheduled revision #{withdrawCandidate.revisionId}</p>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								This supersedes only this scheduled revision; the original published schedule and every earlier date stay unchanged. The original publication can never be withdrawn.
							</p>
							<div className="mt-3 space-y-1.5">
								<label htmlFor="published-revision-withdraw-reason" className="text-sm font-medium text-foreground">Withdrawal reason</label>
								<Textarea
									id="published-revision-withdraw-reason"
									data-testid="published-revision-withdraw-reason"
									value={withdrawReason ?? ''}
									onChange={(event) => onWithdrawReasonChange?.(event.target.value)}
									placeholder="Example: revision was mis-dated and must be re-created"
									maxLength={500}
									disabled={withdrawing || Boolean(withdrawSuccess)}
								/>
								<p className="text-xs text-muted-foreground">This note appears in the revision audit trail.</p>
							</div>
							<p className={`mt-2 rounded-md border px-2.5 py-2 text-xs ${withdrawToneClass}`} role="status" aria-live="polite" data-testid="published-revision-withdraw-feedback">
								{withdrawFeedback}
							</p>
							<div className="mt-2 flex justify-end">
								<Button
									type="button"
									variant="destructive"
									size="sm"
									disabled={withdrawing || Boolean(withdrawSuccess) || !(withdrawReason ?? '').trim()}
									onClick={onWithdraw}
									data-testid="published-revision-withdraw-submit"
								>
									{withdrawing ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
									Withdraw revision
								</Button>
							</div>
						</div>
					) : null}
				</div>
				<DialogFooter className="flex-col items-stretch gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center">
					<p className={`min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs ${feedbackToneClass}`} role="status" aria-live="polite" data-testid="published-revision-feedback">
						{revisionFeedback.message}
					</p>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Close</Button>
					<Button type="button" onClick={onSubmit} disabled={submitting || revisionChanges.length === 0 || Boolean(revisionSuccess)} className="gap-2">
						{submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
						Create timetable revision
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
