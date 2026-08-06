import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
	applyRolloverSync,
	fetchRolloverStatus,
	previewRolloverSync,
	resetDummyRolloverYear,
	type RolloverDummyYearResetResult,
	type RolloverStatus,
} from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { cn } from '@/lib/utils';

type RolloverGuidanceCardProps = {
	schoolId?: number;
	compact?: boolean;
	onApplied?: (status: RolloverStatus) => void;
	onStatus?: (status: RolloverStatus) => void;
};

const DRIFT_BADGE: Record<string, string> = {
	aligned: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	'atlas-stale': 'border-amber-200 bg-amber-50 text-amber-700',
	'enrollpro-unreachable': 'border-slate-200 bg-slate-50 text-slate-700',
	'mapping-conflict': 'border-red-200 bg-red-50 text-red-700',
};

function driftLabel(status: string): string {
	switch (status) {
		case 'aligned': return 'Year aligned';
		case 'atlas-stale': return 'New school year ready';
		case 'mapping-conflict': return 'Migration needed';
		case 'enrollpro-unreachable': return 'Source not verified';
		default: return 'School year check';
	}
}

function resetCountRows(result: RolloverDummyYearResetResult | null): Array<{ label: string; value: number }> {
	const counts = result?.reset.counts;
	if (!counts) return [];
	return [
		{ label: 'Sections', value: counts.sectionMirrors },
		{ label: 'Generation runs', value: counts.generationRuns },
		{ label: 'Follow-up flags', value: counts.followUpFlags },
		{ label: 'Teaching Load owners', value: counts.teachingLoadOwnerships },
		{ label: 'Teacher load rows', value: counts.teachingLoadFacultySubjects },
		{ label: 'Policies', value: counts.schedulingPolicies },
		{ label: 'Draft locks', value: counts.lockedSessions },
		{ label: 'Cohorts', value: counts.instructionalCohorts },
		{ label: 'Old audit rows', value: counts.auditLogs },
	].filter((row) => row.value > 0);
}

export function RolloverGuidanceCard({ schoolId = 1, compact = false, onApplied, onStatus }: RolloverGuidanceCardProps) {
	const [status, setStatus] = useState<RolloverStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [previewing, setPreviewing] = useState(false);
	const [applying, setApplying] = useState(false);
	const [resetOpen, setResetOpen] = useState(false);
	const [resetting, setResetting] = useState(false);
	const [resetPreview, setResetPreview] = useState<RolloverDummyYearResetResult | null>(null);
	const [confirmationText, setConfirmationText] = useState('');
	const [error, setError] = useState<string | null>(null);

	const loadStatus = async (includeCounts = false) => {
		setLoading(true);
		setError(null);
		try {
			const next = await fetchRolloverStatus(schoolId, includeCounts);
			setStatus(next);
			onStatus?.(next);
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? 'ATLAS could not check the EnrollPro school year.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadStatus(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [schoolId]);

	const canApply = status?.drift.recommendedAction === 'RUN_ROLLOVER_SYNC' && status.conflicts.length === 0;
	const canPreviewReset = status?.drift.status === 'mapping-conflict' || status?.canResetDummyYear;
	const isBlocking = status?.drift.status === 'atlas-stale' || status?.drift.status === 'mapping-conflict';
	const icon = useMemo(() => {
		if (status?.drift.status === 'aligned') return <CheckCircle2 className="h-4 w-4" />;
		if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;
		return <AlertTriangle className="h-4 w-4" />;
	}, [loading, status?.drift.status]);

	const handlePreview = async () => {
		setPreviewing(true);
		setError(null);
		try {
			const next = await previewRolloverSync(schoolId);
			setStatus(next);
			onStatus?.(next);
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? 'ATLAS could not preview the EnrollPro rollover.');
		} finally {
			setPreviewing(false);
		}
	};

	const handleApply = async () => {
		setApplying(true);
		setError(null);
		try {
			const result = await applyRolloverSync(schoolId);
			setStatus(result);
			onStatus?.(result);
			onApplied?.(result);
			toast.success(`Synced ${result.enrollProActiveYear?.yearLabel ?? 'the active school year'} from EnrollPro.`);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not sync the new school year.';
			setError(message);
			toast.error(message);
		} finally {
			setApplying(false);
		}
	};

	const handlePreviewReset = async () => {
		setResetting(true);
		setError(null);
		try {
			const result = await resetDummyRolloverYear(schoolId, { confirmReset: false });
			setResetPreview(result);
			setConfirmationText('');
			setResetOpen(true);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not preview the dummy-year reset.';
			setError(message);
			toast.error(message);
		} finally {
			setResetting(false);
		}
	};

	const handleResetAndSync = async () => {
		setResetting(true);
		setError(null);
		try {
			const result = await resetDummyRolloverYear(schoolId, {
				confirmReset: true,
				confirmationText,
			});
			setResetPreview(result);
			setStatus(result);
			onStatus?.(result);
			onApplied?.(result);
			setResetOpen(false);
			toast.success(`Reset dummy data and synced ${result.enrollProActiveYear?.yearLabel ?? 'the active school year'} from EnrollPro.`);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.response?.data?.actionHint ?? err?.message ?? 'ATLAS could not reset dummy data.';
			setError(message);
			toast.error(message);
		} finally {
			setResetting(false);
		}
	};

	if (!loading && !status && !error) return null;
	if (status?.drift.status === 'aligned' && compact) {
		return (
			<div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700">
				<CheckCircle2 className="h-4 w-4 shrink-0" />
				<span>{status.drift.message}</span>
			</div>
		);
	}

	const resetRows = resetCountRows(resetPreview);
	const requiredConfirmation = resetPreview?.reset.confirmationText ?? 'RESET_DUMMY_SCHOOL_YEAR_1';
	const resetBlocked = Boolean(resetPreview?.reset.publishedResetBlocked || resetPreview?.reset.blockers.length);

	return (
		<>
		<Card className={cn(
			'border-dashed shadow-none',
			isBlocking ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white/80',
		)}>
			<CardContent className={cn('flex flex-col gap-3 p-3', !compact && 'sm:flex-row sm:items-center sm:justify-between')}>
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className={cn('gap-1', DRIFT_BADGE[status?.drift.status ?? 'enrollpro-unreachable'])}>
							{icon}
							{loading ? 'Checking school year' : driftLabel(status?.drift.status ?? 'enrollpro-unreachable')}
						</Badge>
						{status?.enrollProActiveYear ? (
							<Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
								EnrollPro {status.enrollProActiveYear.yearLabel}
							</Badge>
						) : null}
						{status?.counts ? (
							<Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
								{status.counts.sectionCount} sections · {status.counts.facultyCount} teachers
							</Badge>
						) : null}
					</div>
					<p className="text-sm font-medium text-slate-900">
						{status?.drift.message ?? 'Checking EnrollPro school year status.'}
					</p>
					<p className="text-xs text-slate-600">
						{status?.drift.status === 'atlas-stale'
							? 'Next setup path: Sync from EnrollPro, review sections, build Teaching Load, then create the timetable.'
							: status?.drift.status === 'mapping-conflict'
								? 'Because the existing ATLAS data is dummy, use the reset preview to clear it before syncing the new EnrollPro year.'
								: 'EnrollPro remains the source for active-year context; ATLAS keeps schedules, policies, and Teaching Load locally.'}
					</p>
					{error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
					{status?.conflicts?.length ? (
						<ul className="space-y-1 text-xs text-red-700">
							{status.conflicts.slice(0, 3).map((conflict) => (
								<li key={conflict.code}>{conflict.message}</li>
							))}
						</ul>
					) : null}
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					<Button type="button" variant="outline" size="sm" onClick={() => void handlePreview()} disabled={previewing || applying || resetting}>
						{previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
						Preview
					</Button>
					{canPreviewReset ? (
						<Button type="button" variant="destructive" size="sm" onClick={() => void handlePreviewReset()} disabled={previewing || applying || resetting}>
							{resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
							Reset dummy data
						</Button>
					) : (
						<Button type="button" size="sm" onClick={() => void handleApply()} disabled={!canApply || previewing || applying || resetting}>
							{applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Sync from EnrollPro
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
		<Dialog open={resetOpen} onOpenChange={setResetOpen}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Reset dummy school-year data</DialogTitle>
					<DialogDescription>
						This clears ATLAS dummy data using EnrollPro's active school-year ID, then syncs 2026-2027 from EnrollPro.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
						<p className="font-semibold">This does not change EnrollPro.</p>
						<p>Teaching Load will be cleared and must be rebuilt before timetable generation.</p>
					</div>
					{resetRows.length > 0 ? (
						<div className="grid gap-2 sm:grid-cols-2">
							{resetRows.map((row) => (
								<div key={row.label} className="rounded-xl border bg-white p-3">
									<p className="text-xs text-slate-500">{row.label}</p>
									<p className="text-lg font-semibold text-slate-900">{row.value}</p>
								</div>
							))}
						</div>
					) : (
						<p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">No dummy records were found for reset.</p>
					)}
					{resetPreview?.reset.blockers.length ? (
						<div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
							<p className="font-semibold">Reset is blocked</p>
							<ul className="mt-1 list-disc space-y-1 pl-5">
								{resetPreview.reset.blockers.map((blocker) => (
									<li key={blocker.code}>{blocker.message}</li>
								))}
							</ul>
						</div>
					) : null}
					<div className="space-y-2">
						<Label htmlFor="dummy-year-reset-confirmation">Type {requiredConfirmation} to continue</Label>
						<Input
							id="dummy-year-reset-confirmation"
							value={confirmationText}
							onChange={(event) => setConfirmationText(event.target.value)}
							placeholder={requiredConfirmation}
							disabled={resetBlocked || resetting}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={() => void handleResetAndSync()}
						disabled={resetBlocked || confirmationText !== requiredConfirmation || resetting}
					>
						{resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Reset and sync
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		</>
	);
}
