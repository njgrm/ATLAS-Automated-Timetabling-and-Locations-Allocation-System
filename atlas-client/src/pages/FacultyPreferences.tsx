import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	AlertCircle,
	Loader2,
	Save,
	Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { cacheFacultyIdentity, readCachedFacultyIdentity } from '@/lib/faculty-identity-cache';
import { buildFacultyCacheKey, isLikelyOfflineError, readFacultySnapshot, writeFacultySnapshot } from '@/lib/faculty-offline-cache';
import type {
	FacultyPreference,
	TimeSlotPreference,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import FacultyGlobalHeader from '@/components/faculty-shared/FacultyGlobalHeader';
import MobilePreferencesLayout from '@/components/faculty-preferences/MobilePreferencesLayout';
import DesktopPreferencesLayout from '@/components/faculty-preferences/DesktopPreferencesLayout';

/* ─── Constants ─── */

const DEFAULT_SCHOOL_ID = 1;
const PREFERENCE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type SlotRow = {
	day: string;
	startTime: string;
	endTime: string;
	preference: TimeSlotPreference;
};

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

type FacultyPreferenceSnapshot = {
	preference: FacultyPreference | null;
	slots: SlotRow[];
	notes: string;
	version: number;
	wellbeing: WellbeingState;
	locked: boolean;
	lockedMsg: string;
};

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
	const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
	const [sseConnected, setSseConnected] = useState(false);
	const [sseError, setSseError] = useState<string | null>(null);
	const [usingCachedPreference, setUsingCachedPreference] = useState(false);
	const [cachedPreferenceAt, setCachedPreferenceAt] = useState<string | null>(null);

	const [preference, setPreference] = useState<FacultyPreference | null>(null);
	const [slots, setSlots] = useState<SlotRow[]>([]);
	const [notes, setNotes] = useState('');
	const [version, setVersion] = useState(1);
	const [wellbeing, setWellbeing] = useState<WellbeingState>(DEFAULT_WELLBEING);

	const applyPreferenceSnapshot = useCallback((snapshot: FacultyPreferenceSnapshot) => {
		setPreference(snapshot.preference);
		setSlots(snapshot.slots);
		setNotes(snapshot.notes);
		setVersion(snapshot.version);
		setWellbeing(snapshot.wellbeing);
		setLocked(snapshot.locked);
		setLockedMsg(snapshot.lockedMsg);
	}, []);

	/* ── Resolve session context ── */
	useEffect(() => {
		(async () => {
			try {
				const schoolYearContext = await resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false });
				setActiveSchoolYearId(schoolYearContext.activeSchoolYearId);
				setSchoolYearNotice(
					schoolYearContext.source === 'atlas' && !schoolYearContext.stale
						? null
						: schoolYearContext.activeSchoolYearLabel
						? `Verified with saved school year data (${schoolYearContext.activeSchoolYearLabel}).`
						: 'Working from saved data.',
				);

				try {
					const { data: facultyMe } = await atlasApi.get<{ faculty: { id: number } }>('/faculty/me', {
						params: { schoolId: DEFAULT_SCHOOL_ID },
					});
					if (!facultyMe?.faculty?.id) {
						setError('Your account is not linked to a faculty record in this school. Contact your scheduling officer.');
						setLoading(false);
						return;
					}
					setFacultyId(facultyMe.faculty.id);
					cacheFacultyIdentity(DEFAULT_SCHOOL_ID, facultyMe.faculty.id);
				} catch (facultyError) {
					const cachedIdentity = readCachedFacultyIdentity(DEFAULT_SCHOOL_ID);
					if (cachedIdentity && isLikelyOfflineError(facultyError)) {
						setFacultyId(cachedIdentity.facultyId);
						setSchoolYearNotice((current) => current ?? 'Working from your saved account while offline.');
						setError(null);
						return;
					}
					throw facultyError;
				}
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
		const cacheKey = buildFacultyCacheKey('preferences', DEFAULT_SCHOOL_ID, activeSchoolYearId, facultyId);
		const cachedSnapshot = readFacultySnapshot<FacultyPreferenceSnapshot>(cacheKey, {
			maxAgeMs: PREFERENCE_CACHE_MAX_AGE_MS,
			validate: (value): value is FacultyPreferenceSnapshot => {
				if (!value || typeof value !== 'object') return false;
				const candidate = value as Partial<FacultyPreferenceSnapshot>;
				return typeof candidate.version === 'number' && Array.isArray(candidate.slots) && typeof candidate.notes === 'string';
			},
		});
		try {
			const { data } = await atlasApi.get<{ preference: FacultyPreference | null }>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/faculty/${facultyId}`,
			);
			if (data.preference) {
				const pref = data.preference;
				const nextSnapshot: FacultyPreferenceSnapshot = {
					preference: pref,
					slots: pref.timeSlots.map((ts) => ({
						day: ts.day,
						startTime: ts.startTime,
						endTime: ts.endTime,
						preference: ts.preference,
					})),
					notes: pref.notes ?? '',
					version: pref.version,
					wellbeing: {
						pregnancySupport: pref.pregnancySupport,
						physicalAilmentSupport: pref.physicalAilmentSupport,
						minimizeTravelTime: pref.minimizeTravelTime,
						avoidUpperFloors: pref.avoidUpperFloors,
					},
					locked: false,
					lockedMsg: '',
				};
				applyPreferenceSnapshot(nextSnapshot);
				writeFacultySnapshot(cacheKey, nextSnapshot);
			} else {
				const emptySnapshot: FacultyPreferenceSnapshot = {
					preference: null,
					slots: [],
					notes: '',
					version: 1,
					wellbeing: DEFAULT_WELLBEING,
					locked: false,
					lockedMsg: '',
				};
				applyPreferenceSnapshot(emptySnapshot);
				writeFacultySnapshot(cacheKey, emptySnapshot);
			}
			setUsingCachedPreference(false);
			setCachedPreferenceAt(null);
			setError(null);
			setLocked(false);
		} catch (err) {
			if (cachedSnapshot && isLikelyOfflineError(err)) {
				applyPreferenceSnapshot(cachedSnapshot.data);
				setUsingCachedPreference(true);
				setCachedPreferenceAt(cachedSnapshot.cachedAt);
				setError(null);
				return;
			}
			setError('Failed to load your preferences.');
		} finally {
			setLoading(false);
		}
	}, [activeSchoolYearId, applyPreferenceSnapshot, facultyId]);

	useEffect(() => {
		if (activeSchoolYearId && facultyId) loadPreference();
	}, [activeSchoolYearId, facultyId, loadPreference]);

	/* ── Lifecycle events ── */
	useEffect(() => {
		const updateOnline = () => setOnline(navigator.onLine);
		const media = window.matchMedia('(max-width: 1023px)');
		const updateMedia = (e: MediaQueryListEvent) => setIsMobile(e.matches);

		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		media.addEventListener('change', updateMedia);

		return () => {
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
			media.removeEventListener('change', updateMedia);
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
					loadPreference();
				}
			} catch {
				// Ignore
			}
		});
		es.onerror = () => {
			setSseConnected(false);
			setSseError('Realtime updates are reconnecting.');
		};
		return () => {
			es.close();
			sseRef.current = null;
		};
	}, [activeSchoolYearId, facultyId, loadPreference]);

	/* ── Build payload ── */
	function buildPayload() {
		return {
			notes: notes.trim() || null,
			timeSlots: slots,
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
	
	const advisory = useMemo(() => {
		if (usingCachedPreference) {
			const savedAt = cachedPreferenceAt ? new Date(cachedPreferenceAt).toLocaleString() : null;
			return {
				title: 'Saved preferences view',
				message: savedAt
					? `Live preference data is unavailable. Showing your last saved data from ${savedAt}.`
					: 'Live preference data is unavailable. Showing your last saved data.',
				variant: 'warning' as const,
			};
		}

		if (locked) {
			return {
				title: 'Preferences locked',
				message: lockedMsg,
				variant: 'warning' as const
			};
		}
		if (isSubmitted) {
			return {
				title: 'Preferences submitted',
				message: `Last submission: ${preference?.submittedAt ? new Date(preference.submittedAt).toLocaleString() : 'N/A'}.`,
				variant: 'success' as const
			};
		}
		if (reviewUpdates > 0) {
			return {
				title: 'Review update',
				message: 'The scheduling officer has reviewed your latest submission. Review notes and update if needed.',
				variant: 'info' as const
			};
		}
		return undefined;
	}, [cachedPreferenceAt, isSubmitted, locked, lockedMsg, preference?.submittedAt, reviewUpdates, usingCachedPreference]);

	if (loading) {
		return (
			<div className='p-6 space-y-4 max-w-5xl mx-auto'>
				<Skeleton className='h-12 w-full rounded-2xl' />
				<Skeleton className='h-8 w-64' />
				<div className='grid gap-4 mt-6'>
					<Skeleton className='h-96 w-full rounded-3xl' />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-6 max-w-5xl mx-auto'>
				<Card className='rounded-3xl border-destructive/20'>
					<CardContent className='flex items-start gap-4 py-10'>
						<AlertCircle className='size-6 text-destructive shrink-0 mt-1' />
						<div className='flex-1'>
							<p className='text-lg font-bold text-destructive'>Preferences Unavailable</p>
							<p className='text-muted-foreground mt-1'>{error}</p>
							<Button variant='outline' className='mt-6 rounded-xl' onClick={() => void loadPreference()}>
								Retry Loading
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-[calc(100svh-3.5rem)] overflow-hidden bg-background'>
			<FacultyGlobalHeader
				title='My Preferences'
				subtitle='Set your preferred teaching hours and accessibility needs.'
				steps={[
					{ id: 1, label: '1 Set times' },
					{ id: 2, label: '2 Draft' },
					{ id: 3, label: '3 Submit' },
				]}
				activeStep={preferenceStep}
				online={online}
				syncState={usingCachedPreference ? 'failed' : online ? 'idle' : 'queued-offline'}
				realtimeConnected={sseConnected}
				advisory={advisory}
				onRetryFailed={usingCachedPreference ? () => void loadPreference() : undefined}
			>
				{schoolYearNotice && (
					<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-900 uppercase'>
						{schoolYearNotice}
					</div>
				)}
			</FacultyGlobalHeader>

			<div className='flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6 sm:py-8'>
				<div className='max-w-7xl mx-auto h-full'>
					{isMobile ? (
						<MobilePreferencesLayout
							slots={slots}
							onSlotsChange={setSlots}
							wellbeing={wellbeing}
							onWellbeingChange={(key, checked) => setWellbeing(prev => ({ ...prev, [key]: checked }))}
							notes={notes}
							onNotesChange={setNotes}
							canEdit={canEdit}
						/>
					) : (
						<DesktopPreferencesLayout
							slots={slots}
							onSlotsChange={setSlots}
							wellbeing={wellbeing}
							onWellbeingChange={(key, checked) => setWellbeing(prev => ({ ...prev, [key]: checked }))}
							notes={notes}
							onNotesChange={setNotes}
							canEdit={canEdit}
						/>
					)}
				</div>
			</div>

			{canEdit && (
				<div className='shrink-0 border-t border-border bg-background/95 backdrop-blur p-4 sm:p-6 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]'>
					<div className='max-w-7xl mx-auto flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3'>
						<div className='flex items-center gap-3'>
							<span className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>Status</span>
							<Badge variant={isSubmitted ? 'success' : 'warning'} className='rounded-full px-3 h-6 text-xs'>
								{isSubmitted ? 'Submitted' : 'Draft'}
							</Badge>
						</div>

						<div className='flex items-center gap-3'>
							<Button
								variant='outline'
								onClick={saveDraft}
								disabled={saving || submitting || !online}
								className='flex-1 sm:flex-none h-12 sm:h-10 rounded-xl font-bold gap-2'
							>
								{saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
								Save Draft
							</Button>
							<Button
								onClick={submitPreference}
								disabled={saving || submitting || !online}
								className='flex-1 sm:flex-none h-12 sm:h-10 rounded-xl font-bold gap-2 shadow-sm'
							>
								{submitting ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
								Submit Final
							</Button>
						</div>
					</div>
					{!online && (
						<p className='mt-3 text-xs font-medium text-amber-700'>
							Connect to the internet to save or submit preference changes.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
