import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { getActionableApiError } from '@/lib/actionable-api-error';
import { getAtlasTokenEpochVersion, getPreferredAccessToken } from '@/lib/auth';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { describeSchoolYearSource, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
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

	const loadSeqRef = useRef(0);

	/* ── Actor-school → active school year + verified ordered term ── */
	useEffect(() => {
		if (actorSchoolId == null) {
			setSchoolYearId(null);
			setActiveTermIndex(null);
			return;
		}
		let cancelled = false;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();
		const isCurrent = () => !cancelled && isCurrentEpoch(token, epoch);
		setYearError(null);
		resolveActiveSchoolYearContext({ schoolId: actorSchoolId, allowStaleOnError: true, allowEnrollProFallback: false })
			.then((context) => {
				if (!isCurrent()) return;
				setSchoolYearId(context.activeSchoolYearId);
				setSchoolYearNotice(describeSchoolYearSource(context));
				setActiveTermIndex(resolveVerifiedActiveTermIndex(context.activeTerm));
			})
			.catch(() => {
				if (!isCurrent()) return;
				setYearError('Failed to resolve the active school year for the actor school.');
				setSchoolYearId(null);
				setActiveTermIndex(null);
			});
		return () => {
			cancelled = true;
		};
	}, [actorSchoolId]);

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

	const bumpRefresh = () => setRefreshNonce((nonce) => nonce + 1);

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
						<Card className='rounded-2xl border-amber-200 bg-amber-50'>
							<CardContent className='flex items-start gap-3 py-6'>
								<AlertTriangle className='mt-0.5 size-5 text-amber-700' aria-hidden='true' />
								<div>
									<p className='text-sm font-semibold text-amber-900'>Active ordered term unresolved</p>
									<p className='mt-1 text-xs leading-relaxed text-amber-800/90'>
										Availability is term-scoped. Resolve the active ordered term before recording or reviewing a concern;
										writes stay disabled rather than defaulting to Term 1.
									</p>
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

					{selectedFacultyId != null && (
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
					)}
				</div>
			</div>
		</div>
	);
}
