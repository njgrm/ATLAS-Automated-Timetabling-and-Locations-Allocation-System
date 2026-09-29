import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ClipboardList, Info, MoreHorizontal, RefreshCcw } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { SearchableSelect } from '@/ui/searchable-select';
import { FilterBar } from '@/ui/filter-bar';
import { pickerTriggerClass } from '@/ui/picker-trigger';
import { Skeleton } from '@/ui/skeleton';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { getActionableApiError } from '@/lib/actionable-api-error';
import { getAtlasTokenEpochVersion, getPreferredAccessToken } from '@/lib/auth';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { resolveActiveTermAuthority } from '@/lib/active-term-authority';
import type {
	FacultyMirror,
	FacultyRoomPreferenceEntry,
	FacultyRoomPreferenceState,
	GenerationInputComparison,
	PreviewResult,
} from '@/types';
import {
	applyConcernRoomRequest,
	availabilityRecordToPickerSlots,
	concernApiErrorMessage,
	fetchConcernFaculty,
	fetchConcernRoomOptions,
	fetchConcernRoomState,
	fetchFacultyAvailability,
	fetchLatestRunInputState,
	pickerSlotsToAvailability,
	previewConcernRoomRequest,
	saveAndBindAvailability,
	saveConcernRoomDraft,
	submitConcernRoom,
	type AvailabilityPickerSlot,
} from '@/components/faculty-shared/teacher-concern-client';
import { composeConcernNotes, concernSaveStateLabel, concernSaveStateTone, bindConcernTermResolution, describeSavedConcern, parseConcernNotes, resolveConcernSaveAvailability, type ConcernYearResolution } from '@/components/faculty-shared/teacher-concern-helpers';
import type { ConcernRoomDraft } from '@/components/faculty-shared/TeacherConcernWorkspace';
import type { RoomOption } from '@/components/sections/SectionRoomPicker';
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
 * A3 c15 — Teacher Preferences is the ONE page a scheduler fills while talking
 * to one teacher, served at `/faculty/preferences`. Room Preferences and Faculty
 * Preferences folded into it, and `/faculty/concerns` is now its retired alias.
 *
 * The two-row header (AGENTS §8) is: row 1 = title, ONE status chip, `More`;
 * row 2 = the teacher picker. The single primary action — Save — lives at the
 * end of the form, not in the header, so it is not duplicated.
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
	/**
	 * A3 p1 — where this page is in the term resolution. It exists so the
	 * sticky Save row can tell "still checking" from "checked and there is
	 * none", which are different sentences and used to be the same silence.
	 */
	const [yearResolution, setYearResolution] = useState<ConcernYearResolution>('PENDING');

	const [faculty, setFaculty] = useState<FacultyMirror[]>([]);
	const [facultyError, setFacultyError] = useState<string | null>(null);
	const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null);

	const [availability, setAvailability] = useState<Awaited<ReturnType<typeof fetchFacultyAvailability>>>(null);
	const [pickerSlots, setPickerSlots] = useState<AvailabilityPickerSlot[]>([]);
	const [notes, setNotes] = useState('');
	const [roomRequests, setRoomRequests] = useState('');
	const [inputState, setInputState] = useState<GenerationInputComparison | null>(null);

	/* ── Rooms ── */
	const [roomState, setRoomState] = useState<FacultyRoomPreferenceState | null>(null);
	const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
	const [roomDrafts, setRoomDrafts] = useState<Record<string, ConcernRoomDraft>>({});
	const [roomPreviews, setRoomPreviews] = useState<Record<number, PreviewResult>>({});
	const [previewingEntryId, setPreviewingEntryId] = useState<string | null>(null);
	const [applyingEntryId, setApplyingEntryId] = useState<string | null>(null);
	const [roomError, setRoomError] = useState<string | null>(null);

	const [loadingConcern, setLoadingConcern] = useState(false);
	const [concernError, setConcernError] = useState<string | null>(null);
	const [saveFailure, setSaveFailure] = useState<string | null>(null);
	const [savedMessage, setSavedMessage] = useState<string | null>(null);
	/**
	 * N2 — the ONE status chip's source of truth, as a union rather than a
	 * sentence. `SAVED_NOT_BINDING` means the server stored the record and then
	 * refused to make it count for the next timetable; that is a real answer
	 * about the teacher's load, and the chip says so without parsing prose.
	 */
	const [saveOutcome, setSaveOutcome] = useState<'SAVED' | 'SAVED_NOT_BINDING' | null>(null);
	const [saving, setSaving] = useState(false);
	const [refreshNonce, setRefreshNonce] = useState(0);
	/**
	 * A5-C2A — a separate nonce for the canonical term RESOLUTION, not just the
	 * concern read. Without it the "Check for updates" action would re-fetch the
	 * teacher's record while leaving the unresolved term untouched, which is the
	 * exact "handler wired, outcome wrong" defect.
	 */
	const [termRefreshNonce, setTermRefreshNonce] = useState(0);

	const loadSeqRef = useRef(0);

	/* ── Actor-school → active school year + verified ordered term ── */
	useEffect(() => {
		if (actorSchoolId == null) {
			setSchoolYearId(null);
			setActiveTermIndex(null);
			setSavedTermNotice(null);
			setUnresolvedTermReason(null);
			setYearResolution('RESOLVED');
			return;
		}
		let cancelled = false;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();
		const isCurrent = () => !cancelled && isCurrentEpoch(token, epoch);
		/*
		 * A3 p1 — THE POLARITY. `resolveActiveTermAuthority`'s second parameter is
		 * the caller's LIVENESS and `true` means "still good, keep it". This page
		 * used to hand its `isCurrent` closure to a bare positional parameter whose
		 * `true` meant the OPPOSITE (discard), so every healthy resolution was
		 * thrown away, the resolver returned `null`, and the `if (bound == null)
		 * return;` below left `schoolYearId` null forever. The grid still rendered,
		 * Save and "Anything else" stayed disabled, the availability read never
		 * fired, and nothing on screen said why — while the staging term data was
		 * healthy the whole time.
		 *
		 * `{ isStillCurrent: isCurrent }` states the sense in the call itself, so
		 * the inversion can no longer be made here.
		 */
		setYearError(null);
		setYearResolution('PENDING');
		// A2-C14 — the shared resolver asks for upstream verification exactly
		// once when the fast read has not already verified the term. The old
		// `forceRefresh`-only call guaranteed the server's unverified default
		// ("Active term verification not requested"), so the gate below could
		// never be satisfied and the whole write path stayed disabled.
		//
		// `requireFreshVerifiedRead` is load-bearing here, not cosmetic — and so
		// was the `forceRefresh` it replaces. The concern WRITE path re-resolves
		// the active term live on the server and rejects a mismatched termIndex
		// with `TERM_SCOPE_MISMATCH`, so a cached-but-verified term can make this
		// page show a term the server no longer holds. The read and the write
		// must agree, so this page still gets a current answer.
		resolveActiveTermAuthority(actorSchoolId, { isStillCurrent: isCurrent }, { requireFreshVerifiedRead: true })
			.then((resolution) => {
				if (!isCurrent()) return;
				/*
				 * `null` now means exactly one thing: this read was discarded as
				 * stale, so a newer effect run (or the unmount that just happened)
				 * owns the state. Leaving it alone is correct, and
				 * `bindConcernTermResolution` is where that rule is decided and
				 * tested rather than assumed.
				 */
				const bound = bindConcernTermResolution(resolution);
				if (bound == null) return;
				setSchoolYearId(bound.schoolYearId);
				setSchoolYearNotice(bound.schoolYearNotice);
				setActiveTermIndex(bound.activeTermIndex);
				setSavedTermNotice(bound.savedTermNotice);
				setUnresolvedTermReason(bound.unresolvedTermReason);
				setYearResolution('RESOLVED');
			})
			.catch(() => {
				if (!isCurrent()) return;
				setYearError('Failed to resolve the active school year for the actor school.');
				setSchoolYearId(null);
				setActiveTermIndex(null);
				setSavedTermNotice(null);
				setUnresolvedTermReason(null);
				setYearResolution('FAILED');
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

	/* ── Room options: the SAME read the Sections room picker uses, so the
	 *   control is identical on both pages rather than a local variant. ── */
	useEffect(() => {
		if (actorSchoolId == null || schoolYearId == null) {
			setRoomOptions([]);
			return;
		}
		let cancelled = false;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();
		fetchConcernRoomOptions(actorSchoolId, schoolYearId)
			.then((rooms) => {
				if (cancelled || !isCurrentEpoch(token, epoch)) return;
				setRoomOptions(rooms);
			})
			.catch(() => {
				if (cancelled || !isCurrentEpoch(token, epoch)) return;
				setRoomOptions([]);
			});
		return () => {
			cancelled = true;
		};
	}, [actorSchoolId, schoolYearId]);

	/* ── Selected teacher: availability + run freshness + room state ── */
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

			/*
			 * The room read is SEPARATE and is never allowed to masquerade as "no
			 * timetable". `fetchConcernRoomState` maps only `NO_ACTIVE_DRAFT` to null;
			 * anything else is a real failure and is shown as one, because a silent
			 * catch here would render an outage as a calm, reassuring absence.
			 */
			try {
				setRoomState(await fetchConcernRoomState({ schoolId: actorSchoolId, schoolYearId, facultyId: selectedFacultyId }));
				setRoomError(null);
			} catch {
				if (!isCurrent()) return;
				setRoomState(null);
				setRoomError('Could not read this teacher’s rooms just now. Reload to try again — nothing was changed.');
			}
		} finally {
			/*
			 * A3 p1 — THE LOADING FLAG WAS NEVER CLEARED, so this page dead-ended a
			 * second way, independently of the inverted predicate.
			 *
			 * `setLoadingConcern(true)` had no counterpart. The render gate is
			 * `loadingConcern && availability == null`, so the skeleton was only ever
			 * escaped by an EXISTING record. A teacher with no availability record
			 * yet — which is `{"availability": null}`, the normal state for any
			 * teacher a scheduler is about to write for the first time — left the
			 * page on a permanent skeleton: no grid, no "Anything else", no Save,
			 * and no sentence, because none of them were rendered at all.
			 *
			 * That is the same user-visible class as the outage this packet was
			 * written for, and it made the packet's own requirement unreachable:
			 * the disabled-Save reason could never appear for exactly the teacher
			 * who most needs to fill the form in. Clearing the flag in `finally`
			 * ends it for every outcome, and the `isCurrent()` guard keeps a
			 * superseded read from clearing a NEWER load's flag.
			 */
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
		setRoomState(null);
		setRoomDrafts({});
		setRoomPreviews({});
		setRoomError(null);
		setSavedMessage(null);
		setSaveFailure(null);
		setSaveOutcome(null);
	}, [selectedFacultyId]);

	/* ── Availability record → editable form state ── */
	useEffect(() => {
		setPickerSlots(availabilityRecordToPickerSlots(availability));
		const parsed = parseConcernNotes(availability?.notes ?? null);
		setNotes(parsed.notes);
		setRoomRequests(parsed.roomRequests);
	}, [availability]);

	/*
	 * The preview line. `preview` is ZERO-WRITE on the server, so it is safe to
	 * run as soon as a class has a saved request — which is what makes the
	 * preview visible BEFORE the move, the way the page promises.
	 */
	useEffect(() => {
		if (actorSchoolId == null || schoolYearId == null || selectedFacultyId == null || roomState == null) return;
		const entries = roomState.entries.filter((entry) => entry.requestId != null && entry.requestedRoomId != null);
		if (entries.length === 0) return;
		let cancelled = false;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();
		const isCurrent = () => !cancelled && isCurrentEpoch(token, epoch);
		setPreviewingEntryId(entries[0]?.entryId ?? null);
		Promise.all(
			entries.map(async (entry) => {
				try {
					const response = await previewConcernRoomRequest(
						{ schoolId: actorSchoolId, schoolYearId, facultyId: selectedFacultyId },
						roomState.runId,
						entry.requestId as number,
					);
					return [entry.requestId as number, response.preview] as const;
				} catch {
					return null;
				}
			}),
		).then((results) => {
			if (!isCurrent()) return;
			const next: Record<number, PreviewResult> = {};
			for (const result of results) if (result) next[result[0]] = result[1];
			setRoomPreviews(next);
			setPreviewingEntryId(null);
		});
		return () => {
			cancelled = true;
		};
	}, [actorSchoolId, schoolYearId, selectedFacultyId, roomState]);

	const selectedFaculty = useMemo(
		() => faculty.find((entry) => entry.id === selectedFacultyId) ?? null,
		[faculty, selectedFacultyId],
	);

	const termUnresolved = activeTermIndex == null;
	/**
	 * A3 p1 — ONE function decides both "may this page write" and "if not, why
	 * not", so the flag the Save button reads and the sentence the operator reads
	 * cannot drift apart. The reason is non-null if and only if writes are
	 * disabled; `a3p1-concern-save-reason.test.tsx` proves that pairing holds for
	 * every combination of these inputs.
	 */
	const saveAvailability = resolveConcernSaveAvailability({
		actorSchoolId,
		schoolYearId,
		activeTermIndex,
		selectedFacultyId,
		yearResolution,
	});
	const writesDisabled = saveAvailability.writesDisabled;
	const facultyOptions = useMemo(
		() => faculty.map((entry) => ({ value: String(entry.id), label: facultyLabel(entry) })),
		[faculty],
	);

	/**
	 * A5-C2A — one action that re-runs BOTH the term resolution and the concern
	 * read, so "check for updates" actually changes the outcome on the page rather
	 * than just refetching the record behind an unchanged verdict.
	 */
	const bumpRefresh = () => {
		setRefreshNonce((nonce) => nonce + 1);
		setTermRefreshNonce((nonce) => nonce + 1);
	};

	const handleRoomDraftChange = useCallback((entryId: string, patch: Partial<ConcernRoomDraft>) => {
		setRoomDrafts((current) => {
			const base = current[entryId] ?? { requestedRoomId: null, rationale: '' };
			return {
				...current,
				[entryId]: { requestedRoomId: base.requestedRoomId, rationale: base.rationale, ...patch },
			};
		});
	}, []);

	/* ── THE ONE SAVE ──
	 *
	 * Availability is carried through save → submit → review, because the server
	 * reads `status: 'REVIEWED'` ONLY when building a timetable
	 * (faculty-availability.service.ts:345). A page that stopped at a draft would
	 * be a false errand. Room needs are written as drafts, which is a real,
	 * complete record and — unlike a submitted request — does not block the next
	 * generation run (generation.service.ts:1183 counts SUBMITTED+PENDING only).
	 */
	const handleSave = async () => {
		if (actorSchoolId == null || schoolYearId == null || selectedFacultyId == null || activeTermIndex == null || !selectedFaculty) return;
		setSaving(true);
		setConcernError(null);
		setSaveFailure(null);
		setSaveOutcome(null);
		try {
			const { availability: record, bindFailure } = await saveAndBindAvailability({
				schoolId: actorSchoolId,
				schoolYearId,
				facultyId: selectedFacultyId,
				termIndex: activeTermIndex,
				slots: pickerSlotsToAvailability(pickerSlots),
				notes: composeConcernNotes(notes, roomRequests),
				version: availability?.version ?? null,
			});
			setAvailability(record);

			let rooms = roomState;
			if (rooms != null) {
				for (const entry of rooms.entries) {
					const draft = roomDrafts[entry.entryId];
					if (draft?.requestedRoomId == null || draft.requestedRoomId === entry.requestedRoomId) continue;
					rooms = await saveConcernRoomDraft({
						schoolId: actorSchoolId,
						schoolYearId,
						facultyId: selectedFacultyId,
						runId: rooms.runId,
						entryId: entry.entryId,
						requestedRoomId: draft.requestedRoomId,
						rationale: draft.rationale.trim() || null,
						expectedRunVersion: rooms.runVersion,
						requestVersion: entry.version ?? null,
					});
				}
				setRoomState(rooms);
			}

			const countsFor = {
				teacherName: facultyLabel(selectedFaculty),
				availabilityWindows: pickerSlots.length,
				roomNeeds: rooms?.entries.filter((entry) => entry.requestedRoomId != null).length ?? 0,
				hasNote: notes.trim().length > 0,
				bindFailure,
			};
			setSavedMessage(describeSavedConcern(countsFor));
			/*
			 * N2 — the chip reads a TYPED state, never a substring of the sentence
			 * above. A copy edit to `describeSavedConcern` can no longer silently
			 * turn "Saved" into "Saved, not yet counted" or back: the reason the
			 * server gave us is carried beside the sentence as data.
			 *
			 * A3 p1 correction round 1, N6 — this line is deliberately left as the
			 * simple typed assignment. Round 1 special-cased an empty save to
			 * `null` so the chip would stop reading "Saved" beside a "Nothing to
			 * save" receipt, but staging proved the empty save really does write a
			 * REVIEWED record, so the chip was truthful and the RECEIPT was the
			 * lie. Silencing the chip would have hidden a true statement and
			 * weakened this N2 contract to do it. The receipt is corrected in
			 * `describeSavedConcern` instead; an empty save still binds, and both
			 * sentences now agree.
			 */
			setSaveOutcome(bindFailure == null ? 'SAVED' : 'SAVED_NOT_BINDING');
			bumpRefresh();
		} catch (error) {
			setSaveFailure(concernApiErrorMessage(error));
			setConcernError(getActionableApiError(error, 'This teacher’s preferences were not saved.'));
		} finally {
			setSaving(false);
		}
	};

	/* ── THE APPLY — the existing review path, which is what moves the class ── */
	const handleApplyRoom = async (entry: FacultyRoomPreferenceEntry) => {
		if (actorSchoolId == null || schoolYearId == null || selectedFacultyId == null || roomState == null || entry.requestId == null) return;
		setApplyingEntryId(entry.entryId);
		setRoomError(null);
		try {
			/*
			 * `submitConcernRoom` RE-BUMPS the request version on an existing row
			 * (`version: { increment: 1 }`, room-preference.service.ts:699), so the
			 * review PATCH must carry the version the submit just returned. Sending
			 * the pre-submit version is a 409 VERSION_CONFLICT and the move silently
			 * would not happen — which is exactly the false errand this page exists
			 * to remove.
			 */
			const submitted = await submitConcernRoom({
				schoolId: actorSchoolId,
				schoolYearId,
				facultyId: selectedFacultyId,
				runId: roomState.runId,
				entryId: entry.entryId,
				requestedRoomId: entry.requestedRoomId as number,
				rationale: roomDrafts[entry.entryId]?.rationale.trim() || entry.rationale || null,
				expectedRunVersion: roomState.runVersion,
				requestVersion: entry.version ?? null,
			});
			const fresh = submitted.entries.find((candidate) => candidate.entryId === entry.entryId);
			await applyConcernRoomRequest({
				schoolId: actorSchoolId,
				schoolYearId,
				facultyId: selectedFacultyId,
				runId: roomState.runId,
				requestId: entry.requestId,
				expectedRunVersion: submitted.runVersion,
				requestVersion: fresh?.version ?? 1,
				reviewerNotes: null,
			});
			setRoomDrafts((current) => {
				const next = { ...current };
				delete next[entry.entryId];
				return next;
			});
			// A move bumps the run version, so the next move must read it fresh.
			bumpRefresh();
		} catch (error) {
			setRoomError(concernApiErrorMessage(error));
		} finally {
			setApplyingEntryId(null);
		}
	};

	/*
	 * N2 — derived from the typed `saveOutcome` union, never from the saved
	 * sentence. A pre-existing record that already binds also reads as SAVED, so
	 * a reload lands on the same chip as the save that produced it.
	 */
	const bindFailure = saveOutcome === 'SAVED_NOT_BINDING';
	const statusInput = {
		selected: selectedFacultyId != null,
		saved: saveOutcome != null || (availability != null && availability.status === 'REVIEWED'),
		bindFailure,
	};

	return (
		<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-muted/30'>
			<div className='flex-1 min-h-0 overflow-auto px-4 py-5 sm:px-6'>
				<div className='mx-auto w-full max-w-6xl space-y-4'>
					<div className='space-y-3'>
						<PageHeader
							title='Teacher Preferences'
							source={
								<Badge variant={concernSaveStateTone(statusInput)} data-testid='concern-save-state'>
									{concernSaveStateLabel(statusInput)}
								</Badge>
							}
							secondaryActions={(
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button type='button' variant='outline' size='sm' aria-label='More'>
											<MoreHorizontal className='size-4' aria-hidden='true' />
											More
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align='end'>
										<DropdownMenuItem onSelect={bumpRefresh}>
											<RefreshCcw className='mr-1.5 size-4' aria-hidden='true' />
											Check for updates
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
							testId='teacher-concerns-header'
						/>
						{/* A5 c8 (2026-09-29) — THE LAYOUT NOTE, BEFORE THE JSX.
						    *
						    * The sweep's finding on this page was a MINOR, and it is the clearest
						    * statement of the shared-bar problem in its purest form: the page's only
						    * filter sat far below the header, inside its own bordered card, in its
						    * own look, with its own `w-full` width and an uppercase `TEACHER` label
						    * above it. Nothing was hidden. It just did not read as part of ATLAS.
						    *
						    * WHAT STAYS .... the same `SearchableSelect`, the same `facultyOptions`
						    *                list, the same `selectedFacultyId` binding, the same
						    *                disabled behaviour, and BOTH honest placeholders
						    *                (`Teacher roster unavailable`, `No teachers loaded`) —
						    *                they are states a user needs to read, not wording.
						    * WHAT GOES .... the card, the `w-full max-w-xs` column, the uppercase
						    *                `TEACHER` label (a picker that names itself does not
						    *                need a second copy of its name above it) and the
						    *                `Search a teacher by name…` placeholder, normalised to
						    *                the shared `Search teacher…` form.
						    * WHAT MOVES .. the control becomes the SEARCH slot of the one shared
						    *                `FilterBar`, in the common position below the page
						    *                title / status strip.
						    *
						    * ONE DEVIATION WORTH NAMING: the shared bar's search slot is an
						    * `@/ui` `Input`, and this control is a SEARCHABLE COMBOBOX — it
						    * filters as you type and opens onto the roster. Building the bar's
						    * slot as a plain input would have replaced a searchable picker with
						    * a text box that searches nothing, which is a regression dressed as
						    * a refactor. So the control stays a `SearchableSelect` and is the
						    * bar's only child; the bar contributes the row geometry, the `h-9`
						    * shared height and the `auto` width, which is what this page was
						    * missing. The `filterAnnouncement`-style status line and the error
						    * line below are untouched. */}
						<FilterBar dataTestId='teacher-concerns-filter-bar'>
							<SearchableSelect
								items={facultyOptions}
								value={selectedFacultyId == null ? '' : String(selectedFacultyId)}
								onValueChange={(value) => setSelectedFacultyId(value ? Number(value) : null)}
								placeholder={facultyError ? 'Teacher roster unavailable' : faculty.length === 0 ? 'No teachers loaded' : 'Search teacher…'}
								ariaLabel='Search a teacher by name'
								disabled={faculty.length === 0}
								disabledReason={facultyError ?? 'Load the teacher roster first.'}
								triggerClassName={pickerTriggerClass('auto')}
							/>
						</FilterBar>
						{facultyError ? <p className='mt-1.5 text-xs text-destructive'>{facultyError}</p> : null}
					</div>

					{schoolYearNotice && <p className='text-xs text-muted-foreground'>{schoolYearNotice}</p>}

					{/* A5-C2A — the saved-data label, rendered whenever the canonical
					    resolver answered from the saved verified ordered-term snapshot,
					    with the REAL capture time, and the workflow stays usable. */}
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
										The signed-in session has no resolved school, so this teacher&rsquo;s preferences cannot be loaded or saved.
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

					{/*
					 * A3 p1 — THIS CARD OWNS THE DETAILED TERM REASON, and the sticky
					 * Save row owns only the short consequence. They must not share a
					 * string.
					 *
					 * Round 1, B1: the first fix deleted this card's trailing "Writes
					 * stay disabled…" line, but the duplicate was not that line — it
					 * was the shared `unresolvedTermReason` itself, which the Save-row
					 * helper was concatenating into its own sentence. The two
					 * conditions coincide exactly, so one sentence printed twice on
					 * one screen. The helper no longer receives this value at all.
					 *
					 * The EnrollPro wording below, including its `reported ${code}`
					 * form, is DELIBERATE here and stays: this card is the diagnostic
					 * surface, it sits beside the "Re-check the active term" action,
					 * and a scheduler chasing a term problem needs the real upstream
					 * code. B2's fix removed the code from the Save row, not from here.
					 */}
					{termUnresolved && actorSchoolId != null && schoolYearId != null && (
						<Card className='rounded-2xl border-warning-border bg-warning-muted' data-testid='concern-term-unresolved'>
							<CardContent className='flex items-start gap-3 py-6'>
								<AlertTriangle className='mt-0.5 size-5 text-warning' aria-hidden='true' />
								<div className='min-w-0 space-y-2'>
									<p className='text-sm font-semibold text-warning-foreground'>Active ordered term unresolved</p>
									<p className='text-xs leading-relaxed text-warning-foreground/90'>
										{unresolvedTermReason ?? 'Availability is term-scoped, so ATLAS will not save this teacher’s preferences until an ordered term is verified.'}
									</p>
									<Button type='button' variant='outline' size='sm' onClick={bumpRefresh}>
										<RefreshCcw className='mr-1.5 size-4' aria-hidden='true' />
										Re-check the active term
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

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
									writesDisabled={writesDisabled}
									saving={saving}
									onSave={handleSave}
									schoolId={actorSchoolId}
									roomState={roomState}
									roomOptions={roomOptions}
									roomDrafts={roomDrafts}
									onRoomDraftChange={handleRoomDraftChange}
									roomPreviews={roomPreviews}
									onApplyRoom={handleApplyRoom}
									previewingEntryId={previewingEntryId}
									applyingEntryId={applyingEntryId}
									roomError={roomError}
									legacyRoomNote={roomRequests.trim() || null}
									savedMessage={savedMessage}
									saveFailure={saveFailure}
									saveDisabledReason={saveAvailability.reason}
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
										This page records one teacher&apos;s weekly availability, the rooms they need, and anything
										else you need to remember, then saves it in one go.
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
