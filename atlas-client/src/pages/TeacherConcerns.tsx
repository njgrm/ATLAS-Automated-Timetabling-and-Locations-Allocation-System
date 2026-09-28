import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ClipboardList, Info, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { getActionableApiError } from '@/lib/actionable-api-error';
import { getAtlasTokenEpochVersion, getPreferredAccessToken } from '@/lib/auth';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { describeSavedTermSource, describeSchoolYearSource, describeUnresolvedTermReason, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { resolveVerifiedActiveTermIndex } from '@/lib/timetable-data/timetablePrefetch';
import type {
	FacultyAvailabilityRecord,
	FacultyConcernReviewDecision,
	FacultyMirror,
	GenerationInputComparison,
} from '@/types';
import {
	availabilityRecordToPickerSlots,
	fetchConcernFaculty,
	fetchFacultyAvailability,
	fetchLatestRunInputState,
	pickerSlotsToAvailability,
	reviewFacultyAvailability,
	saveFacultyAvailabilityDraft,
	submitFacultyAvailability,
	type AvailabilityPickerSlot,
} from '@/components/faculty-shared/teacher-concern-client';
import { composeConcernNotes, parseConcernNotes } from '@/components/faculty-shared/teacher-concern-helpers';
import RunAvailabilityDriftCard from '@/components/faculty-shared/RunAvailabilityDriftCard';
import TeacherConcernWorkspace from '@/components/faculty-shared/TeacherConcernWorkspace';

function facultyLabel(faculty: FacultyMirror): string {
	const name = [faculty.lastName, faculty.firstName].filter(Boolean).join(', ');
	return name || `Teacher #${faculty.id}`;
}

function isCurrentEpoch(token: string | null, epoch: number): boolean {
	return getPreferredAccessToken() === token && getAtlasTokenEpochVersion() === epoch;
}

/**
 * S2 — the scheduler concern workspace.
 *
 * One surface where a scheduler records a teacher's availability grid, notes
 * and room requests, drives the reviewed S1 authority (`faculty-availability`),
 * and sees the run's input freshness routed to regenerate/revision. The actor
 * school and year come only from the session; an unresolved scope or ordered
 * term fails closed and every write stays disabled — there is no `?? 1`.
 */
export default function TeacherConcerns() {
	const { actorSchoolId, resolved: scopeResolved } = useActorSchoolScope();

	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);
	const [activeTermIndex, setActiveTermIndex] = useState<number | null>(null);
	/** A5-C2A — the server resolver's degradation truth, rendered verbatim. */
	const [savedTermNotice, setSavedTermNotice] = useState<string | null>(null);
	const [unresolvedTermReason, setUnresolvedTermReason] = useState<string | null>(null);
	const [yearError, setYearError] = useState<string | null>(null);

	const [faculty, setFaculty] = useState<FacultyMirror[]>([]);
	const [facultyError, setFacultyError] = useState<string | null>(null);
	const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null);

	const [availability, setAvailability] = useState<FacultyAvailabilityRecord | null>(null);
	const [pickerSlots, setPickerSlots] = useState<AvailabilityPickerSlot[]>([]);
	const [notes, setNotes] = useState('');
	const [roomRequests, setRoomRequests] = useState('');
	const [reviewerNotes, setReviewerNotes] = useState('');
	const [inputState, setInputState] = useState<GenerationInputComparison | null>(null);

	const [loadingConcern, setLoadingConcern] = useState(false);
	const [concernError, setConcernError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [refreshNonce, setRefreshNonce] = useState(0);
	/**
	 * A5-C2A — a separate nonce for the canonical term RESOLUTION, not just the
	 * concern read. Without it the "Re-check the active term" button would
	 * re-fetch the teacher's record while leaving the unresolved term untouched,
	 * which is the exact "handler wired, outcome wrong" defect.
	 */
	const [termRefreshNonce, setTermRefreshNonce] = useState(0);

	const loadSeqRef = useRef(0);

	/* ── Actor-school → active school year + verified ordered term ──
	 *
	 * A5-C2A: this page reads the SAME canonical resolver the app shell and the
	 * concern WRITE path use. There is no page-local notion of the active term.
	 * The previous copy resolved the term from a live-only EnrollPro read, so a
	 * truthful reachable `ACTIVE_TERM_UNRESOLVED` (host clock outside every term
	 * of the active year) produced "Active ordered term unresolved" and disabled
	 * the whole teacher workflow while the shell showed the saved term. The
	 * server resolver now degrades that case to LABELLED saved data carrying its
	 * real capture time, and this page renders that label.
	 */
	useEffect(() => {
		if (actorSchoolId == null) {
			setSchoolYearId(null);
			setActiveTermIndex(null);
			setSavedTermNotice(null);
			setUnresolvedTermReason(null);
			return;
		}
		let cancelled = false;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();
		const isCurrent = () => !cancelled && isCurrentEpoch(token, epoch);
		setYearError(null);
		// `forceRefresh` is load-bearing, not cosmetic. The concern WRITE path
		// re-resolves the active term live on the server and rejects a mismatched
		// termIndex with `TERM_SCOPE_MISMATCH`, so a 10-minute-old client cache
		// could make this page show a term the server no longer holds. Asking for
		// a current answer is what makes the read and the write agree.
		resolveActiveSchoolYearContext({ schoolId: actorSchoolId, allowStaleOnError: true, allowEnrollProFallback: false, forceRefresh: true })
			.then((context) => {
				if (!isCurrent()) return;
				setSchoolYearId(context.activeSchoolYearId);
				setSchoolYearNotice(describeSchoolYearSource(context));
				const resolvedTerm = resolveVerifiedActiveTermIndex(context.activeTerm);
				setActiveTermIndex(resolvedTerm);
				setSavedTermNotice(describeSavedTermSource(context.activeTerm));
				setUnresolvedTermReason(resolvedTerm == null ? describeUnresolvedTermReason(context.activeTerm) : null);
			})
			.catch(() => {
				if (!isCurrent()) return;
				setYearError('Failed to resolve the active school year for the actor school.');
				setSchoolYearId(null);
				setActiveTermIndex(null);
				setSavedTermNotice(null);
				setUnresolvedTermReason(null);
			});
		return () => {
			cancelled = true;
		};
	}, [actorSchoolId, termRefreshNonce]);

	/* ── Actor-school teacher roster ── */
	useEffect(() => {
		if (actorSchoolId == null) {
			setFaculty([]);
			setSelectedFacultyId(null);
			return;
		}
		let cancelled = false;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();
		const isCurrent = () => !cancelled && isCurrentEpoch(token, epoch);
		setFacultyError(null);
		fetchConcernFaculty(actorSchoolId)
			.then((list) => {
				if (!isCurrent()) return;
				setFaculty(list);
				setSelectedFacultyId((current) => (current != null && list.some((entry) => entry.id === current) ? current : null));
			})
			.catch(() => {
				if (!isCurrent()) return;
				setFacultyError('Failed to load the teacher roster.');
			});
		return () => {
			cancelled = true;
		};
	}, [actorSchoolId]);

	/* ── Selected teacher: current authority + latest-run freshness ── */
	const loadConcern = useCallback(async () => {
		if (actorSchoolId == null || schoolYearId == null || selectedFacultyId == null) return;
		const seq = ++loadSeqRef.current;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();
		const isCurrent = () => seq === loadSeqRef.current && isCurrentEpoch(token, epoch);
		setLoadingConcern(true);
		setConcernError(null);
		try {
			const [record, runInputState] = await Promise.all([
				fetchFacultyAvailability({ schoolId: actorSchoolId, schoolYearId, facultyId: selectedFacultyId }),
				fetchLatestRunInputState(actorSchoolId, schoolYearId).catch(() => null),
			]);
			if (!isCurrent()) return;
			setAvailability(record);
			setInputState(runInputState);
		} catch (error) {
			if (!isCurrent()) return;
			setAvailability(null);
			setInputState(null);
			setConcernError(getActionableApiError(error, 'Failed to load this teacher’s availability authority.'));
		} finally {
			if (isCurrent()) setLoadingConcern(false);
		}
	}, [actorSchoolId, schoolYearId, selectedFacultyId]);

	useEffect(() => {
		void loadConcern();
		return () => {
			loadSeqRef.current += 1;
		};
	}, [loadConcern, refreshNonce]);

	/* ── Never show one teacher's record under another teacher's name ── */
	useEffect(() => {
		setAvailability(null);
		setInputState(null);
		setConcernError(null);
	}, [selectedFacultyId]);

	/* ── Availability record → editable form state ── */
	useEffect(() => {
		setPickerSlots(availabilityRecordToPickerSlots(availability));
		const parsed = parseConcernNotes(availability?.notes ?? null);
		setNotes(parsed.notes);
		setRoomRequests(parsed.roomRequests);
		setReviewerNotes('');
	}, [availability]);

	const selectedFaculty = useMemo(
		() => faculty.find((entry) => entry.id === selectedFacultyId) ?? null,
		[faculty, selectedFacultyId],
	);

	const termUnresolved = activeTermIndex == null;
	const writesDisabled = termUnresolved || actorSchoolId == null || schoolYearId == null || selectedFacultyId == null;
	const facultyOptions = useMemo(
		() => faculty.map((entry) => ({ value: String(entry.id), label: facultyLabel(entry) })),
		[faculty],
	);

	/**
	 * A5-C2A — one action that re-runs BOTH the term resolution and the concern
	 * read, so "re-check" actually changes the outcome on the page rather than
	 * just refetching the record behind an unchanged verdict.
	 */
	const bumpRefresh = () => {
		setRefreshNonce((nonce) => nonce + 1);
		setTermRefreshNonce((nonce) => nonce + 1);
	};

	const runWrite = async (action: () => Promise<FacultyAvailabilityRecord>, successMessage: string) => {
		setSaving(true);
		setConcernError(null);
		try {
			const record = await action();
			setAvailability(record);
			bumpRefresh();
			toast.success(successMessage);
		} catch (error) {
			setConcernError(getActionableApiError(error, 'The availability authority was not saved.'));
		} finally {
			setSaving(false);
		}
	};

	const handleSaveDraft = () => {
		if (actorSchoolId == null || schoolYearId == null || selectedFacultyId == null || activeTermIndex == null) return;
		void runWrite(
			() => saveFacultyAvailabilityDraft({
				schoolId: actorSchoolId,
				schoolYearId,
				facultyId: selectedFacultyId,
				termIndex: activeTermIndex,
				slots: pickerSlotsToAvailability(pickerSlots),
				notes: composeConcernNotes(notes, roomRequests),
				version: availability?.version ?? null,
			}),
			'Availability draft saved for the active term.',
		);
	};

	const handleSubmitForReview = () => {
		if (actorSchoolId == null || schoolYearId == null || selectedFacultyId == null || availability == null) return;
		void runWrite(
			() => submitFacultyAvailability({
				schoolId: actorSchoolId,
				schoolYearId,
				facultyId: selectedFacultyId,
				version: availability.version,
				slots: pickerSlotsToAvailability(pickerSlots),
				notes: composeConcernNotes(notes, roomRequests),
			}),
			'Availability submitted for review.',
		);
	};

	const handleReview = (decision: FacultyConcernReviewDecision) => {
		if (actorSchoolId == null || schoolYearId == null || selectedFacultyId == null || availability == null) return;
		void runWrite(
			() => reviewFacultyAvailability({
				schoolId: actorSchoolId,
				schoolYearId,
				facultyId: selectedFacultyId,
				version: availability.version,
				decision,
				reviewerNotes: reviewerNotes.trim() || null,
			}),
			decision === 'REVIEWED' ? 'Availability approved and bound to generation.' : 'Availability returned for correction.',
		);
	};

	return (
		<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-muted/30'>
			<div className='flex-1 min-h-0 overflow-auto px-4 py-5 sm:px-6'>
				<div className='mx-auto w-full max-w-6xl space-y-4'>
					<PageHeader
						title='Teacher Concerns'
						eyebrow='Teachers and Rooms'
						subtitle='Record a teacher’s availability, notes and room requests; review the authority that binds generation.'
						primaryAction={(
							<Button type='button' variant='outline' size='sm' onClick={bumpRefresh} disabled={selectedFacultyId == null}>
								<RefreshCcw className='mr-1.5 size-4' aria-hidden='true' />
								Check for updates
							</Button>
						)}
					/>

					{schoolYearNotice && <p className='text-xs text-muted-foreground'>{schoolYearNotice}</p>}

					{/* A5-C2A — the saved-data label. Rendered whenever the canonical
					    resolver answered from the saved verified ordered-term snapshot,
					    with the REAL capture time, and the workflow stays usable. This
					    is the one place this page describes its term source, so no second
					    page-local notion of the active term can appear. */}
					{savedTermNotice && (
						<p className='flex items-center gap-1.5 text-xs text-muted-foreground' data-testid='concern-saved-term-notice'>
							<Info className='size-3.5 shrink-0' aria-hidden='true' />
							{savedTermNotice}
						</p>
					)}

					{scopeResolved && actorSchoolId == null && (
						<Card className='rounded-2xl border-destructive/20'>
							<CardContent className='flex items-start gap-3 py-6'>
								<AlertTriangle className='mt-0.5 size-5 text-destructive' aria-hidden='true' />
								<div>
									<p className='text-sm font-semibold text-foreground'>No actor school scope</p>
									<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
										The signed-in session has no resolved school, so no teacher concern can be loaded or written.
									</p>
								</div>
							</CardContent>
						</Card>
					)}

					{yearError && (
						<Card className='rounded-2xl border-destructive/20'>
							<CardContent className='flex items-start gap-3 py-6'>
								<AlertTriangle className='mt-0.5 size-5 text-destructive' aria-hidden='true' />
								<div>
									<p className='text-sm font-semibold text-foreground'>School year unavailable</p>
									<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>{yearError}</p>
								</div>
							</CardContent>
						</Card>
					)}

					{termUnresolved && actorSchoolId != null && schoolYearId != null && (
						<Card className='rounded-2xl border-warning-border bg-warning-muted' data-testid='concern-term-unresolved'>
							<CardContent className='flex items-start gap-3 py-6'>
								<AlertTriangle className='mt-0.5 size-5 text-warning' aria-hidden='true' />
								<div className='min-w-0 space-y-2'>
									<p className='text-sm font-semibold text-warning-foreground'>Active ordered term unresolved</p>
									<p className='text-xs leading-relaxed text-warning-foreground/90'>
										{unresolvedTermReason ?? 'Availability is term-scoped, so ATLAS will not record a concern until an ordered term is verified.'}
										Writes stay disabled rather than defaulting to Term 1.
									</p>
									{/* A5-C2A — one recoverable action, never a dead end. "Check for
					    updates" re-runs the canonical resolver; if EnrollPro is back
					    and its term structure still matches the saved one, the term
					    resolves and this whole notice disappears. */}
									<Button type='button' variant='outline' size='sm' onClick={bumpRefresh}>
										<RefreshCcw className='mr-1.5 size-4' aria-hidden='true' />
										Re-check the active term
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					<Card className='rounded-2xl border-border/60 shadow-sm'>
						<CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between'>
							<div className='w-full max-w-sm space-y-1.5'>
								<p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Teacher</p>
								<SearchableSelect
									items={facultyOptions}
									value={selectedFacultyId == null ? '' : String(selectedFacultyId)}
									onValueChange={(value) => setSelectedFacultyId(value ? Number(value) : null)}
									placeholder={facultyError ? 'Teacher roster unavailable' : faculty.length === 0 ? 'No teachers loaded' : 'Select a teacher…'}
									disabled={faculty.length === 0}
									disabledReason={facultyError ?? 'Load the teacher roster first.'}
									triggerClassName='w-full'
								/>
							</div>
							{facultyError && <p className='text-xs text-destructive'>{facultyError}</p>}
						</CardContent>
					</Card>

					{concernError && (
						<Card className='rounded-2xl border-destructive/20'>
							<CardContent className='flex items-start gap-3 py-4'>
								<AlertTriangle className='mt-0.5 size-4 text-destructive' aria-hidden='true' />
								<p className='text-xs leading-relaxed text-muted-foreground'>{concernError}</p>
							</CardContent>
						</Card>
					)}

					{selectedFacultyId != null ? (
						<>
							{loadingConcern && availability == null ? (
								<div className='space-y-3'>
									<Skeleton className='h-24 w-full rounded-2xl' />
									<Skeleton className='h-64 w-full rounded-2xl' />
								</div>
							) : (
								<TeacherConcernWorkspace
									facultyName={selectedFaculty ? facultyLabel(selectedFaculty) : null}
									availability={availability}
									pickerSlots={pickerSlots}
									onPickerChange={setPickerSlots}
									notes={notes}
									onNotesChange={setNotes}
									roomRequests={roomRequests}
									onRoomRequestsChange={setRoomRequests}
									reviewerNotes={reviewerNotes}
									onReviewerNotesChange={setReviewerNotes}
									writesDisabled={writesDisabled}
									saving={saving}
									onSaveDraft={handleSaveDraft}
									onSubmitForReview={handleSubmitForReview}
									onReview={handleReview}
								/>
							)}
							<RunAvailabilityDriftCard inputState={inputState} facultyName={selectedFaculty ? facultyLabel(selectedFaculty) : null} />
						</>
					) : (
						/*
						 * A3-C6/C1 — an honest main panel for the no-teacher-selected case.
						 *
						 * There is deliberately NO concerns list here. The availability
						 * authority is per-faculty (`faculty-availability.router.ts`
						 * exposes get/put/post/patch only) and no endpoint lists concerns,
						 * so a list or a count would be invented work the page cannot
						 * actually do. This states what the page records and names the one
						 * next step the operator can perform from right here.
						 */
						<Card className='rounded-2xl border-border/60 shadow-sm' data-testid='concern-no-teacher-empty-state'>
							<CardContent className='flex items-start gap-3 p-5'>
								<ClipboardList className='mt-0.5 size-5 shrink-0 text-primary' aria-hidden='true' />
								<div className='min-w-0 space-y-1.5'>
									<p className='text-sm font-semibold text-foreground'>Choose a teacher to begin</p>
									<p className='text-xs leading-relaxed text-muted-foreground'>
										This page records one teacher&apos;s weekly availability, notes and room requests for the active
										term, and shows how those records bind to the run being generated.
									</p>
									<p className='text-xs leading-relaxed text-muted-foreground'>
										Nothing is recorded or listed until you pick a teacher. Use the teacher picker above, then mark
										their unavailable and preferred windows, add any notes or room requests, and save the draft
										for review.
									</p>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
