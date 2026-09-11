import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowRight, Info, Loader2, PlayCircle, ShieldCheck } from 'lucide-react';

import atlasApi from '@/lib/api';
import type { ArchivedYearSummary } from '@/lib/settings';
import {
	CARRY_FORWARD_APPLY_BLOCKED_MESSAGE,
	CARRY_FORWARD_REASON_META,
	carryForwardPreviewIsZeroWrite,
	carryForwardPreviewRequest,
	carryForwardReasonCounts,
	describeCarryForwardOverload,
	formatCarryForwardError,
	groupCarryForwardRowsByReason,
	pickDefaultSourceYear,
	summarizeCarryForwardPreview,
	type CarryForwardPreview,
} from '@/lib/teaching-load-carry-forward-helpers';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

type CarryForwardReviewPanelProps = {
	schoolId: number;
	activeSchoolYearId: number | null;
	archivedYears: ArchivedYearSummary[];
};

const TONE_CLASS: Record<string, string> = {
	carry: 'border-emerald-200 bg-emerald-50 text-emerald-900',
	preserved: 'border-slate-200 bg-slate-50 text-slate-700',
	blocked: 'border-amber-200 bg-amber-50 text-amber-900',
	review: 'border-sky-200 bg-sky-50 text-sky-900',
};

function hours(minutes: number): string {
	return `${Math.round(minutes / 60)}h`;
}

/**
 * Optional "Start from last year" preview. It lives in Year Setup so it never
 * competes with routine daily Teaching Load work. It only ever calls the
 * zero-write preview endpoint; no apply action is reachable from here.
 */
export function CarryForwardReviewPanel({ schoolId, activeSchoolYearId, archivedYears }: CarryForwardReviewPanelProps) {
	const defaultSourceYearId = useMemo(() => pickDefaultSourceYear(archivedYears)?.enrollProSchoolYearId ?? null, [archivedYears]);
	const [sourceYearId, setSourceYearId] = useState<number | null>(defaultSourceYearId);
	const [preview, setPreview] = useState<CarryForwardPreview | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setSourceYearId((current) => current ?? defaultSourceYearId);
	}, [defaultSourceYearId]);

	const summary = preview ? summarizeCarryForwardPreview(preview) : null;
	const reasonCounts = preview ? carryForwardReasonCounts(preview) : [];
	const groups = preview ? groupCarryForwardRowsByReason(preview.rows) : [];
	const overloadText = preview ? describeCarryForwardOverload(preview) : '';
	const zeroWriteSafe = preview ? carryForwardPreviewIsZeroWrite(preview) : false;

	const handlePreview = useCallback(async () => {
		if (!activeSchoolYearId || !sourceYearId) return;
		setLoading(true);
		setError(null);
		try {
			const { data } = await atlasApi.post<CarryForwardPreview>(
				'/teaching-load/carry-forward/preview',
				carryForwardPreviewRequest(schoolId, activeSchoolYearId, sourceYearId),
			);
			setPreview(data);
		} catch (requestError: any) {
			setPreview(null);
			setError(formatCarryForwardError(requestError));
		} finally {
			setLoading(false);
		}
	}, [activeSchoolYearId, schoolId, sourceYearId]);

	const handleCancel = useCallback(() => {
		setPreview(null);
		setError(null);
	}, []);

	if (archivedYears.length === 0 || activeSchoolYearId == null) {
		return (
			<div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-4" data-testid="carry-forward-empty">
				<div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
					<Archive className="size-4 text-slate-500" />
					Start from last year (optional)
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					{activeSchoolYearId == null
						? 'ATLAS needs a resolved active school year before a carry-forward preview is available.'
						: 'No archived school year has Teaching Load history to start from yet.'}
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border bg-white/80 p-4" data-testid="carry-forward-panel">
			<div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
				<Archive className="size-4 text-slate-500" />
				Start from last year (optional)
			</div>
			<p className="mt-1 text-xs text-muted-foreground">
				Preview how compatible assignments from one archived year map into the current empty Teaching Load. This is a read-only preview; nothing is applied and archived history is never changed.
			</p>

			<div className="mt-3 grid gap-3 sm:grid-cols-[minmax(12rem,16rem)_minmax(12rem,1fr)]">
				<div className="space-y-1.5">
					<Label htmlFor="carry-forward-source-year">Archived source year</Label>
					<Select
						value={sourceYearId ? String(sourceYearId) : ''}
						onValueChange={(value) => {
							setSourceYearId(Number(value));
							setPreview(null);
							setError(null);
						}}
					>
						<SelectTrigger id="carry-forward-source-year" className="min-h-11" data-testid="carry-forward-source-select">
							<SelectValue placeholder="Choose an archived year" />
						</SelectTrigger>
						<SelectContent>
							{archivedYears.map((year) => (
								<SelectItem key={year.enrollProSchoolYearId} value={String(year.enrollProSchoolYearId)}>
									{year.yearLabel}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-end gap-2">
					<Button type="button" size="sm" className="min-h-11 gap-2" onClick={() => void handlePreview()} disabled={loading || !sourceYearId} data-testid="carry-forward-preview-button">
						{loading ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
						Preview carry-forward
					</Button>
					{preview || error ? (
						<Button type="button" variant="outline" size="sm" className="min-h-11" onClick={handleCancel} data-testid="carry-forward-cancel">
							Cancel
						</Button>
					) : null}
				</div>
			</div>

			{error ? (
				<div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" data-testid="carry-forward-error">
					{error}
				</div>
			) : null}

			{preview && summary ? (
				<div className="mt-4 space-y-4" data-testid="carry-forward-summary">
					<div className={`rounded-xl border p-3 text-sm ${TONE_CLASS[summary.tone === 'ready' ? 'carry' : summary.tone === 'preserved' ? 'preserved' : 'review']}`}>
						<p className="font-semibold">{summary.headline}</p>
						<div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
							<Badge variant="outline" className="gap-1">
								{summary.sourceYearLabel} <ArrowRight className="size-3" /> {summary.targetYearLabel}
							</Badge>
							<Badge variant="outline">{summary.carried} carry</Badge>
							<Badge variant="outline">{summary.skipped} skipped</Badge>
							{zeroWriteSafe ? (
								<Badge variant="outline" className="gap-1 text-emerald-700">
									<ShieldCheck className="size-3" /> Zero-write preview
								</Badge>
							) : null}
						</div>
					</div>

					{reasonCounts.length > 0 ? (
						<div className="grid gap-2 sm:grid-cols-2" data-testid="carry-forward-reasons">
							{reasonCounts.map((entry) => (
								<div key={entry.reason} className={`rounded-xl border p-3 text-xs ${TONE_CLASS[entry.meta.tone]}`} data-testid={`carry-forward-reason-${entry.reason}`}>
									<div className="flex items-center justify-between gap-2">
										<span className="font-semibold">{entry.meta.label}</span>
										<span className="font-bold">{entry.count}</span>
									</div>
									<p className="mt-1 opacity-90">{entry.meta.description}</p>
								</div>
							))}
						</div>
					) : (
						<div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground" data-testid="carry-forward-no-rows">
							No archived rows were returned for this school year.
						</div>
					)}

					{(preview.totals.ALREADY_OCCUPIED ?? 0) > 0 ? (
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700" data-testid="carry-forward-partial-target">
							{preview.totals.ALREADY_OCCUPIED} target pair{preview.totals.ALREADY_OCCUPIED === 1 ? ' is' : 's are'} already occupied and preserved. Carry-forward fills empty pairs only.
						</div>
					) : null}

					<div className="grid gap-3 lg:grid-cols-2">
						<div className="rounded-xl border p-3 text-xs">
							<p className="font-semibold text-slate-800">Teaching distribution (before → after)</p>
							<ul className="mt-2 space-y-1 text-muted-foreground">
								<li>Over hard cap: {preview.before.distribution.overCap} → {preview.after.distribution.overCap}</li>
								<li>Excess: {preview.before.distribution.excess} → {preview.after.distribution.excess}</li>
								<li>At standard: {preview.before.distribution.atStandard} → {preview.after.distribution.atStandard}</li>
								<li>Below standard: {preview.before.distribution.belowStandard} → {preview.after.distribution.belowStandard}</li>
								<li>Zero load: {preview.before.distribution.zeroLoad} → {preview.after.distribution.zeroLoad}</li>
							</ul>
							<p className="mt-2 text-muted-foreground" data-testid="carry-forward-overload">{overloadText}</p>
						</div>
						<div className="rounded-xl border p-3 text-xs">
							<p className="font-semibold text-slate-800">Adviser coverage</p>
							<p className="mt-1 text-muted-foreground">{preview.adviserCoverage.satisfied} satisfied · {preview.adviserCoverage.unsatisfied} not yet satisfied</p>
							<p className="mt-2 font-semibold text-slate-800">Per-department review</p>
							<ul className="mt-1 space-y-1 text-muted-foreground">
								{preview.perDepartment.map((entry) => (
									<li key={entry.department}>{entry.department}: {entry.carry} carry · {entry.skipped} skipped</li>
								))}
							</ul>
						</div>
					</div>

					{groups.filter((group) => group.reason === 'EXACT_CARRY').length > 0 ? (
						<div className="rounded-xl border p-3" data-testid="carry-forward-carried-rows">
							<p className="text-xs font-semibold text-slate-800">Rows that would carry (review before any future approval)</p>
							<ul className="mt-2 space-y-1 text-xs text-muted-foreground">
								{groups.find((group) => group.reason === 'EXACT_CARRY')!.rows.map((row) => (
									<li key={row.sourceOwnershipId}>
										{row.targetSubjectCode ?? row.sourceSubjectCode ?? 'Subject'} · section {row.targetSectionExternalId ?? row.sourceSectionExternalId} → {row.targetFacultyName ?? 'Unresolved'} ({hours(row.weeklyMinutes)}/week)
									</li>
								))}
							</ul>
						</div>
					) : null}

					<div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900" data-testid="carry-forward-no-live-apply">
						<Info className="mt-0.5 size-4 shrink-0" />
						<p>{CARRY_FORWARD_APPLY_BLOCKED_MESSAGE}</p>
					</div>
				</div>
			) : null}
		</div>
	);
}

export default CarryForwardReviewPanel;
