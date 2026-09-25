import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

import {
	buildRevisionCreatePayload,
	createPublishedRevision,
	fetchLatestRevisionToken,
	isSourceRevisionStaleError,
	previewPublishedRevision,
} from '@/lib/published-revision-client';
import {
	describeRevisionClashes,
	extractRevisionClashes,
	revisionFailureHint,
	type PublishedRevisionClash,
	type PublishedRevisionPreview,
} from '@/lib/published-revision-clashes';
import { buildPublishedEntryChange, type PublishedEntryChangeRequest, type PublishedEntryChangeSlot } from '@/lib/published-entry-change';
import { formatTime } from '@/lib/utils';
import { Button } from '@/ui/button';
import { DialogFooter } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { SearchableSelect } from '@/ui/searchable-select';
import { Textarea } from '@/ui/textarea';
import { PublishedRevisionClashList } from '../PublishedRevisionClashList';
import { revisionDateError } from '../TacticalSandboxDock.helpers';

type PublishedEntryChangePanelProps = {
	request: PublishedEntryChangeRequest;
	scope: { schoolId: number; schoolYearId: number; runId: number };
	roomOptions: Array<{ value: string; label: string }>;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	roomLabel: (id: number | null) => string;
	onClose: () => void;
	onScheduled: () => void;
};

const DAY_NAMES: Record<string, string> = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };

function slotText(slot: PublishedEntryChangeSlot): string {
	return `${DAY_NAMES[slot.day] ?? slot.day} ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`;
}

/**
 * LANE-C C03 (B3) — move one class, or give it a new room, on a published
 * schedule. The 2026-09-25 audit found this a dead end: the only move and room
 * tools call the direct-edit route, which a published run refuses. Here the
 * change is a dated revision: ATLAS checks it first, names any clash, and the
 * change starts on a date the user picks.
 */
export function PublishedEntryChangePanel({
	request,
	scope,
	roomOptions,
	subjectLabel,
	sectionLabel,
	facultyLabel,
	roomLabel,
	onClose,
	onScheduled,
}: PublishedEntryChangePanelProps) {
	const { entry, target } = request;
	const [roomValue, setRoomValue] = useState(entry.roomId != null ? String(entry.roomId) : '');
	const [preview, setPreview] = useState<PublishedRevisionPreview | null>(null);
	const [checking, setChecking] = useState(false);
	const [checkError, setCheckError] = useState<string | null>(null);
	const [effectiveDate, setEffectiveDate] = useState('');
	const [reason, setReason] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitClashes, setSubmitClashes] = useState<PublishedRevisionClash[]>([]);
	const [scheduledFrom, setScheduledFrom] = useState<string | null>(null);

	const labels = useMemo(() => ({ facultyLabel, sectionLabel, subjectLabel }), [facultyLabel, sectionLabel, subjectLabel]);
	const nextRoomId = roomValue ? Number(roomValue) : null;
	const change = useMemo(
		() => buildPublishedEntryChange(entry, { target, roomId: nextRoomId }),
		[entry, target, nextRoomId],
	);
	const changeKey = change ? JSON.stringify(change) : '';

	useEffect(() => {
		setPreview(null);
		setCheckError(null);
		if (!change) {
			setChecking(false);
			return;
		}
		let cancelled = false;
		setChecking(true);
		void (async () => {
			try {
				const sourceRevisionId = await fetchLatestRevisionToken(scope.schoolId, scope.schoolYearId, scope.runId);
				const result = await previewPublishedRevision(scope, { sourceRevisionId, changes: [change] });
				if (!cancelled) setPreview(result);
			} catch (error) {
				if (!cancelled) {
					setCheckError(isSourceRevisionStaleError(error)
						? 'The published schedule changed. Refresh the timetable, then try again.'
						: `ATLAS could not check this change. ${revisionFailureHint(error)}`);
				}
			} finally {
				if (!cancelled) setChecking(false);
			}
		})();
		return () => { cancelled = true; };
		// The change is keyed by its serialized value; `scope` is rebuilt by the parent.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [changeKey, scope.schoolId, scope.schoolYearId, scope.runId]);

	const previewClashes = describeRevisionClashes(preview?.clashes ?? [], labels);
	const clean = change != null && preview != null && preview.blockingHardViolationCount === 0 && preview.clashes.length === 0;
	const dateError = effectiveDate ? revisionDateError(effectiveDate) : null;
	const ready = clean && !!effectiveDate && !dateError && reason.trim().length > 0;
	const nowSlot: PublishedEntryChangeSlot = { day: entry.day, startTime: entry.startTime, endTime: entry.endTime };
	const afterSlot = target ?? nowSlot;

	const submit = async () => {
		if (!ready || !change) return;
		setSubmitting(true);
		setSubmitError(null);
		setSubmitClashes([]);
		try {
			const sourceRevisionId = await fetchLatestRevisionToken(scope.schoolId, scope.schoolYearId, scope.runId);
			await createPublishedRevision(scope, buildRevisionCreatePayload({
				effectiveDate,
				reason: reason.trim(),
				sourceRevisionId,
				changes: [change],
			}));
			setScheduledFrom(effectiveDate);
			onScheduled();
		} catch (error) {
			const clashes = extractRevisionClashes(error);
			setSubmitClashes(clashes);
			const headline = clashes.length > 0 ? 'This change would double-book a teacher, room or class, so nothing was saved.' : 'The change was not scheduled.';
			setSubmitError(`${headline} ${revisionFailureHint(error)}`);
		} finally {
			setSubmitting(false);
		}
	};

	if (scheduledFrom) {
		return (
			<div className="space-y-3 px-4 py-3" data-testid="published-entry-change-scheduled">
				<p className="flex items-start gap-1.5 text-sm font-semibold text-emerald-700">
					<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					Change scheduled from {scheduledFrom}.
				</p>
				<p className="text-sm text-muted-foreground">Until then everyone keeps seeing the current schedule.</p>
				<DialogFooter>
					<Button type="button" onClick={onClose}>Done</Button>
				</DialogFooter>
			</div>
		);
	}

	return (
		<div className="space-y-3 px-4 py-3" data-testid="published-entry-change-panel">
			<p className="text-sm text-muted-foreground">
				This schedule is published, so the change starts on a date you choose. Before that date everyone keeps seeing the current schedule.
			</p>

			<div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]" data-testid="published-entry-change-summary">
				<div className="rounded-lg border border-border bg-muted/30 p-3">
					<p className="text-sm font-semibold">{subjectLabel(entry.subjectId)} · {sectionLabel(entry.sectionId)}</p>
					<p className="text-xs text-muted-foreground">{entry.facultyId != null ? facultyLabel(entry.facultyId) : 'No teacher'}</p>
					<p className="mt-1 text-xs">Now: {slotText(nowSlot)} · {roomLabel(entry.roomId ?? null)}</p>
				</div>
				<ArrowRight className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
				<div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
					<p className="text-sm font-semibold">After the start date</p>
					<p className="mt-1 text-xs font-semibold">{slotText(afterSlot)} · {roomLabel(nextRoomId)}</p>
				</div>
			</div>

			<div className="space-y-1.5">
				<label htmlFor="published-entry-change-room" className="text-sm font-medium text-foreground">Room</label>
				<SearchableSelect
					triggerId="published-entry-change-room"
					ariaLabel="Room for this class"
					items={roomOptions}
					value={roomValue}
					onValueChange={setRoomValue}
					placeholder="Choose a room"
					triggerClassName="h-10 w-full text-sm"
					className="w-[min(88vw,24rem)]"
				/>
			</div>

			{!change ? (
				<p className="text-sm text-muted-foreground" data-testid="published-entry-change-nothing">
					{request.mode === 'room' ? 'Choose a different room to continue.' : 'Choose a new time or room to continue.'}
				</p>
			) : checking ? (
				<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" aria-hidden="true" />
					Checking the teacher, room and class for clashes…
				</p>
			) : checkError ? (
				<p className="text-sm text-destructive">{checkError}</p>
			) : clean ? (
				<p className="flex items-center gap-1.5 text-sm text-emerald-700" data-testid="published-entry-change-clean">
					<CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
					No clashes. This change can be scheduled.
				</p>
			) : preview ? (
				<PublishedRevisionClashList clashes={previewClashes} heading="This change would cause clashes. Choose a different time or room." />
			) : null}

			{clean ? (
				<div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
					<div className="space-y-1.5">
						<label htmlFor="published-entry-change-date" className="text-sm font-medium text-foreground">Start date</label>
						<Input id="published-entry-change-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} aria-describedby="published-entry-change-date-help" />
						<p id="published-entry-change-date-help" className={dateError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
							{dateError ?? 'Tomorrow or a later school day.'}
						</p>
					</div>
					<div className="space-y-1.5">
						<label htmlFor="published-entry-change-reason" className="text-sm font-medium text-foreground">Reason</label>
						<Textarea id="published-entry-change-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Example: the science lab is only free in the afternoon" />
					</div>
				</div>
			) : null}

			{submitError ? <p className="text-sm text-destructive" role="alert">{submitError}</p> : null}
			<PublishedRevisionClashList clashes={describeRevisionClashes(submitClashes, labels)} heading="These classes would clash:" />

			<DialogFooter className="gap-2">
				<Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
				<Button type="button" onClick={() => void submit()} disabled={!ready || submitting} data-testid="published-entry-change-schedule">
					{submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
					Schedule change
				</Button>
			</DialogFooter>
		</div>
	);
}
