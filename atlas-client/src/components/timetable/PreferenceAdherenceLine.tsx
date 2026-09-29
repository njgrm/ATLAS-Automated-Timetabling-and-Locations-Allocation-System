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
	preferenceGroupLine,
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
};

/** How the list reads one teacher. */
function TeacherBlock({ teacher }: { teacher: PreferenceAdherenceReport['teachers'][number] }) {
	return (
		<li className="space-y-1 py-1.5" data-testid="preference-adherence-teacher">
			<p className="text-sm font-semibold text-foreground">{teacher.name}</p>
			<ul className="space-y-0.5">
				{teacher.groups.map((group) => (
					<li
						key={`${group.kind}:${group.label}`}
						className="flex items-start gap-1.5 text-sm text-muted-foreground"
						data-testid="preference-adherence-group"
						data-group-kind={group.kind}
						data-group-kept={group.kept ? 'true' : 'false'}
					>
						<span
							aria-hidden="true"
							className={`mt-1.5 size-1.5 shrink-0 rounded-full ${group.kind === 'UNAVAILABLE'
								? (group.kept ? 'bg-emerald-600' : 'bg-red-600')
								: 'bg-sky-600'}`}
						/>
						<span>{preferenceGroupLine(group)}</span>
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
}: PreferenceAdherenceLineProps) {
	const [report, setReport] = useState<PreferenceAdherenceReport | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (runId == null || schoolId == null || schoolYearId == null) {
			setReport(null);
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

	// Nothing to say, or nothing to read: render NOTHING. A failed read is also
	// silence rather than a zero line, because "0 of 0" would be a claim.
	if (report == null || !report.hasAny) return null;

	const line = preferenceAdherenceLine(report.totals);
	if (line === null) return null;
	const unreviewed = preferenceUnreviewedNotice(report.notReviewedTeacherCount);

	return (
		<>
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
							<p className="text-sm text-muted-foreground">Term {report.termIndex}</p>
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
			{/* A read that failed is a state the planner may want to see, never a
			    sentence: it is announced to assistive tech and occupies no pixels of
			    the scheduler's own. */}
			{failed ? <span className="sr-only" role="status">Teacher preferences could not be read for this schedule.</span> : null}
		</>
	);
}
