/**
 * SchedulingPolicyPane
 *
 * Inline policy configuration panel rendered in the center pane of ScheduleReview.
 * Three columns, each with an independently scrollable body and a sticky header G��
 * so users can scroll one panel without disturbing the others.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Save, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type {
	ConstraintOverride,
	GradeShiftWindow,
	SchedulingPolicy,
	SectionSummaryResponse,
	ViolationCode,
} from '@/types';

import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Slider } from '@/ui/slider';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import {
	AddOverrideDialog,
	DEFAULT_PROGRAM_WINDOW_OPTIONS,
	ReconciliationDialog,
	clipWindowsToPolicyBounds,
	normalizeProgramForKey,
	sortShiftWindows,
	toMinutes,
	type EditIntent,
	type ProgramWindowOption,
	type ReconciliationDialogState,
} from '@/components/scheduling-policy/SchedulingPolicyDialogs';
import { ShiftSettingsEditor } from '@/components/scheduling-policy/ShiftSettingsEditor';
import {
	ConstraintRow,
	DEFAULT_CONSTRAINT_CONFIG,
	MetricExplain,
	PolicyNumberField,
	PolicySwitch,
	SectionCard,
	SOFT_CONSTRAINT_LABELS,
} from '@/components/scheduling-policy/PolicyPanePrimitives';
import { Badge } from '@/ui/badge';

/* G��G��G�� Types G��G��G�� */

interface LocalPolicy {
	teacherMoveEnabled: boolean;
	periodLengthMinutes: number;
	periodsPerDay: number;
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
	enableTravelWellbeingChecks: boolean;
	maxWalkingDistanceMetersPerTransition: number;
	maxBuildingTransitionsPerDay: number;
	maxBackToBackTransitionsWithoutBuffer: number;
	maxIdleGapMinutesPerDay: number;
	avoidEarlyFirstPeriod: boolean;
	avoidLateLastPeriod: boolean;
	enableVacantAwareConstraints: boolean;
	targetFacultyDailyVacantMinutes: number;
	targetSectionDailyVacantPeriods: number;
	maxCompressedTeachingMinutesPerDay: number;
	lunchStartTime: string;
	lunchEndTime: string;
	enforceLunchWindow: boolean;
	showSpecialEventsInGrid: boolean;
	enableFlagCeremony: boolean;
	flagCeremonyStartTime: string;
	flagCeremonyEndTime: string;
	enableRecess: boolean;
	recessStartTime: string;
	recessEndTime: string;
	enableLunchWindow: boolean;
	enableTleTwoPassPriority: boolean;
	allowFlexibleSubjectAssignment: boolean;
	allowConsecutiveLabSessions: boolean;
	constraintConfig: Record<string, ConstraintOverride>;
}

type LocalGradeWindow = {
	gradeLevel: number;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	startTime: string;
	endTime: string;
};

const GRADE_LEVELS: number[] = [7, 8, 9, 10];

const DEFAULT_GRADE_WINDOWS: LocalGradeWindow[] = [
	{ gradeLevel: 7, programType: null, startTime: '07:30', endTime: '17:00' },
	{ gradeLevel: 8, programType: null, startTime: '07:30', endTime: '17:00' },
	{ gradeLevel: 9, programType: null, startTime: '07:30', endTime: '17:00' },
	{ gradeLevel: 10, programType: null, startTime: '07:30', endTime: '17:00' },
];

function createInitialOverride(): LocalGradeWindow {
	return {
		gradeLevel: GRADE_LEVELS[0],
		programType: null,
		startTime: '07:30',
		endTime: '17:00',
	};
}

function getPresetWindowRange(mode: 'FULL_DAY' | 'HALF_DAY', gradeLevel: number): { startTime: string; endTime: string } {
	if (mode === 'HALF_DAY') {
		if (gradeLevel <= 8) {
			return { startTime: '06:00', endTime: '12:00' };
		}
		return { startTime: '12:00', endTime: '18:00' };
	}

	return { startTime: '07:30', endTime: '17:00' };
}

function toProgramOptionsFromSections(summary: SectionSummaryResponse | null): ProgramWindowOption[] {
	if (!summary) return DEFAULT_PROGRAM_WINDOW_OPTIONS;
	const sections = summary.sections ?? [];
	const availablePrograms = [...new Set(sections
		.map((section) => section.programType)
		.filter((programType): programType is NonNullable<typeof programType> => Boolean(programType)))];

	if (availablePrograms.length === 0) return DEFAULT_PROGRAM_WINDOW_OPTIONS;

	const labels: Record<string, string> = {
		REGULAR: 'Regular',
		STE: 'STE',
		SPS: 'SPS',
		SPA: 'SPA',
		SPJ: 'SPJ',
		SPFL: 'SPFL',
		SPTVE: 'SPTVE',
		OTHER: 'Other',
	};

	return [
		{ value: 'ALL', label: 'All Programs' },
		...availablePrograms
			.sort((left, right) => left.localeCompare(right))
			.map((programType) => ({ value: programType, label: labels[programType] ?? programType })) as ProgramWindowOption[],
	];
}

function buildProgramContextNote(summary: SectionSummaryResponse | null): string {
	if (!summary) {
		return 'Program-aware windows use EnrollPro program ownership. TLE specialization ownership is also upstream-managed and synchronized into ATLAS when available.';
	}
	const sections = summary.sections ?? [];
	const programs = [...new Set(sections
		.map((section) => section.programType)
		.filter((programType): programType is NonNullable<typeof programType> => Boolean(programType)))];
	const sectionsWithTleSpecialization = sections.filter((section) => Boolean(section.tleSpecialization && section.tleSpecialization.trim().length > 0));

	if (sectionsWithTleSpecialization.length > 0) {
		return `Program options are sourced from EnrollPro sections (${programs.join(', ') || 'REGULAR'}). ${sectionsWithTleSpecialization.length} section(s) currently include EnrollPro TLE specialization ownership.`;
	}

	return `Program options are sourced from EnrollPro sections (${programs.join(', ') || 'REGULAR'}). No section-level TLE specialization ownership is currently present in this school-year feed.`;
}

function toLocalGradeWindows(windows: GradeShiftWindow[]): LocalGradeWindow[] {
	const byKey = new Map<string, LocalGradeWindow>(DEFAULT_GRADE_WINDOWS.map((window) => [`${window.gradeLevel}:ALL`, window]));
	for (const window of windows) {
		if (!GRADE_LEVELS.includes(window.gradeLevel)) continue;
		const key = `${window.gradeLevel}:${window.programType ?? 'ALL'}`;
		byKey.set(key, {
			gradeLevel: window.gradeLevel,
			programType: (window.programType ?? null) as LocalGradeWindow['programType'],
			startTime: window.startTime,
			endTime: window.endTime,
		});
	}
	return [...byKey.values()].sort((left, right) => left.gradeLevel - right.gradeLevel || String(left.programType ?? 'ALL').localeCompare(String(right.programType ?? 'ALL')));
}

function policyToLocal(p: SchedulingPolicy): LocalPolicy {
	return {
		teacherMoveEnabled: p.teacherMoveEnabled ?? true,
		periodLengthMinutes: p.periodLengthMinutes ?? 45,
		periodsPerDay: p.periodsPerDay ?? 10,
		maxConsecutiveTeachingMinutesBeforeBreak: p.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: p.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: p.maxTeachingMinutesPerDay,
		earliestStartTime: p.earliestStartTime,
		latestEndTime: p.latestEndTime,
		enforceConsecutiveBreakAsHard: p.enforceConsecutiveBreakAsHard,
		enableTravelWellbeingChecks: p.enableTravelWellbeingChecks,
		maxWalkingDistanceMetersPerTransition: p.maxWalkingDistanceMetersPerTransition,
		maxBuildingTransitionsPerDay: p.maxBuildingTransitionsPerDay,
		maxBackToBackTransitionsWithoutBuffer: p.maxBackToBackTransitionsWithoutBuffer,
		maxIdleGapMinutesPerDay: p.maxIdleGapMinutesPerDay,
		avoidEarlyFirstPeriod: p.avoidEarlyFirstPeriod,
		avoidLateLastPeriod: p.avoidLateLastPeriod,
		enableVacantAwareConstraints: p.enableVacantAwareConstraints,
		targetFacultyDailyVacantMinutes: p.targetFacultyDailyVacantMinutes,
		targetSectionDailyVacantPeriods: p.targetSectionDailyVacantPeriods,
		maxCompressedTeachingMinutesPerDay: p.maxCompressedTeachingMinutesPerDay,
		lunchStartTime: p.lunchStartTime,
		lunchEndTime: p.lunchEndTime,
		enforceLunchWindow: p.enforceLunchWindow,
		showSpecialEventsInGrid: p.showSpecialEventsInGrid ?? true,
		enableFlagCeremony: p.enableFlagCeremony ?? true,
		flagCeremonyStartTime: p.flagCeremonyStartTime ?? '07:00',
		flagCeremonyEndTime: p.flagCeremonyEndTime ?? '07:30',
		enableRecess: p.enableRecess ?? true,
		recessStartTime: p.recessStartTime ?? '09:45',
		recessEndTime: p.recessEndTime ?? '10:00',
		enableLunchWindow: p.enableLunchWindow ?? p.enforceLunchWindow,
		enableTleTwoPassPriority: p.enableTleTwoPassPriority ?? true,
		allowFlexibleSubjectAssignment: p.allowFlexibleSubjectAssignment ?? false,
		allowConsecutiveLabSessions: p.allowConsecutiveLabSessions ?? false,
		constraintConfig: { ...DEFAULT_CONSTRAINT_CONFIG, ...(p.constraintConfig ?? {}) },
	};
}

function deepEqual(a: unknown, b: unknown) {
	return JSON.stringify(a) === JSON.stringify(b);
}

/* G��G��G�� Micro-components G��G��G�� */

/* G��G��G�� Main export G��G��G�� */

export default function SchedulingPolicyPane({
	schoolId,
	schoolYearId,
	onBack,
	onPolicySaved,
}: {
	schoolId: number;
	schoolYearId: number | null;
	onBack: () => void;
	onPolicySaved?: () => void;
}) {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [policyStatus, setPolicyStatus] = useState<'loading' | 'loaded' | 'saved' | 'unavailable'>('loading');
	const [activeTab, setActiveTab] = useState<'policy' | 'shift-settings'>('policy');
	const [persisted, setPersisted] = useState<LocalPolicy | null>(null);
	const [local, setLocal] = useState<LocalPolicy | null>(null);
	const [persistedShiftWindows, setPersistedShiftWindows] = useState<LocalGradeWindow[]>(DEFAULT_GRADE_WINDOWS);
	const [shiftWindows, setShiftWindows] = useState<LocalGradeWindow[]>(DEFAULT_GRADE_WINDOWS);
	const [programOptions, setProgramOptions] = useState<ProgramWindowOption[]>(DEFAULT_PROGRAM_WINDOW_OPTIONS);
	const [programContextNote, setProgramContextNote] = useState<string>(
		'Program-aware windows use EnrollPro program ownership. TLE specialization ownership is also upstream-managed and synchronized into ATLAS when available.',
	);
	const [editIntent, setEditIntent] = useState<EditIntent>(null);
	const [showAddOverrideDialog, setShowAddOverrideDialog] = useState(false);
	const [newOverride, setNewOverride] = useState<LocalGradeWindow>(createInitialOverride());
	const [reconciliationDialog, setReconciliationDialog] = useState<ReconciliationDialogState | null>(null);

	const markIntent = useCallback((intent: Exclude<EditIntent, null>) => {
		setEditIntent((previous) => previous ?? intent);
	}, []);

	const isDirty = useMemo(() => {
		if (!persisted || !local) return false;
		return !deepEqual(persisted, local) || !deepEqual(persistedShiftWindows, shiftWindows);
	}, [persisted, local, persistedShiftWindows, shiftWindows]);

	const fetchPolicy = useCallback(async () => {
		if (!schoolYearId) return;
		setLoading(true);
		setPolicyStatus('loading');
		try {
			const policyRes = await atlasApi.get<{ policy: SchedulingPolicy }>(`/policies/scheduling/${schoolId}/${schoolYearId}`, { timeout: 8_000 });
			const [windowsRes, summaryRes] = await Promise.all([
				atlasApi
					.get<{ windows: GradeShiftWindow[] }>(`/generation/${schoolId}/${schoolYearId}/grade-windows`, { timeout: 8_000 })
					.catch(() => null),
				atlasApi
					.get<SectionSummaryResponse>(`/sections/summary/${schoolYearId}?schoolId=${schoolId}`, { timeout: 8_000 })
					.catch(() => null),
			]);
			const lp = policyToLocal(policyRes.data.policy);
			const localWindows = toLocalGradeWindows(windowsRes?.data.windows ?? []);
			const summary = summaryRes?.data ?? null;
			setPersisted(lp);
			setLocal(lp);
			setPersistedShiftWindows(localWindows);
			setShiftWindows(localWindows);
			setProgramOptions(toProgramOptionsFromSections(summary));
			setProgramContextNote(buildProgramContextNote(summary));
			setEditIntent(null);
			setReconciliationDialog(null);
			setPolicyStatus('loaded');
		} catch {
			setPolicyStatus('unavailable');
			toast.error('Failed to load scheduling policy and shift settings.');
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => {
		void fetchPolicy();
	}, [fetchPolicy]);

	const persistPolicyAndShiftWindows = useCallback(async (policyDraft: LocalPolicy, windowsDraft: LocalGradeWindow[]) => {
		if (!schoolYearId) return;
		const payload = {
			...policyDraft,
			enableLunchWindow: policyDraft.enableLunchWindow,
			enforceLunchWindow: policyDraft.enableLunchWindow,
		};
		const [policyRes] = await Promise.all([
			atlasApi.put<{ policy: SchedulingPolicy }>(`/policies/scheduling/${schoolId}/${schoolYearId}`, payload),
			atlasApi.put<{ windows: GradeShiftWindow[] }>(`/generation/${schoolId}/${schoolYearId}/grade-windows`, {
				windows: windowsDraft,
			}),
		]);

		const lp = policyToLocal(policyRes.data.policy);
		const sortedWindows = sortShiftWindows(windowsDraft);
		setPersisted(lp);
		setLocal(lp);
		setPersistedShiftWindows(sortedWindows);
		setShiftWindows(sortedWindows);
		setEditIntent(null);
		setReconciliationDialog(null);
		setShowAddOverrideDialog(false);
		setNewOverride(createInitialOverride());
		setPolicyStatus('saved');
		toast.success('Scheduling policy and shift settings saved.');
		onPolicySaved?.();
	}, [schoolId, schoolYearId, onPolicySaved]);

	const savePolicy = useCallback(async () => {
		if (!schoolYearId || !local) return;
		setSaving(true);
		try {
			const duplicateWindowKeys = new Set<string>();
			for (const window of shiftWindows) {
				if (!window.startTime || !window.endTime) {
					toast.error(`Grade ${window.gradeLevel} (${window.programType ?? 'All Programs'}) requires both start and end times.`);
					setSaving(false);
					return;
				}
				if (window.startTime >= window.endTime) {
					toast.error(`Grade ${window.gradeLevel} (${window.programType ?? 'All Programs'}) start time must be earlier than end time.`);
					setSaving(false);
					return;
				}

				const key = `${window.gradeLevel}:${normalizeProgramForKey(window.programType)}`;
				if (duplicateWindowKeys.has(key)) {
					toast.error(`Duplicate override for Grade ${window.gradeLevel} (${window.programType ?? 'All Programs'}). Keep one row per grade/program.`);
					setSaving(false);
					return;
				}
				duplicateWindowKeys.add(key);
			}

			const policyStart = local.earliestStartTime;
			const policyEnd = local.latestEndTime;
			const conflictingWindows = shiftWindows.filter((window) => {
				const windowStart = toMinutes(window.startTime);
				const windowEnd = toMinutes(window.endTime);
				return windowStart < toMinutes(policyStart) || windowEnd > toMinutes(policyEnd);
			});

			if (conflictingWindows.length > 0) {
				const affectedLabels = conflictingWindows.map(
					(window) => `Grade ${window.gradeLevel} (${window.programType ?? 'All Programs'}) ${window.startTime}-${window.endTime}`,
				);

				if (editIntent === 'window') {
					const expandedPolicy: LocalPolicy = {
						...local,
						earliestStartTime: conflictingWindows.reduce(
							(min, window) => (window.startTime < min ? window.startTime : min),
							local.earliestStartTime,
						),
						latestEndTime: conflictingWindows.reduce(
							(max, window) => (window.endTime > max ? window.endTime : max),
							local.latestEndTime,
						),
					};

					const clipped = clipWindowsToPolicyBounds(shiftWindows, policyStart, policyEnd);
					setReconciliationDialog({
						title: 'Window-First Reconciliation Needed',
						description: 'You edited shift windows first. Choose how policy bounds should reconcile before saving.',
						details: [
							'Changed windows outside current policy bounds:',
							...affectedLabels,
							`Current policy: ${policyStart}-${policyEnd}`,
							`If expanded: ${expandedPolicy.earliestStartTime}-${expandedPolicy.latestEndTime}`,
						],
						primaryLabel: 'Expand Policy To Fit Windows',
						onPrimary: () => {
							setReconciliationDialog(null);
							setSaving(true);
							void persistPolicyAndShiftWindows(expandedPolicy, sortShiftWindows(shiftWindows))
								.catch((error: unknown) => {
									const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
									toast.error(apiMessage || 'Failed to save policy or shift settings. Your changes are preserved.');
								})
								.finally(() => setSaving(false));
						},
						secondaryLabel: 'Keep Policy And Clip Windows',
						onSecondary: () => {
							setReconciliationDialog(null);
							setSaving(true);
							void persistPolicyAndShiftWindows(local, clipped.windows)
								.catch((error: unknown) => {
									const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
									toast.error(apiMessage || 'Failed to save policy or shift settings. Your changes are preserved.');
								})
								.finally(() => setSaving(false));
						},
					});
					setSaving(false);
					return;
				}

				const clipped = clipWindowsToPolicyBounds(shiftWindows, policyStart, policyEnd);
				const clipNotes = clipped.clipped.map(({ before, after }) =>
					`Clip Grade ${before.gradeLevel} (${before.programType ?? 'All Programs'}) ${before.startTime}-${before.endTime} -> ${after.startTime}-${after.endTime}`,
				);
				const removeNotes = clipped.removed.map(
					(window) => `Remove invalidated window: Grade ${window.gradeLevel} (${window.programType ?? 'All Programs'}) ${window.startTime}-${window.endTime}`,
				);

				setReconciliationDialog({
					title: 'Policy-First Reconciliation Needed',
					description: 'You edited policy bounds first. Saving now will reconcile windows to stay inside the new policy.',
					details: [`Policy bounds now: ${policyStart}-${policyEnd}`, ...clipNotes, ...removeNotes],
					primaryLabel: 'Reconcile And Save',
					onPrimary: () => {
						setReconciliationDialog(null);
						setSaving(true);
						void persistPolicyAndShiftWindows(local, clipped.windows)
							.catch((error: unknown) => {
								const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
								toast.error(apiMessage || 'Failed to save policy or shift settings. Your changes are preserved.');
							})
							.finally(() => setSaving(false));
					},
				});
				setSaving(false);
				return;
			}

			await persistPolicyAndShiftWindows(local, sortShiftWindows(shiftWindows));
		} catch (error: unknown) {
			const apiMessage =
				(error as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(apiMessage || 'Failed to save policy or shift settings. Your changes are preserved.');
		} finally {
			setSaving(false);
		}
	}, [schoolYearId, local, shiftWindows, editIntent, persistPolicyAndShiftWindows]);

	const update = useCallback(<K extends keyof LocalPolicy>(key: K, value: LocalPolicy[K]) => {
		markIntent('policy');
		setLocal((prev) => (prev ? { ...prev, [key]: value } : prev));
	}, [markIntent]);

	const updateConstraint = useCallback((code: string, field: keyof ConstraintOverride, value: unknown) => {
		markIntent('policy');
		setLocal((prev) => {
			if (!prev) return prev;
			const config = { ...prev.constraintConfig };
			config[code] = { ...config[code], [field]: value };
			return { ...prev, constraintConfig: config };
		});
	}, [markIntent]);

	const updateShiftWindow = useCallback(
		(index: number, field: 'gradeLevel' | 'programType' | 'startTime' | 'endTime', value: string | number | null) => {
			markIntent('window');
			setShiftWindows((prev) =>
				sortShiftWindows(prev.map((window, windowIndex) => (windowIndex === index ? { ...window, [field]: value } : window))),
			);
		},
		[markIntent],
	);

	const removeShiftWindow = useCallback((index: number) => {
		markIntent('window');
		setShiftWindows((prev) => prev.filter((_, i) => i !== index));
	}, [markIntent]);

	const addShiftWindow = useCallback(() => {
		setShowAddOverrideDialog(true);
	}, []);

	const applyShiftPreset = useCallback((mode: 'FULL_DAY' | 'HALF_DAY') => {
		markIntent('window');
		setShiftWindows((previous) =>
			sortShiftWindows(
				previous.map((window) => {
					const range = getPresetWindowRange(mode, window.gradeLevel);
					return {
						...window,
						startTime: range.startTime,
						endTime: range.endTime,
					};
				}),
			),
		);

		setLocal((previous) => {
			if (!previous) return previous;
			if (mode === 'HALF_DAY') {
				return {
					...previous,
					earliestStartTime: '06:00',
					latestEndTime: '18:00',
					lunchStartTime: '11:30',
					lunchEndTime: '12:30',
				};
			}

			return {
				...previous,
				earliestStartTime: '07:30',
				latestEndTime: '17:00',
				lunchStartTime: '11:30',
				lunchEndTime: '13:00',
			};
		});
	}, [markIntent]);

	const confirmAddShiftWindow = useCallback(() => {
		if (newOverride.startTime >= newOverride.endTime) {
			toast.error('Override start time must be earlier than end time.');
			return;
		}

		const key = `${newOverride.gradeLevel}:${normalizeProgramForKey(newOverride.programType)}`;
		if (shiftWindows.some((window) => `${window.gradeLevel}:${normalizeProgramForKey(window.programType)}` === key)) {
			toast.error(`An override for Grade ${newOverride.gradeLevel} (${newOverride.programType ?? 'All Programs'}) already exists.`);
			return;
		}

		markIntent('window');
		setShiftWindows((prev) => sortShiftWindows([...prev, newOverride]));
		setShowAddOverrideDialog(false);
		setNewOverride(createInitialOverride());
	}, [newOverride, shiftWindows, markIntent]);

	return (
		<div className="flex flex-col min-h-0 h-full bg-muted/30">
			<AddOverrideDialog
				open={showAddOverrideDialog}
				onOpenChange={setShowAddOverrideDialog}
				newOverride={newOverride}
				onChange={setNewOverride}
				onConfirm={confirmAddShiftWindow}
				gradeLevels={GRADE_LEVELS}
				programOptions={programOptions}
			/>
			<ReconciliationDialog state={reconciliationDialog} onClose={() => setReconciliationDialog(null)} />

			{/* G��G�� Toolbar (non-scrolling) G��G�� */}
			<div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground" onClick={onBack}>
								<ArrowLeft className="size-3.5" />
								Back to Timetable
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">Return to the timetable grid view</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<div className="flex items-center gap-1 text-muted-foreground">
					<ChevronRight className="size-3" />
				</div>
				<div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
					<Shield className="size-3.5 text-primary" />
					<span className="truncate">Scheduling Settings</span>
				</div>

				<Badge
					variant="outline"
					className={`shrink-0 text-xs ${
						policyStatus === 'unavailable'
							? 'border-amber-200 bg-amber-50 text-amber-800'
							: policyStatus === 'saved'
								? 'border-emerald-200 bg-emerald-50 text-emerald-800'
								: 'border-sky-200 bg-sky-50 text-sky-800'
					}`}
					data-testid="policy-status-chip"
				>
					{policyStatus === 'loading'
						? 'Policy loading'
						: policyStatus === 'saved'
							? 'Policy saved'
							: policyStatus === 'unavailable'
								? 'Policy unavailable — using defaults'
								: 'Policy loaded'}
				</Badge>

				<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'policy' | 'shift-settings')}>
					<TabsList className="h-7">
						<TabsTrigger value="policy" className="text-xs">Policy</TabsTrigger>
						<TabsTrigger value="shift-settings" className="text-xs">Shift Settings</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="flex-1" />

				{isDirty && (
					<span className="flex items-center gap-1 text-xs text-amber-600">
						<AlertTriangle className="size-3" />
						Unsaved changes
					</span>
				)}
				<Button
					variant="default"
					size="sm"
					disabled={!isDirty || saving}
					onClick={savePolicy}
					className="h-7 gap-1.5"
				>
					<Save className="size-3.5" />
					{saving ? 'SavingGǪ' : 'Save Policy'}
				</Button>
			</div>

			{/* G��G�� Content G��G�� */}
			{loading ? (
				<div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
					Loading policyGǪ
				</div>
			) : !local ? (
				<div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
					No policy data available.
				</div>
			) : (
				/* Outer container does NOT scroll G�� each column card scrolls independently */
				activeTab === 'policy' ? (
					<div className="flex-1 min-h-0 overflow-hidden p-4 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">

					<div className="col-span-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900" data-testid="policy-impact-summary">
						<p className="font-semibold">Policy impact</p>
						<p className="mt-0.5 leading-relaxed">
							Affects next generation after you save and generate again. Preview, placement, and swap checks use the current saved policy immediately.
						</p>
					</div>

					{/* COL 0: Scheduling Mode */}
					<SectionCard title="Scheduling Mode">
						<div className="space-y-3">
							<div className="grid grid-cols-2 gap-3">
								<PolicyNumberField
									label="Block Length (min)"
									explanation="Length of one generated timetable block. This controls session normalization and the visible timetable slot grid."
									value={local.periodLengthMinutes}
									onChange={(v) => update('periodLengthMinutes', v)}
									min={30}
									max={90}
								/>
								<PolicyNumberField
									label="Periods Per Day"
									explanation="Maximum schedulable blocks in one day before protected breaks and special events are applied."
									value={local.periodsPerDay}
									onChange={(v) => update('periodsPerDay', v)}
									min={4}
									max={12}
								/>
							</div>
							<div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
								<div className="space-y-0.5">
									<Label className="font-medium text-xs text-foreground">Teacher's Move</Label>
									<p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
										{local.teacherMoveEnabled
											? 'Teachers can move between buildings for classes.'
											: 'Teachers stay within their assigned building context.'}
									</p>
								</div>
								<Switch
									checked={local.teacherMoveEnabled}
									onCheckedChange={(checked) => update('teacherMoveEnabled', checked)}
								/>
							</div>
							<div className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-[0.6875rem] text-sky-700 leading-relaxed">
								Full-day fidelity uses 45-minute blocks with protected lunch, recess, and special-event windows. Shift-window overrides are in the Shift Settings tab.
							</div>
						</div>
					</SectionCard>

					{/* COL 1: Core Teaching Limits */}
					<SectionCard title="Core Teaching Limits">
						<PolicyNumberField
							label="Max Consecutive Teaching (min)"
							explanation="Maximum minutes a teacher can teach without a break. Controls the Consecutive Limit check."
							value={local.maxConsecutiveTeachingMinutesBeforeBreak}
							onChange={(v) => update('maxConsecutiveTeachingMinutesBeforeBreak', v)}
							min={30}
							max={600}
						/>
						<PolicyNumberField
							label="Min Break After Block (min)"
							explanation="Minimum break minutes required after a consecutive teaching block before the next class."
							value={local.minBreakMinutesAfterConsecutiveBlock}
							onChange={(v) => update('minBreakMinutesAfterConsecutiveBlock', v)}
							min={5}
							max={120}
						/>
						<PolicyNumberField
							label="Max Teaching Per Day (min)"
							explanation="Daily ceiling on total teaching minutes per teacher. Exceeding this is always a HARD violation."
							value={local.maxTeachingMinutesPerDay}
							onChange={(v) => update('maxTeachingMinutesPerDay', v)}
							min={60}
							max={600}
						/>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<MetricExplain
									label="Earliest Start Time"
									explanation="The earliest timeslot any class may be scheduled."
								/>
								<Input
									type="time"
									className="h-8 text-xs"
									value={local.earliestStartTime}
									onChange={(e) => update('earliestStartTime', e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<MetricExplain
									label="Latest End Time"
									explanation="The latest time any class may end."
								/>
								<Input
									type="time"
									className="h-8 text-xs"
									value={local.latestEndTime}
									onChange={(e) => update('latestEndTime', e.target.value)}
								/>
							</div>
						</div>
						<PolicySwitch
							label="Enforce Consecutive Break as Hard"
							explanation="When ON, consecutive teaching limit and break violations become HARD constraints that block publish."
							checked={local.enforceConsecutiveBreakAsHard}
							onCheckedChange={(v) => update('enforceConsecutiveBreakAsHard', v)}
							warning
						/>
						{local.enforceConsecutiveBreakAsHard && (
							<div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[0.6875rem] text-amber-700">
								<AlertTriangle className="size-3 mt-0.5 shrink-0" />
								This will block schedule publishing if any faculty exceeds the break limit.
							</div>
						)}

						{/* G��G�� Lunch Window G��G�� */}
						<div className="pt-2 mt-2 border-t border-border/60 space-y-3">
							<PolicySwitch
								label="Show Special Events in Grid"
								explanation="When ON, the editable timetable grid shows dedicated rows for flag ceremony, recess, and lunch. These rows are non-schedulable."
								checked={local.showSpecialEventsInGrid}
								onCheckedChange={(v) => update('showSpecialEventsInGrid', v)}
							/>
							<PolicySwitch
								label="Enable Flag Ceremony"
								explanation="Adds a global non-schedulable flag ceremony interval to the timetable policy."
								checked={local.enableFlagCeremony}
								onCheckedChange={(v) => update('enableFlagCeremony', v)}
							/>
							{local.enableFlagCeremony && (
								<div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
									<div className="space-y-1.5">
										<MetricExplain label="Flag Start" explanation="Start time for flag ceremony row." />
										<Input type="time" className="h-8 text-xs" value={local.flagCeremonyStartTime} onChange={(e) => update('flagCeremonyStartTime', e.target.value)} />
									</div>
									<div className="space-y-1.5">
										<MetricExplain label="Flag End" explanation="End time for flag ceremony row." />
										<Input type="time" className="h-8 text-xs" value={local.flagCeremonyEndTime} onChange={(e) => update('flagCeremonyEndTime', e.target.value)} />
									</div>
								</div>
							)}
							<PolicySwitch
								label="Enable Recess"
								explanation="Adds a global non-schedulable recess interval to the timetable policy."
								checked={local.enableRecess}
								onCheckedChange={(v) => update('enableRecess', v)}
							/>
							{local.enableRecess && (
								<div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
									<div className="space-y-1.5">
										<MetricExplain label="Recess Start" explanation="Start time for recess row." />
										<Input type="time" className="h-8 text-xs" value={local.recessStartTime} onChange={(e) => update('recessStartTime', e.target.value)} />
									</div>
									<div className="space-y-1.5">
										<MetricExplain label="Recess End" explanation="End time for recess row." />
										<Input type="time" className="h-8 text-xs" value={local.recessEndTime} onChange={(e) => update('recessEndTime', e.target.value)} />
									</div>
								</div>
							)}
							<PolicySwitch
								label="Enforce Lunch Window"
								explanation="When ON, no classes can be scheduled during the lunch window. Time slots overlapping the window are excluded from the timetable grid."
								checked={local.enableLunchWindow}
								onCheckedChange={(v) => {
									update('enableLunchWindow', v);
									update('enforceLunchWindow', v);
								}}
							/>
							{local.enableLunchWindow && (
								<div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
									<div className="space-y-1.5">
										<MetricExplain
											label="Lunch Start"
											explanation="Start of the lunch window G�� no classes will overlap this range."
										/>
										<Input
											type="time"
											className="h-8 text-xs"
											value={local.lunchStartTime}
											onChange={(e) => update('lunchStartTime', e.target.value)}
										/>
									</div>
									<div className="space-y-1.5">
										<MetricExplain
											label="Lunch End"
											explanation="End of the lunch window G�� classes resume after this time."
										/>
										<Input
											type="time"
											className="h-8 text-xs"
											value={local.lunchEndTime}
											onChange={(e) => update('lunchEndTime', e.target.value)}
										/>
									</div>
								</div>
							)}
						</div>

						{/* G��G�� TLE Two-Pass Priority G��G�� */}
						<div className="pt-2 mt-2 border-t border-border/60 space-y-3">
							<PolicySwitch
								label="TLE Two-Pass Priority"
								explanation="When ON, schedule TLE (Technology and Livelihood Education) subjects first (Bucket A), then schedule all other subjects (Bucket B). This ensures TLE workshop resources are optimally allocated before other classes."
								checked={local.enableTleTwoPassPriority}
								onCheckedChange={(v) => update('enableTleTwoPassPriority', v)}
							/>
							{local.enableTleTwoPassPriority && (
								<div className="flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[0.6875rem] text-blue-700">
									TLE subjects will be scheduled before all other subjects to maximize workshop availability.
								</div>
							)}
						</div>

						{/* G��G�� Flexible Subject Assignment G��G�� */}
						<div className="pt-2 mt-2 border-t border-border/60 space-y-3">
							<PolicySwitch
								label="Allow Flexible Subject Assignment"
									explanation="When ON, teachers may be assigned to teach ANY subject during generation, regardless of their registered subject specializations. Use this when teacher availability is limited or for emergency coverage scenarios."
								checked={local.allowFlexibleSubjectAssignment}
								onCheckedChange={(v) => update('allowFlexibleSubjectAssignment', v)}
							/>
							{local.allowFlexibleSubjectAssignment && (
								<div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[0.6875rem] text-amber-700">
									<span className="font-medium">G��n+� Warning:</span> Teachers may be assigned to subjects outside their specialization. Review assignments carefully before publishing.
								</div>
							)}
						</div>

						{/* G��G�� Consecutive Lab Sessions G��G�� */}
						<div className="pt-2 mt-2 border-t border-border/60 space-y-3">
							<PolicySwitch
								label="Allow Consecutive Lab Sessions"
								explanation="When ON, lab/workshop subjects (Science, TLE, Computer Lab) can be scheduled in back-to-back periods for the same section. When OFF, the generator prevents adjacent lab periods."
								checked={local.allowConsecutiveLabSessions}
								onCheckedChange={(v) => update('allowConsecutiveLabSessions', v)}
							/>
							{local.allowConsecutiveLabSessions && (
								<div className="flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[0.6875rem] text-blue-700">
									Lab/workshop subjects may be placed in consecutive periods. This can be useful for double-period lab activities.
								</div>
							)}
						</div>

						<PolicySwitch
							label="Travel & Wellbeing Checks"
							explanation="Master toggle for all travel distance, building transition, idle gap, and preference soft constraints."
							checked={local.enableTravelWellbeingChecks}
							onCheckedChange={(v) => update('enableTravelWellbeingChecks', v)}
						/>

						{local.enableTravelWellbeingChecks ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="space-y-3 pl-2 border-l-2 border-primary/20"
							>
								<PolicyNumberField
									label="Max Walking Distance/Transition (m)"
									explanation="Maximum Euclidean distance (meters) between buildings per single transition before a soft violation fires."
									value={local.maxWalkingDistanceMetersPerTransition}
									onChange={(v) => update('maxWalkingDistanceMetersPerTransition', v)}
									min={10}
									max={1000}
								/>
								<PolicyNumberField
									label="Max Building Transitions/Day"
									explanation="Maximum number of cross-building moves per teacher per day."
									value={local.maxBuildingTransitionsPerDay}
									onChange={(v) => update('maxBuildingTransitionsPerDay', v)}
									min={1}
									max={20}
								/>
								<PolicyNumberField
									label="Max Back-to-Back Without Buffer"
									explanation="Maximum consecutive cross-building transitions with G��5 min gap between classes."
									value={local.maxBackToBackTransitionsWithoutBuffer}
									onChange={(v) => update('maxBackToBackTransitionsWithoutBuffer', v)}
									min={1}
									max={10}
								/>
								<PolicyNumberField
									label="Max Idle Gap/Day (min)"
									explanation="Maximum total idle minutes between a faculty member's first and last class in a single day."
									value={local.maxIdleGapMinutesPerDay}
									onChange={(v) => update('maxIdleGapMinutesPerDay', v)}
									min={10}
									max={300}
								/>
								<PolicySwitch
									label="Avoid Early First Period"
									explanation="Generates a soft violation when teachers are scheduled in the first period (within 15 min of earliest start)."
									checked={local.avoidEarlyFirstPeriod}
									onCheckedChange={(v) => update('avoidEarlyFirstPeriod', v)}
								/>
								<PolicySwitch
									label="Avoid Late Last Period"
									explanation="Generates a soft violation when teachers are scheduled in the last period (within 15 min of latest end)."
									checked={local.avoidLateLastPeriod}
									onCheckedChange={(v) => update('avoidLateLastPeriod', v)}
								/>
							</motion.div>
						) : (
							<p className="text-[0.6875rem] text-muted-foreground/60 italic">
								Enable travel checks to configure thresholds.
							</p>
						)}
					</SectionCard>

					{/* COL 2: Per-Constraint Weights */}
					<SectionCard title="Per-Constraint Weights">
						<p className="text-[0.6875rem] text-muted-foreground">
							Toggle, weight (1–10), and optionally promote soft constraints to hard.
						</p>
						<div className="space-y-2">
							{Object.entries(SOFT_CONSTRAINT_LABELS).map(([code, info]) => {
								const cfg = local.constraintConfig[code] ?? DEFAULT_CONSTRAINT_CONFIG[code];
								return (
									<ConstraintRow
										key={code}
										code={code as ViolationCode}
										label={info.label}
										explanation={info.explanation}
										config={cfg}
										onToggleEnabled={(v) => updateConstraint(code, 'enabled', v)}
										onWeightChange={(v) => updateConstraint(code, 'weight', v)}
										onToggleTreatAsHard={(v) => updateConstraint(code, 'treatAsHard', v)}
									/>
								);
							})}
						</div>
					</SectionCard>

					</div>
				) : (
					<ShiftSettingsEditor
						shiftWindows={shiftWindows}
						onAddOverride={addShiftWindow}
						onApplyFullDayPreset={() => applyShiftPreset('FULL_DAY')}
						onApplyHalfDayPreset={() => applyShiftPreset('HALF_DAY')}
						onRemove={removeShiftWindow}
						onUpdate={updateShiftWindow}
						gradeLevels={GRADE_LEVELS}
						programOptions={programOptions}
						programContextNote={programContextNote}
					/>
				)
			)}
		</div>
	);
}
