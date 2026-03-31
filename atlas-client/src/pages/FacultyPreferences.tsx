import { useCallback, useEffect, useState } from 'react';
import {
	AlertCircle,
	CalendarClock,
	CheckCircle2,
	Clock,
	Loader2,
	Plus,
	Save,
	Send,
	Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import type {
	DayOfWeek,
	FacultyPreference,
	TimeSlotPreference,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';

/* ─── Constants ─── */

const DEFAULT_SCHOOL_ID = 1;

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

/* ─── Page ─── */

export default function FacultyPreferences() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [windowClosed, setWindowClosed] = useState(false);
	const [windowClosedMsg, setWindowClosedMsg] = useState('');

	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [facultyId, setFacultyId] = useState<number | null>(null);

	const [preference, setPreference] = useState<FacultyPreference | null>(null);
	const [slots, setSlots] = useState<SlotRow[]>([emptySlot()]);
	const [notes, setNotes] = useState('');
	const [version, setVersion] = useState(1);

	/* ── Resolve session context ── */
	useEffect(() => {
		(async () => {
			try {
				const settings = await fetchPublicSettings();
				if (!settings.activeSchoolYearId) {
					setError('No active school year configured. Contact your scheduling officer.');
					setLoading(false);
					return;
				}
				setActiveSchoolYearId(settings.activeSchoolYearId);

				// Resolve faculty mapping from bridge identity
				const { data } = await atlasApi.get<{ user: { userId: number } }>('/auth/me');
				const userId = data.user.userId;

				// Find matching faculty mirror via the faculty endpoint
				const { data: facData } = await atlasApi.get<{ faculty: { id: number; externalId: number }[] }>(
					'/faculty',
					{ params: { schoolId: DEFAULT_SCHOOL_ID } },
				);
				const match = facData.faculty?.find((f) => f.externalId === userId);
				if (!match) {
					setError('Your account is not linked to a faculty record in this school. Contact your scheduling officer.');
					setLoading(false);
					return;
				}
				setFacultyId(match.id);
			} catch {
				setError('Failed to load session context.');
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
				setPreference(data.preference);
				setVersion(data.preference.version);
				setNotes(data.preference.notes ?? '');
				if (data.preference.timeSlots.length > 0) {
					setSlots(
						data.preference.timeSlots.map((ts) => ({
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
			}
			setError(null);
			setWindowClosed(false);
		} catch {
			setError('Failed to load your preferences.');
		} finally {
			setLoading(false);
		}
	}, [activeSchoolYearId, facultyId]);

	useEffect(() => {
		if (activeSchoolYearId && facultyId) loadPreference();
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
			version,
		};
	}

	/* ── Handle API error ── */
	function handleApiError(err: unknown, action: string) {
		const resp = (err as { response?: { status?: number; data?: { code?: string; message?: string } } })?.response;
		if (resp?.status === 403 && resp.data?.code === 'PREFERENCE_WINDOW_CLOSED') {
			setWindowClosed(true);
			setWindowClosedMsg(resp.data.message ?? 'Preference window is closed.');
			return;
		}
		if (resp?.status === 409 && resp.data?.code === 'VERSION_CONFLICT') {
			toast.error('Version conflict — your preference was modified elsewhere. Reloading…');
			loadPreference();
			return;
		}
		if (resp?.status === 422) {
			toast.error(resp.data?.message ?? `Cannot ${action}: preference already submitted.`);
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
	const canEdit = !isSubmitted && !windowClosed;

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
					<CardContent className='flex items-center gap-3 py-8'>
						<AlertCircle className='size-5 text-destructive shrink-0' />
						<div>
							<p className='font-medium text-destructive'>Cannot load preferences</p>
							<p className='text-sm text-muted-foreground mt-1'>{error}</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-[calc(100svh-3.5rem)] max-w-5xl mx-auto w-full'>
			{/* Notifications area (pinned) */}
			{(windowClosed || isSubmitted) && (
				<div className='shrink-0 pt-6 px-6 space-y-4'>

			{/* Window closed alert */}
			<AnimatePresence>
				{windowClosed && (
					<motion.div
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
					>
						<Card className='border-amber-200 bg-amber-50'>
							<CardContent className='flex items-center gap-3 py-4'>
								<CalendarClock className='size-5 text-amber-600 shrink-0' />
								<div>
									<p className='font-medium text-amber-800'>Preference window closed</p>
									<p className='text-sm text-amber-700 mt-0.5'>{windowClosedMsg}</p>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Submitted confirmation */}
			{isSubmitted && (
				<Card className='border-green-200 bg-green-50'>
					<CardContent className='flex items-center gap-3 py-4'>
						<CheckCircle2 className='size-5 text-green-600 shrink-0' />
						<div>
							<p className='font-medium text-green-800'>Preference submitted</p>
							<p className='text-sm text-green-700 mt-0.5'>
								Submitted on {preference?.submittedAt ? new Date(preference.submittedAt).toLocaleString() : 'N/A'}.
								Your preferences will be used for schedule generation.
							</p>
						</div>
					</CardContent>
				</Card>
			)}
			</div>
			)}

			{/* Scrolling properties area */}
			<div className="flex-1 min-h-0 overflow-auto px-6 py-6 space-y-6">
			{/* Time slots editor */}
			<Card>
				<CardContent className='pt-5 space-y-4'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-2'>
							<Clock className='size-4 text-muted-foreground' />
							<h2 className='text-sm font-semibold'>Time Slots</h2>
						</div>
						{canEdit && (
							<Button variant='outline' size='sm' onClick={addSlot} className='h-7 gap-1'>
								<Plus className='size-3.5' />
								Add Slot
							</Button>
						)}
					</div>

					{/* Column headers */}
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
					<label className='text-sm font-semibold'>Additional Notes</label>
					<textarea
						className='flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-20 resize-y'
						placeholder='Any additional scheduling preferences or constraints…'
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						disabled={!canEdit}
					/>
				</CardContent>
			</Card>

			</div>

			{/* Actions Bar Footer */}
			<div className='shrink-0 flex items-center justify-between border-t border-border px-6 py-4 bg-background'>
				<div>
					{preference && (
						<div className="flex items-center gap-3">
							<span className="text-sm font-medium text-muted-foreground">Status</span>
							<Badge variant={isSubmitted ? 'success' : 'warning'}>
								{isSubmitted ? 'Submitted' : 'Draft'}
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
