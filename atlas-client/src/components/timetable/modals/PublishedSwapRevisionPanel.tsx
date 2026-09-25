import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Loader2 } from 'lucide-react';

import {
	createPublishedSwapRevision,
	fetchLatestRevisionToken,
	isSourceRevisionStaleError,
	previewPublishedSwap,
} from '@/lib/published-revision-client';
import {
	describeRevisionClashes,
	extractRevisionClashes,
	revisionFailureHint,
	type PublishedRevisionClash,
	type PublishedRevisionPreview,
} from '@/lib/published-revision-clashes';
import { formatTime } from '@/lib/utils';
import type { ScheduledEntry } from '@/types';
import { Button } from '@/ui/button';
import { DialogFooter } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { PublishedRevisionClashList } from '../PublishedRevisionClashList';
import { revisionDateError } from '../TacticalSandboxDock.helpers';

type PublishedSwapRevisionPanelProps = {
	entryA: ScheduledEntry;
	entryB: ScheduledEntry;
	scope: { schoolId: number; schoolYearId: number; runId: number };
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	roomLabel?: (id: number) => string;
	onClose: () => void;
	onScheduled: () => void;
};

const DAY_NAMES: Record<string, string> = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };

function slotText(entry: ScheduledEntry): string {
	return `${DAY_NAMES[entry.day] ?? entry.day} ${formatTime(entry.startTime)}–${formatTime(entry.endTime)}`;
}

/**
 * LANE-C POST-PUBLISH-C01 — a swap on a published schedule. The 2026-09-25 audit
 * found this path calling the direct-edit swap, which a published run refuses,
 * and printing the server's API path to the user. A published swap is a dated
 * revision: ATLAS checks it first, names any clash, and schedules it from a
 * start date without rewriting the published schedule.
 */
export function PublishedSwapRevisionPanel({
	entryA,
	entryB,
	scope,
	subjectLabel,
	sectionLabel,
	facultyLabel,
	roomLabel,
	onClose,
	onScheduled,
}: PublishedSwapRevisionPanelProps) {
	const [preview, setPreview] = useState<PublishedRevisionPreview | null>(null);
	const [checking, setChecking] = useState(true);
	const [checkError, setCheckError] = useState<string | null>(null);
	const [effectiveDate, setEffectiveDate] = useState('');
	const [reason, setReason] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitClashes, setSubmitClashes] = useState<PublishedRevisionClash[]>([]);
	const [scheduledFrom, setScheduledFrom] = useState<string | null>(null);

	const labels = useMemo(() => ({ facultyLabel, sectionLabel, subjectLabel, roomLabel }), [facultyLabel, sectionLabel, subjectLabel, roomLabel]);

	useEffect(() => {
		let cancelled = false;
		setChecking(true);
		setCheckError(null);
		setPreview(null);
		void (async () => {
			try {
				const sourceRevisionId = await fetchLatestRevisionToken(scope.schoolId, scope.schoolYearId, scope.runId);
				const result = await previewPublishedSwap(scope, { sourceRevisionId, entryIdA: entryA.entryId, entryIdB: entryB.entryId });
				if (!cancelled) setPreview(result);
			} catch (error) {
				if (!cancelled) {
					setCheckError(isSourceRevisionStaleError(error)
						? 'The published schedule changed. Refresh the timetable, then try again.'
						: 'ATLAS could not check this swap. Try again in a moment.');
				}
			} finally {
				if (!cancelled) setChecking(false);
			}
		})();
		return () => { cancelled = true; };
		// Primitive ids only: the parent rebuilds `scope` on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entryA.entryId, entryB.entryId, scope.schoolId, scope.schoolYearId, scope.runId]);

	const previewClashes = describeRevisionClashes(preview?.clashes ?? [], labels);
	const clean = preview != null && preview.blockingHardViolationCount === 0 && preview.clashes.length === 0;
	const dateError = effectiveDate ? revisionDateError(effectiveDate) : null;
	const ready = clean && !!effectiveDate && !dateError && reason.trim().length > 0;

	const submit = async () => {
		if (!ready) return;
		setSubmitting(true);
		setSubmitError(null);
		setSubmitClashes([]);
		try {
			const sourceRevisionId = await fetchLatestRevisionToken(scope.schoolId, scope.schoolYearId, scope.runId);
			await createPublishedSwapRevision(scope, {
				sourceRevisionId,
				entryIdA: entryA.entryId,
				entryIdB: entryB.entryId,
				effectiveDate,
				reason: reason.trim(),
			});
			setScheduledFrom(effectiveDate);
			onScheduled();
		} catch (error) {
			const clashes = extractRevisionClashes(error);
			setSubmitClashes(clashes);
			const headline = clashes.length > 0 ? 'This swap would double-book a teacher, room or class, so nothing was saved.' : 'The swap was not scheduled.';
			setSubmitError(`${headline} ${revisionFailureHint(error)}`);
		} finally {
			setSubmitting(false);
		}
	};

	const card = (entry: ScheduledEntry, newSlot: ScheduledEntry, tone: string) => (
		<div className={`rounded-lg border p-3 ${tone}`}>
			<p className="text-sm font-semibold">{subjectLabel(entry.subjectId)} · {sectionLabel(entry.sectionId)}</p>
			<p className="text-xs text-muted-foreground">{entry.facultyId != null ? facultyLabel(entry.facultyId) : 'No teacher'}</p>
			<p className="mt-1 text-xs">Now: {slotText(entry)}</p>
			<p className="text-xs font-semibold">After the start date: {slotText(newSlot)}</p>
		</div>
	);

	if (scheduledFrom) {
		return (
			<div className="space-y-3 px-4 py-3" data-testid="published-swap-scheduled">
				<p className="flex items-start gap-1.5 text-sm font-semibold text-emerald-700">
					<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					Swap scheduled from {scheduledFrom}.
				</p>
				<p className="text-sm text-muted-foreground">Until then everyone keeps seeing the current schedule. The change is saved in the schedule history.</p>
				<DialogFooter>
					<Button type="button" onClick={onClose}>Done</Button>
				</DialogFooter>
			</div>
		);
	}

	return (
		<div className="space-y-3 px-4 py-3" data-testid="published-swap-panel">
			<p className="text-sm text-muted-foreground">
				This schedule is published, so the swap starts on a date you choose. Before that date everyone keeps seeing the current schedule.
			</p>
			<div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
				{card(entryA, entryB, 'border-blue-200 bg-blue-50/60')}
				<ArrowLeftRight className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
				{card(entryB, entryA, 'border-amber-200 bg-amber-50/60')}
			</div>

			{checking ? (
				<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" aria-hidden="true" />
					Checking both teachers, rooms and classes for clashes…
				</p>
			) : checkError ? (
				<p className="text-sm text-destructive">{checkError}</p>
			) : clean ? (
				<p className="flex items-center gap-1.5 text-sm text-emerald-700" data-testid="published-swap-clean">
					<CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
					No clashes. Both classes can swap times.
				</p>
			) : (
				<PublishedRevisionClashList clashes={previewClashes} heading="This swap would cause clashes. Choose a different pair of classes." />
			)}

			{clean ? (
				<div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
					<div className="space-y-1.5">
						<label htmlFor="published-swap-date" className="text-sm font-medium text-foreground">Start date</label>
						<Input id="published-swap-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} aria-describedby="published-swap-date-help" />
						<p id="published-swap-date-help" className={dateError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
							{dateError ?? 'Tomorrow or a later school day.'}
						</p>
					</div>
					<div className="space-y-1.5">
						<label htmlFor="published-swap-reason" className="text-sm font-medium text-foreground">Reason</label>
						<Textarea id="published-swap-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Example: science lab is only free in the afternoon" />
					</div>
				</div>
			) : null}

			{submitError ? <p className="text-sm text-destructive" role="alert">{submitError}</p> : null}
			<PublishedRevisionClashList clashes={describeRevisionClashes(submitClashes, labels)} heading="These classes would clash:" />

			<DialogFooter className="gap-2">
				<Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
				<Button type="button" onClick={() => void submit()} disabled={!ready || submitting} data-testid="published-swap-schedule">
					{submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
					Schedule swap
				</Button>
			</DialogFooter>
		</div>
	);
}
