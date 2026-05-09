import { useCallback, useEffect, useRef, useState } from 'react';
import {
	AlertCircle,
	CalendarClock,
	CheckCircle2,
	Clock,
	Heart,
	Lock,
	Loader2,
	Plus,
	Save,
	Send,
	Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { fetchPublicSettings, fetchSchoolYears, type SchoolYear } from '@/lib/settings';
import type {
	DayOfWeek,
	FacultyPreference,
	TimeSlotPreference,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import { Switch } from '@/ui/switch';
import { Textarea } from '@/ui/textarea';
import PlainLanguageNotice from '@/components/faculty-shared/PlainLanguageNotice';
import StatusRail from '@/components/faculty-shared/StatusRail';
import StepFlowHeader from '@/components/faculty-shared/StepFlowHeader';

/* ─── Constants ─── */

const DEFAULT_SCHOOL_ID = 1;

function resolveSchoolYearContext(settingsActiveSchoolYearId: number | null, years: SchoolYear[]) {
	if (settingsActiveSchoolYearId) {
		return {
			schoolYearId: settingsActiveSchoolYearId,
			notice: null as string | null,
		};
	}

	const sortedYears = [...years].sort((left, right) => right.id - left.id);
	const inferredActive = sortedYears.find((year) => year.isActive || year.status?.toUpperCase() === 'ACTIVE');
	if (inferredActive) {
		return {
			schoolYearId: inferredActive.id,
			notice: `Showing School Year ${inferredActive.yearLabel}.`,
		};
	}

	if (sortedYears[0]) {
		return {
			schoolYearId: sortedYears[0].id,
			notice: `Showing School Year ${sortedYears[0].yearLabel}.`,
		};
	}

	return {
		schoolYearId: 1,
		notice: 'Showing a fallback school year while setup is being completed.',
	};
}

const DAYS: { value: DayOfWeek; label: string }[] = [
	{ value: 'MONDAY', label: 'Monday' },
	{ value: 'TUESDAY', label: 'Tuesday' },
	{ value: 'WEDNESDAY', label: 'Wednesday' },
	{ value: 'THURSDAY', label: 'Thursday' },
	{ value: 'FRIDAY', label: 'Friday' },
];

const PREF_OPTIONS: { value: TimeSlotPreference; label: string; color: string }[] = [
	{ value: 'PREFERRED', label: 'Preferred', color: 'text-green-700 bg-green-50 border-green-200' },
	{ value: 'AVAILABLE', label: 'Available', color: 'text-blue-700 bg-blue-50 border-blue-200' },
	{ value: 'UNAVAILABLE', label: 'Unavailable', color: 'text-red-700 bg-red-50 border-red-200' },
];

type SlotRow = {
	key: string;
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	preference: TimeSlotPreference;
};

let slotKeyCounter = 0;
function nextKey() {
	return `slot-${++slotKeyCounter}`;
}

function emptySlot(): SlotRow {
	return { key: nextKey(), day: 'MONDAY', startTime: '08:00', endTime: '09:00', preference: 'AVAILABLE' };
}

/* ─── Well-being ─── */

type WellbeingState = {
	pregnancySupport: boolean;
	physicalAilmentSupport: boolean;
	minimizeTravelTime: boolean;
	avoidUpperFloors: boolean;
};

const DEFAULT_WELLBEING: WellbeingState = {
	pregnancySupport: false,
	physicalAilmentSupport: false,
	minimizeTravelTime: false,
	avoidUpperFloors: false,
};

const WELLBEING_ITEMS: { key: keyof WellbeingState; label: string; description: string }[] = [
	{
		key: 'pregnancySupport',
		label: 'Pregnancy support',
		description: 'Avoid prolonged standing; prefer ground-floor rooms near restrooms.',
	},
	{
		key: 'physicalAilmentSupport',
		label: 'Physical ailment / mobility support',
		description: 'Mobility limitation — prefer accessible rooms and minimize walking distance.',
	},
	{
		key: 'minimizeTravelTime',
		label: 'Minimize travel time between classes',
		description: 'Prefer consecutive classes in the same or adjacent rooms.',
	},
	{
		key: 'avoidUpperFloors',
		label: 'Avoid upper floors (2nd floor and above)',
		description: 'Prefer ground-floor rooms. Elevator access may not always be available.',
	},
];

/* ─── Page ─── */

export default function FacultyPreferences() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [locked, setLocked] = useState(false);
	const [lockedMsg, setLockedMsg] = useState('');
	const [reviewUpdates, setReviewUpdates] = useState(0);
	const sseRef = useRef<EventSource | null>(null);

	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [facultyId, setFacultyId] = useState<number | null>(null);
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);
	const [online, setOnline] = useState<boolean>(navigator.onLine);
	const [sseConnected, setSseConnected] = useState(false);
	const [sseError, setSseError] = useState<string | null>(null);

	const [preference, setPreference] = useState<FacultyPreference | null>(null);
	const [slots, setSlots] = useState<SlotRow[]>([emptySlot()]);
	const [notes, setNotes] = useState('');
	const [version, setVersion] = useState(1);
	const [wellbeing, setWellbeing] = useState<WellbeingState>(DEFAULT_WELLBEING);

	/* ── Resolve session context ── */
	useEffect(() => {
		(async () => {
			try {
				const [settings, years] = await Promise.all([fetchPublicSettings(), fetchSchoolYears()]);
				const schoolYearContext = resolveSchoolYearContext(settings.activeSchoolYearId, years);
				setActiveSchoolYearId(schoolYearContext.schoolYearId);
				setSchoolYearNotice(schoolYearContext.notice);

				// Resolve faculty mapping from bridge identity
				const { data: facultyMe } = await atlasApi.get<{ faculty: { id: number } }>('/faculty/me', {
					params: { schoolId: DEFAULT_SCHOOL_ID },
				});
				if (!facultyMe?.faculty?.id) {
					setError('Your account is not linked to a faculty record in this school. Contact your scheduling officer.');
					setLoading(false);
					return;
				}
				setFacultyId(facultyMe.faculty.id);
			} catch {
				setError("We couldn't load your account details. Please tap Retry.");
				setLoading(false);
			}
		})();
	}, []);

	/* ── Load existing preference ── */
	const loadPreference = useCallback(async () => {
		if (!activeSchoolYearId || !facultyId) return;
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ preference: FacultyPreference | null }>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/faculty/${facultyId}`,
			);
			if (data.preference) {
				const pref = data.preference;
				setPreference(pref);
				setVersion(pref.version);
				setNotes(pref.notes ?? '');
				setWellbeing({
					pregnancySupport: pref.pregnancySupport,
					physicalAilmentSupport: pref.physicalAilmentSupport,
					minimizeTravelTime: pref.minimizeTravelTime,
					avoidUpperFloors: pref.avoidUpperFloors,
				});
				if (pref.timeSlots.length > 0) {
					setSlots(
						pref.timeSlots.map((ts) => ({
							key: nextKey(),
							day: ts.day,
							startTime: ts.startTime,
							endTime: ts.endTime,
							preference: ts.preference,
						})),
					);
				} else {
					setSlots([emptySlot()]);
				}
			} else {
				setPreference(null);
				setSlots([emptySlot()]);
				setNotes('');
				setVersion(1);
				setWellbeing(DEFAULT_WELLBEING);
			}
			setError(null);
			setLocked(false);
		} catch {
			setError('Failed to load your preferences.');
		} finally {
			setLoading(false);
		}
	}, [activeSchoolYearId, facultyId]);

	useEffect(() => {
		if (activeSchoolYearId && facultyId) loadPreference();
	}, [activeSchoolYearId, facultyId, loadPreference]);

	/* ── SSE: bilateral preference events ── */
	useEffect(() => {
		const updateOnline = () => setOnline(navigator.onLine);
		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		return () => {
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
		};
	}, []);

	useEffect(() => {
		if (!activeSchoolYearId || !facultyId) return;
		const token = getPreferredAccessToken();
		const tokenParam = token ? `accessToken=${encodeURIComponent(token)}` : '';
		const url = `/api/v1/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/events${tokenParam ? '?' + tokenParam : ''}`;
		const es = new EventSource(url);
		sseRef.current = es;
		es.onopen = () => {
			setSseConnected(true);
			setSseError(null);
		};
		es.addEventListener('preference', (ev) => {
			try {
				const event = JSON.parse((ev as MessageEvent).data) as {
					type: string;
					facultyId: number | null;
					metadata?: { reviewStatus?: string };
				};
				if (event.type === 'PREFERENCE_REVIEWED' && event.facultyId === facultyId) {
					setReviewUpdates((n) => n + 1);
					const statusLabel = event.metadata?.reviewStatus ?? 'reviewed';
					toast.info(`Your preferences were marked as ${statusLabel} by the scheduling officer.`);
					loadPreference();
				}
			} catch {
				// Ignore parse errors
			}
		});
		es.onerror = () => {
			setSseConnected(false);
			setSseError('Realtime updates are reconnecting.');
		};
		return () => {
			es.close();
			sseRef.current = null;
			setSseConnected(false);
		};
	}, [activeSchoolYearId, facultyId, loadPreference]);

	/* ── Slot mutations ── */
	const updateSlot = (key: string, field: keyof SlotRow, value: string) => {
		setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
	};
	const removeSlot = (key: string) => {
		setSlots((prev) => {
			const next = prev.filter((s) => s.key !== key);
			return next.length > 0 ? next : [emptySlot()];
		});
	};
	const addSlot = () => setSlots((prev) => [...prev, emptySlot()]);

	/* ── Build payload ── */
	function buildPayload() {
		return {
			notes: notes.trim() || null,
			timeSlots: slots.map((s) => ({
				day: s.day,
				startTime: s.startTime,
				endTime: s.endTime,
				preference: s.preference,
			})),
			wellbeing,
			version,
		};
	}

	/* ── Handle API error ── */
	function handleApiError(err: unknown, action: string) {
		const resp = (err as { response?: { status?: number; data?: { code?: string; message?: string } } })?.response;
		if (
			resp?.status === 422 &&
			(resp.data?.code === 'PREFERENCE_LOCKED' || resp.data?.code === 'PREFERENCE_WINDOW_CLOSED')
		) {
			setLocked(true);
			setLockedMsg(resp.data?.message ?? 'Preferences are currently locked.');
			return;
		}
		if (resp?.status === 409 && resp.data?.code === 'VERSION_CONFLICT') {
			toast.error('Your preference was modified elsewhere. Reloading…');
			loadPreference();
			return;
		}
		toast.error(resp?.data?.message ?? `Failed to ${action}.`);
	}

	/* ── Save draft ── */
	const saveDraft = async () => {
		if (!activeSchoolYearId || !facultyId) return;
		setSaving(true);
		try {
			const { data } = await atlasApi.put<{ preference: FacultyPreference }>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/faculty/${facultyId}/draft`,
				buildPayload(),
			);
			setPreference(data.preference);
			setVersion(data.preference.version);
			toast.success('Draft saved successfully.');
		} catch (err) {
			handleApiError(err, 'save draft');
		} finally {
			setSaving(false);
		}
	};

	/* ── Submit ── */
	const submitPreference = async () => {
		if (!activeSchoolYearId || !facultyId) return;
		setSubmitting(true);
		try {
			const { data } = await atlasApi.post<{ preference: FacultyPreference }>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/faculty/${facultyId}/submit`,
				buildPayload(),
			);
			setPreference(data.preference);
			setVersion(data.preference.version);
			toast.success('Preference submitted successfully!');
		} catch (err) {
			handleApiError(err, 'submit');
		} finally {
			setSubmitting(false);
		}
	};

	/* ── Derived state ── */
	const isSubmitted = preference?.status === 'SUBMITTED';
	const canEdit = !locked;
	const preferenceStep = locked || isSubmitted ? 3 : 2;
	const topBanner: 'locked' | 'review' | 'submitted' | null = locked
		? 'locked'
		: reviewUpdates > 0
			? 'review'
			: isSubmitted
				? 'submitted'
				: null;

	/* ── Render ── */

	if (loading) {
		return (
			<div className='p-6 space-y-4'>
				<Skeleton className='h-8 w-64' />
				<Skeleton className='h-4 w-96' />
				<div className='grid gap-3 mt-4'>
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className='h-14 w-full' />
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-6'>
				<Card>
					<CardContent className='flex items-start gap-3 py-8'>
						<AlertCircle className='mt-0.5 size-5 text-destructive shrink-0' />
						<div className='flex-1 min-w-0'>
							<p className='font-medium text-destructive'>Could not load your preferences</p>
							<p className='text-sm text-muted-foreground mt-1'>{error}</p>
							<p className='text-xs text-muted-foreground mt-2'>Try refreshing. If this keeps happening, contact your scheduling officer.</p>
						</div>
						<Button variant='outline' size='sm' className='shrink-0' onClick={() => void loadPreference()}>
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-[calc(100svh-3.5rem)] max-w-5xl mx-auto w-full'>

			{/* Pinned notification banners */}
			{topBanner && (
				<div className='shrink-0 pt-4 px-4 sm:pt-6 sm:px-6 space-y-2'>
					<AnimatePresence>
						{topBanner === 'locked' && (
							<motion.div
								key='locked-banner'
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
							>
								<PlainLanguageNotice
									variant='warning'
									title='Preferences locked'
									whatHappened={lockedMsg}
									whatNow='Review your latest submission status while waiting for the scheduling officer to reopen edits.'
									whoToContact='Your scheduling officer'
								/>
							</motion.div>
						)}
						{topBanner === 'submitted' && (
							<motion.div
								key='submitted-banner'
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
							>
								<PlainLanguageNotice
									variant='success'
									title='Preferences submitted'
									whatHappened={`Submitted ${preference?.submittedAt ? new Date(preference.submittedAt).toLocaleString() : 'N/A'}.`}
									whatNow='You can still edit until the scheduling officer locks the submission window.'
									whoToContact='Your scheduling officer'
								/>
							</motion.div>
						)}
						{topBanner === 'review' && (
							<motion.div
								key='review-banner'
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
							>
								<PlainLanguageNotice
									title='Review update received'
									whatHappened='Your preferences were reviewed. Changes are reflected below.'
									whatNow='Review the updates and adjust your draft if needed.'
									actionSlot={
										<Button
											variant='ghost'
											size='sm'
											className='h-7 px-2 text-blue-800 hover:text-blue-900'
											onClick={() => setReviewUpdates(0)}
										>
											Dismiss
										</Button>
									}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			)}

			{/* Scrolling content */}
			<div className='flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6'>
				<StepFlowHeader
					title='My Preferences'
					subtitle='Set your time slots and well-being preferences, then submit for review.'
					steps={[
						{ id: 1, label: '1 Set time slots' },
						{ id: 2, label: '2 Save draft' },
						{ id: 3, label: '3 Submit and wait' },
					]}
					activeStep={preferenceStep}
				/>

				<StatusRail
					online={online}
					syncState={online ? 'idle' : 'queued-offline'}
					liveUpdates={reviewUpdates}
					realtimeConnected={sseConnected}
					realtimeError={sseError}
				/>

				{schoolYearNotice && (
					<div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
						{schoolYearNotice}
					</div>
				)}

				{/* Desktop: two-panel side-by-side (time slots left, well-being right) */}
				{/* Mobile: stacked cards */}
				<div className='lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-4 lg:space-y-0'>

				{/* Time slots editor */}
				<Card>
					<CardContent className='pt-5 space-y-4'>
						<div className='flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<Clock className='size-4 text-muted-foreground' />
								<h2 className='text-sm font-semibold'>Time Slot Preferences</h2>
							</div>
							{canEdit && (
								<Button variant='outline' size='sm' onClick={addSlot} className='h-7 gap-1'>
									<Plus className='size-3.5' />
									Add Slot
								</Button>
							)}
						</div>

						<div className='hidden sm:grid sm:grid-cols-[1fr_100px_100px_140px_40px] gap-2 px-1 text-xs font-medium text-muted-foreground'>
							<span>Day</span>
							<span>Start</span>
							<span>End</span>
							<span>Preference</span>
							<span />
						</div>

						<div className='space-y-3'>
							<AnimatePresence initial={false}>
								{slots.map((slot) => (
									<motion.div
										key={slot.key}
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: 'auto' }}
										exit={{ opacity: 0, height: 0 }}
									>
										{/* Mobile card layout */}
										<div className='sm:hidden rounded-xl border border-border bg-card p-3 space-y-2.5'>
											<div className='flex items-center justify-between gap-2'>
												<span className='text-xs font-medium text-muted-foreground'>Day</span>
												{canEdit && (
													<Button
														variant='ghost'
														size='icon'
														className='size-7 text-muted-foreground hover:text-destructive'
														onClick={() => removeSlot(slot.key)}
													>
														<Trash2 className='size-3.5' />
													</Button>
												)}
											</div>
											<Select
												value={slot.day}
												onValueChange={(v) => updateSlot(slot.key, 'day', v)}
												disabled={!canEdit}
											>
												<SelectTrigger className='h-11 text-base'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{DAYS.map((d) => (
														<SelectItem key={d.value} value={d.value}>
															{d.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<div className='grid grid-cols-2 gap-2'>
												<div className='space-y-1'>
													<span className='text-xs font-medium text-muted-foreground'>Start</span>
													<Input
														type='time'
														value={slot.startTime}
														onChange={(e) => updateSlot(slot.key, 'startTime', e.target.value)}
														disabled={!canEdit}
														className='h-11 text-base'
													/>
												</div>
												<div className='space-y-1'>
													<span className='text-xs font-medium text-muted-foreground'>End</span>
													<Input
														type='time'
														value={slot.endTime}
														onChange={(e) => updateSlot(slot.key, 'endTime', e.target.value)}
														disabled={!canEdit}
														className='h-11 text-base'
													/>
												</div>
											</div>
											<div className='space-y-1'>
												<span className='text-xs font-medium text-muted-foreground'>Preference</span>
												<Select
													value={slot.preference}
													onValueChange={(v) => updateSlot(slot.key, 'preference', v)}
													disabled={!canEdit}
												>
													<SelectTrigger className='h-11 text-base'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{PREF_OPTIONS.map((p) => (
															<SelectItem key={p.value} value={p.value}>
																{p.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>

										{/* Desktop row layout */}
										<div className='hidden sm:grid sm:grid-cols-[1fr_100px_100px_140px_40px] gap-2 items-center'>
											<Select
												value={slot.day}
												onValueChange={(v) => updateSlot(slot.key, 'day', v)}
												disabled={!canEdit}
											>
												<SelectTrigger className='h-9 text-sm'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{DAYS.map((d) => (
														<SelectItem key={d.value} value={d.value}>
															{d.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<Input
												type='time'
												value={slot.startTime}
												onChange={(e) => updateSlot(slot.key, 'startTime', e.target.value)}
												disabled={!canEdit}
												className='h-9 text-sm'
											/>
											<Input
												type='time'
												value={slot.endTime}
												onChange={(e) => updateSlot(slot.key, 'endTime', e.target.value)}
												disabled={!canEdit}
												className='h-9 text-sm'
											/>
											<Select
												value={slot.preference}
												onValueChange={(v) => updateSlot(slot.key, 'preference', v)}
												disabled={!canEdit}
											>
												<SelectTrigger className='h-9 text-sm'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{PREF_OPTIONS.map((p) => (
														<SelectItem key={p.value} value={p.value}>
															{p.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											{canEdit && (
												<Button
													variant='ghost'
													size='icon'
													className='size-9 text-muted-foreground hover:text-destructive'
													onClick={() => removeSlot(slot.key)}
												>
													<Trash2 className='size-3.5' />
												</Button>
											)}
										</div>
									</motion.div>
								))}
							</AnimatePresence>
						</div>
					</CardContent>
				</Card>

				{/* Right column on desktop: well-being + notes */}
				<div className='space-y-4'>

				{/* Well-being preferences */}
				<Card>
					<CardContent className='pt-5 space-y-4'>
						<div className='flex items-center gap-2'>
							<Heart className='size-4 text-rose-500' />
							<h2 className='text-sm font-semibold'>Well-being Preferences</h2>
							<span className='text-xs text-muted-foreground ml-1'>
								(Scheduling officer has final authority on accommodations)
							</span>
						</div>
						<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-1'>
							{WELLBEING_ITEMS.map(({ key, label, description }) => (
								<div
									key={key}
									className='flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/30'
								>
									<Switch
										id={`wb-${key}`}
										checked={wellbeing[key]}
										onCheckedChange={(checked) =>
											setWellbeing((prev) => ({ ...prev, [key]: checked }))
										}
										disabled={!canEdit}
										className='mt-0.5 shrink-0'
									/>
									<div>
										<Label htmlFor={`wb-${key}`} className='text-sm font-medium cursor-pointer'>
											{label}
										</Label>
										<p className='text-xs text-muted-foreground mt-0.5'>{description}</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				{/* Notes */}
				<Card>
					<CardContent className='pt-5 space-y-2'>
						<Label className='text-sm font-semibold'>Additional Notes</Label>
						<Textarea
							placeholder='Any additional scheduling preferences or constraints…'
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							disabled={!canEdit}
							className='min-h-20 resize-y'
						/>
					</CardContent>
				</Card>

				</div>{/* end right col */}
				</div>{/* end desktop grid */}

			</div>{/* end scrolling content */}

			{/* Actions bar */}
			<div className='shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border px-4 py-3 sm:px-6 sm:py-4 bg-background'>
				<div>
					{preference && (
						<div className='flex items-center gap-3'>
							<span className='text-sm font-medium text-muted-foreground'>Status</span>
							<Badge variant={locked ? 'secondary' : isSubmitted ? 'success' : 'warning'}>
								{locked ? 'Locked' : isSubmitted ? 'Submitted' : 'Draft'}
							</Badge>
						</div>
					)}
				</div>

				{canEdit && (
					<div className='flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3'>
						<Button
							variant='outline'
							onClick={saveDraft}
							disabled={saving || submitting}
							className='gap-1.5 min-h-12 sm:min-h-0'
						>
							{saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
							Save Draft
						</Button>
						<Button
							onClick={submitPreference}
							disabled={saving || submitting}
							className='gap-1.5 min-h-12 sm:min-h-0'
						>
							{submitting ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
							Submit
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
