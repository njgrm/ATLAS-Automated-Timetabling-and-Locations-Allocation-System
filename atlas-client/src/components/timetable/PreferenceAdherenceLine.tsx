/**
 * A2 C17 — one line in the run summary: "were teacher preferences kept?"
 *
 * THE LINE IS A CONTROL, and it must LOOK like one. An operator ruling
 * (2026-09-29) recorded a clickable sentence that read as plain text as a defect.
 * So this control is a bordered, filled button with a chevron, a pointer cursor,
 * a hover state and a `focus-visible` ring, and it is a real `<button>` from
 * `@/ui/button` — never a raw element, never a `title`, never a `<details>`.
 * The read-only figures around it are NOT restyled to match, because a number
 * that cannot be pressed must not look as though it can.
 *
 * SILENCE IS THE DEFAULT CASE. `report.hasAny === false` renders `null`: not an
 * empty box, not a zero line, not a disabled control. A year where nobody asked
 * a teacher anything gains nothing on screen (the packet's subtraction rule).
 *
 * The per-teacher list is behind ONE click on the line itself. There is no second
 * control, no "More", and no disclosure widget: the sentence is the trigger.
 * `Popover` handles Escape, outside-click and focus return, and `PopoverTrigger`
 * gives Enter and Space for free, so this file implements no key handling of its
 * own and cannot disagree with the primitive.
 */
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { ScrollArea } from '@/ui/scroll-area';
import {
	TEACHER_PREFERENCES_ROUTE,
	preferenceAdherenceLine,
	preferenceDayLine,
	preferenceLine,
	preferenceUnreviewedNotice,
	preferencesLineAccessibleName,
	type PreferenceAdherenceReport,
} from '@/lib/preference-adherence';

export type PreferenceAdherenceLineProps = {
	/** The run whose placed entries the report is computed over. `null` renders nothing. */
	runId: number | null;
	schoolId: number | null;
	schoolYearId: number | null;
	/** The term in view, or `'active'`. Availability is term-scoped, so this is never omitted. */
	termIndex: number | 'active';
	/**
	 * The school year this run belongs to, named in the list. Availability is
	 * year-scoped, so a term number on its own ("Term 1") does not say WHICH year's
	 * Term 1, and a year with several rolls would read as a lie.
	 *
	 * `null` falls back to the year ID, which is a real identity rather than a
	 * prettier guess: the body does not carry the year LABEL, and inventing one
	 * would be a claim nothing supports.
	 */
	schoolYearLabel?: string | null;
};

/**
 * How one teacher's preferences read: ONE line per kind, carrying the count, and the
 * per-day detail folded under it. A teacher who preferred five weekday mornings is
 * one line plus five short rows, not five lines of equal weight — and the detail
 * rows carry no ratio, so nothing in this list can disagree with the count above it.
 */
function TeacherBlock({ teacher }: { teacher: PreferenceAdherenceReport['teachers'][number] }) {
	return (
		<li className="space-y-1 py-1.5" data-testid="preference-adherence-teacher">
			<p className="text-sm font-semibold text-foreground">{teacher.name}</p>
			<ul className="space-y-1">
				{teacher.preferences.map((preference) => (
					<li
						key={`${preference.kind}:${preference.label}`}
						data-testid="preference-adherence-preference"
						data-preference-kind={preference.kind}
						data-preference-kept={preference.kept ? 'true' : 'false'}
					>
						<div className="flex items-start gap-1.5 text-sm text-muted-foreground">
							<span
								aria-hidden="true"
								className={`mt-1.5 size-1.5 shrink-0 rounded-full ${preference.kind === 'UNAVAILABLE'
									? (preference.kept ? 'bg-emerald-600' : 'bg-red-600')
									: 'bg-sky-600'}`}
							/>
							<span>{preferenceLine(preference)}</span>
						</div>
						{/* The per-day detail: where something landed, or that nothing did. */}
						<ul className="ml-3 space-y-0.5 border-l border-border/70 pl-2">
							{preference.days.map((day) => (
								<li
									key={day.day}
									className="text-sm text-muted-foreground/90"
									data-testid="preference-adherence-day"
									data-day-met={day.met ? 'true' : 'false'}
								>
									{preferenceDayLine(day)}
								</li>
							))}
						</ul>
					</li>
				))}
			</ul>
		</li>
	);
}

export function PreferenceAdherenceLine({
	runId,
	schoolId,
	schoolYearId,
	termIndex,
	schoolYearLabel,
}: PreferenceAdherenceLineProps) {
	const [report, setReport] = useState<PreferenceAdherenceReport | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (runId == null || schoolId == null || schoolYearId == null) {
			setReport(null);
			setFailed(false);
			return;
		}
		let cancelled = false;
		setFailed(false);
		// A late response from a previous run must never paint over the current one.
		atlasApi
			.get<PreferenceAdherenceReport>(
				`/generation/${schoolId}/${schoolYearId}/runs/${runId}/preference-adherence`,
				{ params: { termIndex } },
			)
			.then(({ data }) => { if (!cancelled) setReport(data); })
			.catch(() => { if (!cancelled) { setReport(null); setFailed(true); } });
		return () => { cancelled = true; };
	}, [runId, schoolId, schoolYearId, termIndex]);

	// A FAILED READ IS ANNOUNCED, BEFORE THE SILENT RETURNS BELOW.
	//
	// The first cut put this after them, where it could never render: the two
	// guards below return `null` for exactly the state a failure leaves behind, so
	// the branch was dead code whose comment claimed otherwise. A read that failed
	// is not a schedule with nothing to say — it is a question this screen cannot
	// answer right now, and a screen reader is told so. It still costs the
	// scheduler no visible pixels, because the "nothing on screen" rule is about
	// what a person reads, not about what assistive technology is told.
	if (failed) {
		return <span className="sr-only" role="status">Teacher preferences could not be read for this schedule.</span>;
	}

	// Nothing to say, or nothing to read: render NOTHING. A report with no
	// preferences is not a "0 of 0" line and not an empty box.
	if (report == null || !report.hasAny) return null;

	const line = preferenceAdherenceLine(report.totals);
	if (line === null) return null;
	const unreviewed = preferenceUnreviewedNotice(report.notReviewedTeacherCount);

	return (
		<div className="mb-2 flex min-w-0 flex-wrap items-center gap-2" data-testid="preference-adherence-strip">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 min-w-0 cursor-pointer gap-1.5 border-border bg-muted/40 px-2.5 text-sm font-medium hover:border-primary/50 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
						aria-label={preferencesLineAccessibleName(line)}
						data-testid="preference-adherence-line"
					>
						<span className="min-w-0">{line}</span>
						<ChevronRight className="size-4 shrink-0" aria-hidden="true" data-testid="preference-adherence-chevron" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					sideOffset={6}
					className="w-96 max-w-[calc(100vw-2rem)] p-0"
					data-testid="preference-adherence-list"
				>
					<div className="border-b border-border px-3 py-2">
						<p className="text-sm font-semibold text-foreground">Preferences kept, by teacher</p>
						{/* The year matters: availability is year-scoped, so "Term 1" alone
						    does not say WHICH year's Term 1. And when the term picker is on
						    "all terms" this report is the ACTIVE term's, which the scheduler
						    would otherwise have to guess. */}
						<p className="text-sm text-muted-foreground" data-testid="preference-adherence-scope">
							{`${schoolYearLabel ?? `School year ${schoolYearId}`} · Term ${report.termIndex}${termIndex === 'active' ? ' (the active term — the picker is on all terms)' : ''}`}
						</p>
					</div>
					<ScrollArea className="max-h-72">
						<ul className="divide-y divide-border/60 px-3">
							{report.teachers.map((teacher) => (
								<TeacherBlock key={teacher.facultyId} teacher={teacher} />
							))}
						</ul>
					</ScrollArea>
				</PopoverContent>
			</Popover>

			{unreviewed ? (
				<p className="min-w-0 text-sm text-muted-foreground" data-testid="preference-adherence-unreviewed">
					{unreviewed.text}{' '}
					<Link
						to={TEACHER_PREFERENCES_ROUTE}
						className="cursor-pointer rounded-sm font-semibold text-primary underline underline-offset-2 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
						data-testid="preference-adherence-unreviewed-link"
					>
						{unreviewed.action}
					</Link>
				</p>
			) : null}
		</div>
	);
}
