/**
 * A7-C2 — "Every school year in ATLAS", and "Keep as history" for one of them.
 *
 * WHY THIS FILE EXISTS. A7-C1 put a "Past school years" card on
 * `/admin/year-setup`, but it was driven by `status.archivedYears`, which the
 * server builds with `where: { isArchived: true }`. Years 9 and 10 were neither
 * the active year nor archived, so they appeared on NO page — which is exactly
 * what the 2026-09-28 operator rollover ran into. This card is driven by the
 * new `status.schoolYears` instead, which lists every mirrored year.
 *
 * A7-C2 §2 — "Keep as history" is PREVIEW FIRST. Pressing it calls the
 * zero-write preview, and the dialog that opens says what will be kept, says
 * plainly that nothing is deleted, and requires an explicit confirmation before
 * the apply is reachable. Crimson is not used: this is an honest change to a
 * year, not a destructive one, and a destructive paint here would be a lie.
 *
 * A7-C2 §3 / R6 — every past-year row keeps the EXISTING read-only Teaching Load
 * link, byte for byte, and adds `/timetable?schoolYearId=<id>` using the SAME
 * `enrollProSchoolYearId`. A2 owns the timetable route; until it honours the
 * parameter the Timetable link FAILS CLOSED and says so in plain words.
 *
 * Layout (AGENTS.md §8): `@/ui` primitives only, no raw `<button>`, no
 * `<details>`, no `title=`, every control `min-h-11`, and counts rendered as an
 * inline line rather than a metric card. Under the 1000-line limit at 250.
 */
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CalendarDays, Loader2 } from 'lucide-react';

import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import type { ArchiveSchoolYearPreview, SchoolYearSummary } from '@/lib/settings';
import {
	PLAIN_KEEP_YEAR_CONFIRM,
	PLAIN_KEEP_YEAR_EFFECT,
	PLAIN_KEEP_YEAR_LABEL,
	PLAIN_SCHOOL_YEARS_HEADING,
	PLAIN_SCHOOL_YEARS_HELPER,
	PLAIN_TIMETABLE_YEAR_UNAVAILABLE,
	plainKeepYearTitle,
	plainSchoolYearStateSentence,
	plainTeachingLoadYearHref,
	plainTimetableYearHref,
} from './rollover-plain-copy';

export type SchoolYearListCardProps = {
	schoolId: number;
	/** The new A7-C2 (R4) every-year list. `archivedYears` is NOT used here. */
	schoolYears: SchoolYearSummary[];
	/** Reloads the status after a successful keep, so the row flips to kept. */
	onKept: () => void;
};

type YearRowProps = {
	schoolId: number;
	year: SchoolYearSummary;
	onKept: () => void;
};

/** One year. The Keep action exists only for a year that is not yet kept. */
function YearRow({ schoolId, year, onKept }: YearRowProps) {
	const [preview, setPreview] = useState<ArchiveSchoolYearPreview | null>(null);
	const [loading, setLoading] = useState(false);
	const [applying, setApplying] = useState(false);
	const [confirmed, setConfirmed] = useState(false);
	const [error, setError] = useState<string | null>(null);

	/**
	 * A7-C2 QA N5: this dialog is rendered once per past year, so a fixed
	 * `id`/`htmlFor` produced N duplicate DOM ids and every label pointed at
	 * the first checkbox. Scoped to the year's own id, which is unique.
	 */
	const confirmFieldId = `year-setup-keep-confirm-${year.enrollProSchoolYearId}`;

	const openPreview = useCallback(async () => {
		setError(null);
		setConfirmed(false);
		setLoading(true);
		try {
			const { data } = await atlasApi.post<ArchiveSchoolYearPreview>('/runtime/rollover-archive/year/preview', {
				schoolId,
				schoolYearId: year.enrollProSchoolYearId,
			});
			setPreview(data);
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? 'ATLAS could not read this school year.');
		} finally {
			setLoading(false);
		}
	}, [schoolId, year.enrollProSchoolYearId]);

	const closeDialog = useCallback(() => {
		setPreview(null);
		setConfirmed(false);
		setError(null);
	}, []);

	const apply = useCallback(async () => {
		if (!preview || !confirmed) return;
		setApplying(true);
		setError(null);
		try {
			await atlasApi.post('/runtime/rollover-archive/year/apply', {
				schoolId,
				schoolYearId: year.enrollProSchoolYearId,
			});
			closeDialog();
			onKept();
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? 'ATLAS could not keep this school year.');
		} finally {
			setApplying(false);
		}
	}, [closeDialog, confirmed, onKept, preview, schoolId, year.enrollProSchoolYearId]);

	const timetableHref = plainTimetableYearHref(year.enrollProSchoolYearId);
	const canKeep = year.state === 'past, not yet kept';
	/** A7-C3: only a PAST year gets the past-year-scope Timetable link. */
	const isPastYear = year.state !== 'current';

	return (
		<li className="rounded-lg border border-slate-200 bg-white p-3" data-testid={`year-setup-year-${year.enrollProSchoolYearId}`}>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold text-slate-800">{year.yearLabel}</p>
					<p className="text-xs text-muted-foreground" data-testid={`year-setup-year-state-${year.enrollProSchoolYearId}`}>
						{plainSchoolYearStateSentence({
							yearLabel: year.yearLabel,
							state: year.state,
							publishedTimetables: year.preservedCounts?.publishedGenerationRuns ?? null,
						})}
					</p>
				</div>
				{canKeep ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="min-h-11 gap-1.5"
						onClick={() => void openPreview()}
						disabled={loading}
						data-testid={`year-setup-keep-${year.enrollProSchoolYearId}`}
					>
						{loading ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
						{PLAIN_KEEP_YEAR_LABEL}
					</Button>
				) : null}
			</div>

			{/* Item 3: the existing read-only Teaching Load link, unchanged, plus
			    the Timetable link on the SAME id (R6).

			    A7-C3: the Timetable link is offered for PAST years only. The CORRECT
			    reason, after QA B2 caught the first version of this comment asserting
			    something false: the current year is already one nav click away on the
			    ordinary `/timetable`, and the past-year scope REFUSES it server-side
			    with a typed 409 `NOT_A_PAST_SCHOOL_YEAR` — so linking it here would
			    spend a doomed request. It is not a dead link: the client answers the
			    current year from its own active year and renders the current
			    timetable, which is why this is a tidiness cut, not a capability cut.
			    The Teaching Load link is NOT restricted: it is the existing read-only
			    history view and behaves for every year. */}
			<div className="mt-2 flex flex-wrap items-center gap-2">
				<Button asChild type="button" variant="outline" size="sm" className="min-h-11">
					<Link to={plainTeachingLoadYearHref(year.enrollProSchoolYearId)} data-testid={`year-setup-tl-${year.enrollProSchoolYearId}`}>
						Open teaching load
					</Link>
				</Button>
				{isPastYear ? (
					timetableHref ? (
						<Button asChild type="button" variant="outline" size="sm" className="min-h-11 gap-1.5">
							<Link to={timetableHref} data-testid={`year-setup-timetable-${year.enrollProSchoolYearId}`}>
								<CalendarDays className="size-3.5" />
								Open timetable
							</Link>
						</Button>
					) : (
						/* Fail closed (R6): say so, do not link to a page that would
						   silently ignore the parameter. */
						<span className="text-xs text-muted-foreground" data-testid={`year-setup-timetable-unavailable-${year.enrollProSchoolYearId}`}>
							{PLAIN_TIMETABLE_YEAR_UNAVAILABLE}
						</span>
					)
				) : null}
			</div>

			<Dialog open={preview !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
				<DialogContent className="w-[calc(100%-2rem)] sm:max-w-md" hideClose={applying} data-testid="year-setup-keep-dialog">
					<DialogHeader>
						<DialogTitle>{plainKeepYearTitle(year.yearLabel)}</DialogTitle>
						<DialogDescription>
							{preview?.message ?? 'Checking what will be kept...'}
						</DialogDescription>
					</DialogHeader>
					<p className="text-sm text-slate-700">{PLAIN_KEEP_YEAR_EFFECT}</p>
					<div className="flex items-start gap-2">
						<Input
							id={confirmFieldId}
							type="checkbox"
							checked={confirmed}
							onChange={(event) => setConfirmed(event.target.checked === true)}
							disabled={applying}
							className="mt-0.5 size-5"
							data-testid="year-setup-keep-confirm"
						/>
						<Label htmlFor={confirmFieldId} className="text-sm text-slate-700">
							{PLAIN_KEEP_YEAR_CONFIRM}
						</Label>
					</div>
					{error ? <p className="text-sm font-medium text-destructive" role="alert" data-testid="year-setup-keep-error">{error}</p> : null}
					<DialogFooter>
						<Button type="button" variant="outline" size="sm" className="min-h-11" onClick={closeDialog} disabled={applying}>
							No, leave it as it is
						</Button>
						<Button
							type="button"
							size="sm"
							className="min-h-11"
							onClick={() => void apply()}
							disabled={!confirmed || applying}
							data-testid="year-setup-keep-apply"
						>
							{applying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
							{PLAIN_KEEP_YEAR_LABEL}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</li>
	);
}

export function SchoolYearListCard({ schoolId, schoolYears, onKept }: SchoolYearListCardProps) {
	if (schoolYears.length === 0) return null;
	return (
		<Card className="border-slate-200 bg-white/80 shadow-none" data-testid="admin-year-setup-school-years">
			<CardContent className="flex flex-col gap-3 p-4">
				<div>
					<h2 className="text-sm font-semibold text-slate-800">{PLAIN_SCHOOL_YEARS_HEADING}</h2>
					<p className="mt-1 text-xs text-muted-foreground">{PLAIN_SCHOOL_YEARS_HELPER}</p>
				</div>
				<ul className="space-y-2">
					{schoolYears.map((year) => (
						<YearRow key={year.enrollProSchoolYearId} schoolId={schoolId} year={year} onKept={onKept} />
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
