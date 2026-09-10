import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, BookOpen, Loader2, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import atlasApi from '@/lib/api';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

type HistoryYear = {
	schoolYearId: number;
	yearLabel: string;
	isArchived: true;
	archivedAt: string | null;
	archiveReason: string | null;
	cycle: { state: 'EMPTY' | 'POPULATED'; version: number; initializedAt: string; updatedAt: string } | null;
};

type HistoryAssignment = {
	facultySubjectId: number;
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	minutesPerWeek: number;
	assignedAt: string;
	sections: Array<{ sectionId: number; sectionName: string; gradeLevelName: string }>;
};

type HistoryPayload = {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	isArchived: true;
	archivedAt: string | null;
	archiveReason: string | null;
	cycle: { state: 'EMPTY' | 'POPULATED'; version: number; initializedAt: string; updatedAt: string };
	teachers: Array<{
		facultyId: number;
		facultyName: string;
		department: string | null;
		assignments: HistoryAssignment[];
	}>;
	totals: { teachers: number; assignments: number; sections: number };
};

function parsePositiveInt(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sectionNames(assignment: HistoryAssignment): string {
	return assignment.sections.length > 0
		? assignment.sections.map((section) => section.sectionName).join(', ')
		: 'No preserved section assignment';
}

export default function TeachingLoadHistoryView() {
	const [searchParams, setSearchParams] = useSearchParams();
	const requestedYearId = parsePositiveInt(searchParams.get('schoolYearId'));
	const [years, setYears] = useState<HistoryYear[]>([]);
	const [history, setHistory] = useState<HistoryPayload | null>(null);
	const [loadingYears, setLoadingYears] = useState(true);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');

	useEffect(() => {
		let cancelled = false;
		setLoadingYears(true);
		atlasApi.get<{ years: HistoryYear[] }>('/teaching-load/history-years')
			.then(({ data }) => {
				if (cancelled) return;
				const nextYears = Array.isArray(data.years) ? data.years : [];
				setYears(nextYears);
				setError(null);
				const selected = nextYears.find((year) => year.schoolYearId === requestedYearId && year.cycle != null)
					?? nextYears.find((year) => year.cycle != null);
				if (selected && selected.schoolYearId !== requestedYearId) {
					const next = new URLSearchParams(searchParams);
					next.set('view', 'history');
					next.set('schoolYearId', String(selected.schoolYearId));
					setSearchParams(next, { replace: true });
				}
			})
			.catch((requestError: any) => {
				if (!cancelled) setError(requestError?.response?.data?.message ?? 'ATLAS could not load archived Teaching Load years.');
			})
			.finally(() => {
				if (!cancelled) setLoadingYears(false);
			});
		return () => { cancelled = true; };
		// The list is actor-scoped and needs one request per history-view mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!requestedYearId || !years.some((year) => year.schoolYearId === requestedYearId && year.cycle != null)) {
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
					setError(requestError?.response?.data?.message ?? 'ATLAS could not load this archived Teaching Load.');
				}
			})
			.finally(() => {
				if (!cancelled) setLoadingHistory(false);
			});
		return () => { cancelled = true; };
	}, [requestedYearId, years]);

	const visibleTeachers = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return history?.teachers ?? [];
		return (history?.teachers ?? []).filter((teacher) =>
			teacher.facultyName.toLowerCase().includes(normalized)
			|| teacher.department?.toLowerCase().includes(normalized)
			|| teacher.assignments.some((assignment) =>
				assignment.subjectCode.toLowerCase().includes(normalized)
				|| assignment.subjectName.toLowerCase().includes(normalized)
				|| assignment.sections.some((section) => section.sectionName.toLowerCase().includes(normalized)),
			),
		);
	}, [history?.teachers, query]);

	const selectYear = (value: string) => {
		const next = new URLSearchParams(searchParams);
		next.set('view', 'history');
		next.set('schoolYearId', value);
		setSearchParams(next);
	};

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background" data-testid="teaching-load-history-view">
			<div className="shrink-0 border-b bg-background px-4 py-3 lg:px-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<Archive className="size-5 text-slate-600" />
							<h1 className="text-lg font-bold text-foreground">Teaching Load history</h1>
						</div>
						<p className="mt-0.5 text-sm text-muted-foreground">Review preserved assignments from an archived school year.</p>
					</div>
					<Button asChild type="button" variant="outline" size="sm" className="min-h-11 gap-2">
						<Link to="/teaching-load"><ArrowLeft className="size-4" />Current Teaching Load</Link>
					</Button>
				</div>
				<div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status" aria-live="polite" data-testid="teaching-load-history-read-only">
					<p className="font-bold">Read-only history{history?.yearLabel ? ` — ${history.yearLabel}` : ''}</p>
					<p className="mt-1">This school year is archived. You can review its Teaching Load, but you cannot reconcile, suggest, reset, edit, save, or run staffing actions here.</p>
				</div>
				<div className="mt-3 grid gap-3 sm:grid-cols-[minmax(13rem,18rem)_minmax(13rem,1fr)]">
					<div className="space-y-1.5">
						<Label htmlFor="teaching-load-history-year">Archived school year</Label>
						<Select value={requestedYearId ? String(requestedYearId) : ''} onValueChange={selectYear} disabled={loadingYears || years.length === 0}>
							<SelectTrigger id="teaching-load-history-year" className="min-h-11" data-testid="teaching-load-history-year-picker">
								<SelectValue placeholder={loadingYears ? 'Loading archived years…' : 'Choose an archived year'} />
							</SelectTrigger>
							<SelectContent>
								{years.map((year) => (
									<SelectItem key={year.schoolYearId} value={String(year.schoolYearId)} disabled={!year.cycle}>
										{year.yearLabel}{year.cycle ? '' : ' — no annual Teaching Load'}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="teaching-load-history-search">Find a teacher, subject, or section</Label>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
							<Input id="teaching-load-history-search" className="min-h-11 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
						</div>
					</div>
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-4 lg:px-5">
				{loadingYears || loadingHistory ? (
					<div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading preserved Teaching Load…</div>
				) : error ? (
					<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>
				) : years.length === 0 ? (
					<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No archived school years are available yet.</div>
				) : history?.cycle.state === 'EMPTY' ? (
					<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{history.yearLabel} has an empty annual Teaching Load cycle. No assignments were saved.</div>
				) : (
					<div className="space-y-4">
						<div className="flex flex-wrap gap-2" aria-label="Historical Teaching Load totals">
							<Badge variant="outline">{history?.totals.teachers ?? 0} teachers</Badge>
							<Badge variant="outline">{history?.totals.assignments ?? 0} subject assignments</Badge>
							<Badge variant="outline">{history?.totals.sections ?? 0} sections</Badge>
						</div>
						{visibleTeachers.length === 0 ? (
							<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No preserved Teaching Load matches your search.</div>
						) : visibleTeachers.map((teacher) => (
							<section key={teacher.facultyId} className="rounded-xl border bg-card" aria-labelledby={`history-teacher-${teacher.facultyId}`}>
								<div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
									<div>
										<h2 id={`history-teacher-${teacher.facultyId}`} className="font-bold">{teacher.facultyName}</h2>
										<p className="text-sm text-muted-foreground">{teacher.department ?? 'Department not recorded'}</p>
									</div>
									<Badge variant="secondary">{teacher.assignments.length} subject{teacher.assignments.length === 1 ? '' : 's'}</Badge>
								</div>
								<ul className="divide-y">
									{teacher.assignments.map((assignment) => (
										<li key={assignment.facultySubjectId} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(10rem,0.7fr)_minmax(14rem,1.3fr)] sm:gap-4">
											<div className="font-semibold"><BookOpen className="mr-1.5 inline size-4 text-primary" />{assignment.subjectCode} — {assignment.subjectName}</div>
											<div className="text-muted-foreground">{sectionNames(assignment)}</div>
										</li>
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
