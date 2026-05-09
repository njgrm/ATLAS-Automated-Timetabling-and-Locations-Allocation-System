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
			notice: `No active school year was provided by public settings. Showing inferred active school year ${inferredActive.yearLabel}.`,
		};
	}

	if (sortedYears[0]) {
		return {
			schoolYearId: sortedYears[0].id,
			notice: `No active school year was provided by public settings. Showing latest available school year ${sortedYears[0].yearLabel}.`,
		};
	}

	return {
		schoolYearId: 1,
		notice: 'No school year metadata was available. Showing fallback school year context.',
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
				setError('Failed to load session context. Please sign in again or contact the scheduling officer if your faculty profile is not mapped yet.');
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
		if (!activeSchoolYearId || !facultyId) return;
		const token = getPreferredAccessToken();
		const tokenParam = token ? `accessToken=${encodeURIComponent(token)}` : '';
		const url = `/api/v1/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/events${tokenParam ? '?' + tokenParam : ''}`;
		const es = new EventSource(url);
		sseRef.current = es;
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
		es.onerror = () => { /* auto-reconnects */ };
		return () => { es.close(); sseRef.current = null; };
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
			{(locked || isSubmitted || reviewUpdates > 0) && (
				<div className='shrink-0 pt-6 px-6 space-y-3'>
					<AnimatePresence>
						{locked && (
							<motion.div
								key='locked-banner'
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
							>
								<Card className='border-amber-200 bg-amber-50'>
									<CardContent className='flex items-center gap-3 py-4'>
										<Lock className='size-5 text-amber-600 shrink-0' />
										<div>
											<p className='font-medium text-amber-800'>Preferences locked</p>
											<p className='text-sm text-amber-700 mt-0.5'>{lockedMsg}</p>
										</div>
									</CardContent>
								</Card>
							</motion.div>
						)}
						{!locked && isSubmitted && (
							<motion.div
								key='submitted-banner'
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
							>
								<Card className='border-green-200 bg-green-50'>
									<CardContent className='flex items-center gap-3 py-4'>
										<CheckCircle2 className='size-5 text-green-600 shrink-0' />
										<div>
											<p className='font-medium text-green-800'>Preferences submitted</p>
											<p className='text-sm text-green-700 mt-0.5'>
												Submitted {preference?.submittedAt
													? new Date(preference.submittedAt).toLocaleString()
													: 'N/A'}. You can still edit until the scheduling officer locks the window.
											</p>
										</div>
									</CardContent>
								</Card>
							</motion.div>
						)}
						{reviewUpdates > 0 && (
							<motion.div
								key='review-banner'
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
							>
								<Card className='border-blue-200 bg-blue-50'>
									<CardContent className='flex items-center gap-3 py-4'>
										<CalendarClock className='size-5 text-blue-600 shrink-0' />
										<div className='flex-1'>
											<p className='font-medium text-blue-800'>Review update received</p>
											<p className='text-sm text-blue-700 mt-0.5'>
												Your preferences were reviewed. Changes are reflected below.
											</p>
										</div>
										<Button
											variant='ghost'
											size='sm'
											className='text-blue-700 hover:text-blue-900'
											onClick={() => setReviewUpdates(0)}
										>
											Dismiss
										</Button>
									</CardContent>
								</Card>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			)}

			{/* Scrolling content */}
			<div className='flex-1 min-h-0 overflow-auto px-6 py-6 space-y-6'>
				{schoolYearNotice && (
					<div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
						{schoolYearNotice}
					</div>
				)}

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
						<div className='grid gap-4 sm:grid-cols-2'>
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

						<div className='space-y-2'>
							<AnimatePresence initial={false}>
								{slots.map((slot) => (
									<motion.div
										key={slot.key}
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: 'auto' }}
										exit={{ opacity: 0, height: 0 }}
										className='grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_140px_40px] gap-2 items-center'
									>
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
									</motion.div>
								))}
							</AnimatePresence>
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
			</div>

			{/* Actions bar */}
			<div className='shrink-0 flex items-center justify-between border-t border-border px-6 py-4 bg-background'>
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
					<div className='flex items-center gap-3'>
						<Button
							variant='outline'
							onClick={saveDraft}
							disabled={saving || submitting}
							className='gap-1.5'
						>
							{saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
							Save Draft
						</Button>
						<Button
							onClick={submitPreference}
							disabled={saving || submitting}
							className='gap-1.5'
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
