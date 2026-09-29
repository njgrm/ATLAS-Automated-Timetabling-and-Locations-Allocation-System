/**
 * A9 c5 — "Past years": the read-only Teaching Load of a school year that is over.
 *
 * WHAT THIS PAGE IS FOR, in the words the Codex live audit (scores 3/2/2/2,
 * REJECT_UX) said a scheduler could not do on it. Three questions, two clicks:
 *
 *   1. "Who taught Grade 8 MAPEH?"  -> the Grade and Subject filters, 0 clicks to
 *      set each, and every row names the grade and the sections.
 *   2. "What was Ms X's load?"      -> every collapsed row reads
 *      `Name · 6.5 hours/week · 4 classes` before it is opened.
 *   3. "Can I use last year's assignments?" -> one plain line under the identity,
 *      and it is TRUE (see `tlHistoryCarryForwardLine`).
 *
 * THE DEFECT THIS REBUILDS. The year list filtered `isArchived: true`, so 2022-2023
 * — a genuinely past year that has not been "kept as history" yet — had no row, and
 * the only offered year was a 2029-2030 drill year. The server now offers every past
 * year, most recent first.
 *
 * SUBTRACTION (AGENTS.md design gate rule 3). Compared with the page this replaces
 * it removes: a two-line amber `role="status"` banner, three wall badges, a separate
 * subject card per teacher with a department line that said "Department not
 * recorded", and raw codes (`SCI_BIO`) in the default view. It adds exactly two
 * filters, a collapsed row, and two plain lines — each of which answers a question
 * the audit recorded as unanswered.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/app-shell/PageHeader';
import atlasApi from '@/lib/api';
import {
	TL_HISTORY_READ_ONLY_NOTE,
	TL_HISTORY_VIEW_ONLY_CHIP,
	tlHistoryCarryForwardLine,
	tlHistoryFutureYearSentence,
	tlHistoryGradeOptions,
	tlHistoryHeading,
	tlHistoryLoadLine,
	tlHistorySectionLine,
	tlHistorySubjectCodeDetail,
	tlHistorySubjectOptions,
	tlHistorySubjectPrimary,
	tlHistoryTotalsLine,
	tlHistoryVisibleTeachers,
	tlHistoryYearIsEmpty,
	tlHistoryYearOptionLabel,
	tlHistoryYearShortLabel,
	type TlHistoryAssignment,
	type TlHistoryTeacher,
	type TlHistoryYear,
} from '@/lib/teaching-load-history-plain';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { FilterPicker } from '@/ui/filter-picker';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';

type HistoryYears = {
	schoolId: number;
	activeSchoolYearId: number | null;
	activeYearLabel: string | null;
	years: TlHistoryYear[];
	futureYears: Array<{ schoolYearId: number; yearLabel: string }>;
};

type HistoryPayload = {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	isArchived: boolean;
	state: 'past' | 'kept as history';
	activeSchoolYearId: number | null;
	activeYearLabel: string | null;
	cycle: { state: 'EMPTY' | 'POPULATED' };
	teachers: TlHistoryTeacher[];
	totals: { teachers: number; assignments: number; sections: number };
};

function parsePositiveInt(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function TeachingLoadHistoryView() {
	const [searchParams, setSearchParams] = useSearchParams();
	const requestedYearId = parsePositiveInt(searchParams.get('schoolYearId'));
	const [years, setYears] = useState<TlHistoryYear[]>([]);
	const [futureYears, setFutureYears] = useState<HistoryYears['futureYears']>([]);
	const [history, setHistory] = useState<HistoryPayload | null>(null);
	const [loadingYears, setLoadingYears] = useState(true);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [grade, setGrade] = useState('all');
	const [subject, setSubject] = useState('all');

	useEffect(() => {
		let cancelled = false;
		setLoadingYears(true);
		atlasApi.get<HistoryYears>('/teaching-load/history-years')
			.then(({ data }) => {
				if (cancelled) return;
				const nextYears = Array.isArray(data.years) ? data.years : [];
				setYears(nextYears);
				setFutureYears(Array.isArray(data.futureYears) ? data.futureYears : []);
				setError(null);
				// The URL from School Year Setup wins whenever it names an offered year;
				// otherwise open the most recent year that actually holds something.
				const selected = nextYears.find((year) => year.schoolYearId === requestedYearId)
					?? nextYears.find((year) => !tlHistoryYearIsEmpty(year))
					?? nextYears[0];
				if (selected && selected.schoolYearId !== requestedYearId) {
					const next = new URLSearchParams(searchParams);
					next.set('view', 'history');
					next.set('schoolYearId', String(selected.schoolYearId));
					setSearchParams(next, { replace: true });
				}
			})
			.catch((requestError: any) => {
				if (!cancelled) setError(requestError?.response?.data?.message ?? 'ATLAS could not load past Teaching Load years.');
			})
			.finally(() => {
				if (!cancelled) setLoadingYears(false);
			});
		return () => { cancelled = true; };
		// The list is actor-scoped and needs one request per history-view mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Filters belong to the year that is open. Carrying a Grade 8 filter into a year
	// with no Grade 8 would leave a control naming a choice it cannot offer.
	useEffect(() => { setGrade('all'); setSubject('all'); setQuery(''); }, [requestedYearId]);

	useEffect(() => {
		if (!requestedYearId || !years.some((year) => year.schoolYearId === requestedYearId)) {
			setHistory(null);
			return;
		}
		let cancelled = false;
		setLoadingHistory(true);
		setError(null);
		atlasApi.get<HistoryPayload>(`/teaching-load/history-years/${requestedYearId}`)
			.then(({ data }) => {
				if (!cancelled) setHistory(data);
			})
			.catch((requestError: any) => {
				if (!cancelled) {
					setHistory(null);
					setError(requestError?.response?.data?.message ?? 'ATLAS could not load this past Teaching Load.');
				}
			})
			.finally(() => {
				if (!cancelled) setLoadingHistory(false);
			});
		return () => { cancelled = true; };
	}, [requestedYearId, years]);

	const teachers = history?.teachers ?? [];
	const gradeOptions = useMemo(() => tlHistoryGradeOptions(teachers), [history]);
	const subjectOptions = useMemo(() => tlHistorySubjectOptions(teachers), [history]);
	const visibleTeachers = useMemo(
		() => tlHistoryVisibleTeachers(teachers, { query, grade, subject }),
		[teachers, query, grade, subject],
	);

	const selectYear = (value: string) => {
		const next = new URLSearchParams(searchParams);
		next.set('view', 'history');
		next.set('schoolYearId', value);
		setSearchParams(next);
	};

	const yearLabel = history?.yearLabel ?? years.find((year) => year.schoolYearId === requestedYearId)?.yearLabel ?? null;
	const futureSentence = tlHistoryFutureYearSentence(futureYears.map((year) => year.yearLabel));
	const isFiltered = grade !== 'all' || subject !== 'all' || query.trim() !== '';

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background" data-testid="teaching-load-history-view">
			<div className="shrink-0 border-b bg-background px-4 py-3 lg:px-5">
				<PageHeader
					title="Past years"
					subtitle={tlHistoryHeading(yearLabel)}
					source={(
						<Badge variant="outline" className="text-xs font-medium">{TL_HISTORY_VIEW_ONLY_CHIP}</Badge>
					)}
					primaryAction={(
						<Button asChild type="button" variant="outline" size="sm" className="min-h-11 gap-2">
							<Link to="/teaching-load"><ArrowLeft className="size-4" />Current Teaching Load</Link>
						</Button>
					)}
				/>
				{/*
				 * The two-line amber `role="status"` banner is GONE. It was two sentences
				 * of what you cannot do, which is the same fact twice, in a box that
				 * competed with the identity for the first screen. One line says the one
				 * thing a first-time visitor needs. `rollover-ui-guardrails` still reads
				 * `data-testid="teaching-load-history-read-only"`, and it is kept on
				 * this line rather than removed with the banner.
				 */}
				<p className="mt-2 text-xs text-muted-foreground" data-testid="teaching-load-history-read-only">
					{TL_HISTORY_READ_ONLY_NOTE}
				</p>
				<p className="mt-1 text-xs text-muted-foreground">{tlHistoryCarryForwardLine(yearLabel)}</p>
			</div>

			<div className="shrink-0 border-b bg-background px-4 pb-3 lg:px-5">
				{/*
				 * ONE filter row at 1366, four columns on a wide screen and two on a
				 * narrow one. The audit's problem 3 was two labels colliding because the
				 * row was two fixed-width columns with no `min-w-0`; the fix is the grid
				 * below plus `min-w-0` on every cell, and the shared `@/ui/filter-picker`
				 * for all three so they look like every other page's filters (§8 "One look
				 * per control").
				 */}
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="min-w-0 space-y-1.5">
						<Label htmlFor="teaching-load-history-year">School year</Label>
						{/*
						 * The live binding is `dataTestId`, which `FilterPicker` forwards to
						 * `SearchableSelect`'s `triggerTestId` — it lands on the trigger button as
						 * `data-testid="teaching-load-history-year-picker"`, and both
						 * `rollover-ui-guardrails` and any rendered suite reach it under that name.
						 * A5 C3 slice B: `allValue=""` because this list has NO "all" member, so the
						 * unset face shows `placeholder`, never a bare `All`.
						 */}
						<FilterPicker
							name="School year"
							ariaLabel="Past school year"
							allValue=""
							triggerId="teaching-load-history-year"
							value={requestedYearId ? String(requestedYearId) : ''}
							onValueChange={selectYear}
							disabled={loadingYears || years.length === 0}
							placeholder={loadingYears ? 'Loading past years…' : 'Choose a past year'}
							shortLabels={Object.fromEntries(years.map((year) => [String(year.schoolYearId), tlHistoryYearShortLabel(year)]))}
							// eslint-disable-next-line react/no-unknown-property
							options={years.map((year) => ({
								value: String(year.schoolYearId),
								label: tlHistoryYearOptionLabel(year),
								disabled: tlHistoryYearIsEmpty(year),
							}))}
							dataTestId="teaching-load-history-year-picker"
						/>
					</div>
					<div className="min-w-0 space-y-1.5">
						<Label htmlFor="teaching-load-history-grade">Grade</Label>
						<FilterPicker
							name="Grade"
							value={grade}
							onValueChange={setGrade}
							triggerId="teaching-load-history-grade"
							disabled={gradeOptions.length === 0}
							disabledReason={gradeOptions.length === 0 ? 'No grades in this year' : undefined}
							placeholder="All grades"
							options={[{ value: 'all', label: 'All grades' }, ...gradeOptions.map((name) => ({ value: name, label: name }))]}
							dataTestId="teaching-load-history-grade-picker"
						/>
					</div>
					<div className="min-w-0 space-y-1.5">
						<Label htmlFor="teaching-load-history-subject">Subject</Label>
						<FilterPicker
							name="Subject"
							value={subject}
							onValueChange={setSubject}
							triggerId="teaching-load-history-subject"
							disabled={subjectOptions.length === 0}
							disabledReason={subjectOptions.length === 0 ? 'No subjects in this year' : undefined}
							placeholder="All subjects"
							options={[{ value: 'all', label: 'All subjects' }, ...subjectOptions.map((name) => ({ value: name, label: name }))]}
							dataTestId="teaching-load-history-subject-picker"
						/>
					</div>
					<div className="min-w-0 space-y-1.5">
						<Label htmlFor="teaching-load-history-search">Find a teacher</Label>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
							<Input id="teaching-load-history-search" className="min-h-11 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
						</div>
					</div>
				</div>
				{futureSentence ? <p className="mt-2 text-xs text-muted-foreground">{futureSentence}</p> : null}
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-3 lg:px-5">
				{loadingYears || loadingHistory ? (
					<div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading past Teaching Load…</div>
				) : error ? (
					<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>
				) : years.length === 0 ? (
					<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No past school years are available yet.</div>
				) : history?.cycle.state === 'EMPTY' ? (
					<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{history.yearLabel} has an empty annual Teaching Load cycle. No assignments were saved.</div>
				) : (
					<div className="space-y-3">
						{/* Three wall badges became one muted line: the same three figures, no
						    badges competing with the rows for the first screen. */}
						<p className="text-xs text-muted-foreground" data-testid="teaching-load-history-totals">
							{history ? tlHistoryTotalsLine(history.totals) : ''}
						</p>
						{visibleTeachers.length === 0 ? (
							<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
								{isFiltered
									? 'No teacher in this year matches those filters.'
									: `No teachers were saved for ${history?.yearLabel ?? 'this year'}.`}
							</div>
						) : (
							<Accordion type="single" collapsible className="rounded-xl border bg-card px-3">
								{visibleTeachers.map(({ teacher, matches }: { teacher: TlHistoryTeacher; matches: TlHistoryAssignment[] }) => (
									<AccordionItem key={teacher.facultyId} value={String(teacher.facultyId)}>
										<AccordionTrigger className="min-h-11 py-2.5 text-sm">
											<span className="flex min-w-0 flex-col items-start gap-0.5">
												<span className="font-semibold text-foreground">{teacher.facultyName}</span>
												<span className="text-xs font-normal text-muted-foreground">
													{tlHistoryLoadLine({ weeklyMinutes: teacher.weeklyMinutes, classCount: teacher.classCount })}
												</span>
											</span>
											<span className="min-w-0 text-right">
												{teacher.department ? (
													<span className="block text-xs font-normal text-muted-foreground">{teacher.department}</span>
												) : null}
											</span>
										</AccordionTrigger>
										<AccordionContent>
											<ul className="space-y-2 pb-2">
												{matches.map((assignment) => (
													<li key={assignment.facultySubjectId} className="min-w-0 text-sm">
														<div className="flex flex-wrap items-baseline gap-x-2">
															<span className="font-medium">{tlHistorySubjectPrimary(assignment)}</span>
															<span className="text-muted-foreground">{tlHistorySectionLine(assignment)}</span>
														</div>
														{/* The code is a DETAIL, never the label: `SCI_BIO` is not scheduler
														    language, and the audit recorded it as one of the worst problems. */}
														<p className="text-xs text-muted-foreground">{tlHistorySubjectCodeDetail(assignment)}</p>
													</li>
												))}
											</ul>
										</AccordionContent>
									</AccordionItem>
								))}
							</Accordion>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
