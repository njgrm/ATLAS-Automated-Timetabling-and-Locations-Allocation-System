import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	GraduationCap,
	RefreshCw,
	Search,
	ServerOff,
	Users,
	X,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';

/* ─── Constants ─── */
const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50];

const GRADE_COLORS: Record<string, string> = {
	'7':  'bg-green-100/80 text-green-700',
	'8':  'bg-yellow-100/80 text-yellow-700',
	'9':  'bg-red-100/80 text-red-700',
	'10': 'bg-blue-100/80 text-blue-700',
};

/* ─── Types ─── */
type SortField = 'name' | 'gradeLevelId' | 'enrolledCount' | 'maxCapacity' | 'fill';
type SortDir   = 'asc' | 'desc';

type SectionDetail = {
	id:            number;
	name:          string;
	maxCapacity:   number;
	enrolledCount: number;
	gradeLevelId:  number;
	gradeLevelName: string;
};

type SectionSummary = {
	schoolId:              number;
	schoolYearId:          number;
	totalSections:         number;
	totalEnrolled:         number;
	byGradeLevel:          Record<number, number>;
	enrolledByGradeLevel:  Record<number, number>;
	sections:              SectionDetail[];
};

type FetchState =
	| { status: 'loading' }
	| { status: 'ok'; data: SectionSummary }
	| { status: 'unavailable'; message: string }
	| { status: 'no-year'; message: string };

/* ─── Helpers ─── */
function gradeKey(name: string) {
	const m = name.match(/\d+/);
	return m ? m[0] : '';
}

function fillColor(pct: number) {
	if (pct >= 95) return 'bg-red-600 text-white';
	if (pct >= 85) return 'bg-amber-500 text-white';
	if (pct >= 70) return 'bg-emerald-600 text-white';
	return 'bg-muted text-muted-foreground';
}

/* ─── Component ─── */
export default function Sections() {
	const [state, setState]           = useState<FetchState>({ status: 'loading' });
	const [sortField, setSortField]   = useState<SortField>('name');
	const [sortDir, setSortDir]       = useState<SortDir>('asc');
	const [page, setPage]             = useState(1);
	const [pageSize, setPageSize]     = useState(25);
	const [searchQuery, setSearchQuery] = useState('');
	const [gradeFilter, setGradeFilter] = useState<string>('all');

	const fetchSections = useCallback(async () => {
		setState({ status: 'loading' });
		try {
			const settings = await fetchPublicSettings();
			const ayId = settings.activeSchoolYearId;
			if (!ayId) {
				setState({
					status: 'no-year',
					message: 'No active school year is set. Configure it in EnrollPro before sections can be loaded.',
				});
				return;
			}
			const res = await atlasApi.get<SectionSummary & { code?: string }>(
				`/sections/summary/${ayId}?schoolId=${DEFAULT_SCHOOL_ID}`,
			);
			if (res.data.code === 'UPSTREAM_UNAVAILABLE' || (res.data.totalSections === 0 && res.data.code)) {
				setState({
					status: 'unavailable',
					message: 'Section data source is currently unavailable. Sections are sourced from the enrollment service and will appear here once the upstream API is connected.',
				});
				return;
			}
			setState({ status: 'ok', data: res.data });
		} catch {
			setState({
				status: 'unavailable',
				message: 'Section data is not yet available. Sections are sourced from the enrollment service and will appear here once the upstream API is connected.',
			});
		}
	}, []);

	useEffect(() => { void fetchSections(); }, [fetchSections]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, gradeFilter, pageSize]);

	const { paged, totalFiltered, totalPages } = useMemo(() => {
		if (state.status !== 'ok') return { paged: [], totalFiltered: 0, totalPages: 1 };
		let list = state.data.sections;

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter((s) => s.name.toLowerCase().includes(q) || s.gradeLevelName.toLowerCase().includes(q));
		}
		// Grade filter
		if (gradeFilter !== 'all') {
			list = list.filter((s) => gradeKey(s.gradeLevelName) === gradeFilter);
		}

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			if      (sortField === 'name')          cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
			else if (sortField === 'gradeLevelId')  cmp = a.gradeLevelId - b.gradeLevelId;
			else if (sortField === 'enrolledCount') cmp = a.enrolledCount - b.enrolledCount;
			else if (sortField === 'maxCapacity')   cmp = a.maxCapacity - b.maxCapacity;
			else if (sortField === 'fill') {
				const fA = a.maxCapacity > 0 ? a.enrolledCount / a.maxCapacity : 0;
				const fB = b.maxCapacity > 0 ? b.enrolledCount / b.maxCapacity : 0;
				cmp = fA - fB;
			}
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [state, searchQuery, gradeFilter, sortField, sortDir, page, pageSize]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
		return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
	};

	const hasActiveFilters = gradeFilter !== 'all' || searchQuery.trim() !== '';

	// Distinct grade levels present in data
	const availableGrades = useMemo(() => {
		if (state.status !== 'ok') return [];
		const keys = new Set<string>();
		state.data.sections.forEach((s) => { const k = gradeKey(s.gradeLevelName); if (k) keys.add(k); });
		return Array.from(keys).sort((a, b) => Number(a) - Number(b));
	}, [state]);

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">

			{/* ── Compact toolbar (matches Faculty pattern) ── */}
			<div className="shrink-0 px-6 pt-3 pb-2">
				<div className="flex items-center gap-2">
					{/* Search */}
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
						<Input
							placeholder="Search sections…"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-8 text-sm"
						/>
					</div>

					{/* Grade filter */}
					{availableGrades.length > 0 && (
						<Select value={gradeFilter} onValueChange={setGradeFilter}>
							<SelectTrigger className="h-8 w-32.5 text-xs">
								<SelectValue placeholder="All Grades" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Grades</SelectItem>
								{availableGrades.map((g) => (
									<SelectItem key={g} value={g}>G{g}</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}

					{/* Clear filters */}
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2 text-xs"
							onClick={() => { setSearchQuery(''); setGradeFilter('all'); }}
						>
							<X className="size-3 mr-1" /> Clear
						</Button>
					)}

					<div className="flex-1" />

					{/* Inline stat banner — prominent, not muted */}
					{state.status === 'ok' && (
						<div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5 shadow-sm shrink-0">
							<div className="flex items-center gap-1">
								<span className="text-sm font-bold text-foreground tabular-nums">{state.data.totalSections}</span>
								<span className="text-xs text-muted-foreground">sections</span>
							</div>
							<span className="text-border">·</span>
							<div className="flex items-center gap-1">
								<span className="text-sm font-bold text-foreground tabular-nums">{state.data.totalEnrolled}</span>
								<span className="text-xs text-muted-foreground">enrolled</span>
							</div>
							<span className="text-border">·</span>
							<div className="flex items-center gap-1.5">
								{Object.entries(state.data.byGradeLevel)
									.sort(([a], [b]) => Number(a) - Number(b))
									.map(([grade, count]) => (
										<Badge
											key={grade}
											variant="secondary"
											className={`h-6 px-2 text-xs font-bold border-0 ${GRADE_COLORS[grade] ?? 'bg-muted/50 text-muted-foreground'}`}
										>
											G{grade}: {count}
										</Badge>
									))}
							</div>
						</div>
					)}

					<Button
						variant="outline"
						size="sm"
						onClick={fetchSections}
						disabled={state.status === 'loading'}
						className="h-8 shrink-0"
					>
						<RefreshCw className={`mr-1 size-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				</div>
			</div>

			{/* ── Inline error banners (slim, like Faculty) ── */}
			{state.status === 'no-year' && (
				<div className="shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
					<AlertTriangle className="size-4 shrink-0" />
					<span className="flex-1">No active school year. {state.message}</span>
				</div>
			)}
			{state.status === 'unavailable' && (
				<div className="shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
					<ServerOff className="size-4 shrink-0" />
					<span className="flex-1">Enrollment service unavailable. Showing read-only view.</span>
					<Button size="sm" variant="outline" onClick={fetchSections} className="shrink-0 h-7">
						<RefreshCw className="mr-1 size-3 " /> Retry
					</Button>
				</div>
			)}

			{/* ── Table (same Card shell as Faculty) ── */}
			<div className="flex-1 min-h-0 px-6 pb-4">
				<Card className="h-full flex flex-col shadow-sm overflow-hidden">
					<div className="flex-1 min-h-0 overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
								<tr className="border-b">
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('name')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Section <SortIcon field="name" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('gradeLevelId')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Grade <SortIcon field="gradeLevelId" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-right">
										<button onClick={() => toggleSort('enrolledCount')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Enrolled <SortIcon field="enrolledCount" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-right">
										<button onClick={() => toggleSort('maxCapacity')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Capacity <SortIcon field="maxCapacity" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-right">
										<button onClick={() => toggleSort('fill')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Fill <SortIcon field="fill" />
										</button>
									</th>
								</tr>
							</thead>

							<tbody>
								{state.status === 'loading' ? (
									/* Skeleton rows — same pattern as Faculty's tbody loading row */
									Array.from({ length: 8 }).map((_, i) => (
										<tr key={i} className="border-b last:border-0">
											<td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
											<td className="px-4 py-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
											<td className="px-4 py-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
											<td className="px-4 py-3 text-right"><Skeleton className="h-5 w-12 rounded-full ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
											<div className="flex flex-col items-center gap-2">
												{state.status === 'ok' ? (
													<>
														<Users className="size-8 text-muted-foreground/40" />
														<p>{hasActiveFilters ? 'No sections match your filters.' : 'No sections found.'}</p>
													</>
												) : (
													<>
														<GraduationCap className="size-8 text-muted-foreground/40" />
														<p>Sections data unavailable.</p>
													</>
												)}
											</div>
										</td>
									</tr>
								) : (
									paged.map((s) => {
										const fill    = s.maxCapacity > 0 ? Math.round((s.enrolledCount / s.maxCapacity) * 100) : 0;
										const gKey    = gradeKey(s.gradeLevelName);
										const gColor  = GRADE_COLORS[gKey] ?? 'bg-muted text-muted-foreground';
										const gradeLabel = `G${s.gradeLevelName.replace(/^Grade\s+/i, '')}`;

										return (
											<tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
												{/* Name cell with avatar-style initial */}
												<td className="px-4 py-3">
													<div className="flex items-center gap-3">
														<div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${GRADE_COLORS[gKey] ?? 'bg-primary/10 text-primary'}`}>
															{gKey || s.name[0]}
														</div>
														<span className="font-medium">{s.name}</span>
													</div>
												</td>

												{/* Grade badge */}
												<td className="px-4 py-3">
													<Badge
														variant="secondary"
														className={`px-2 font-semibold text-[0.6875rem] border-0 ${gColor}`}
													>
														{gradeLabel}
													</Badge>
												</td>

												{/* Enrolled */}
												<td className="px-4 py-3 text-right font-medium">{s.enrolledCount}</td>

												{/* Capacity */}
												<td className="px-4 py-3 text-right text-muted-foreground">{s.maxCapacity}</td>

												{/* Fill pill */}
												<td className="px-4 py-3 text-right">
													<span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${fillColor(fill)}`}>
														{fill}%
													</span>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					{/* ── Pagination footer (identical structure to Faculty) ── */}
					{state.status === 'ok' && state.data.sections.length > 0 && (
						<div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-2 text-sm">
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								<span>{totalFiltered} result{totalFiltered !== 1 ? 's' : ''}</span>
								<span>·</span>
								<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
									<SelectTrigger className="h-7 w-22.5 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>)}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-1">
								<Button
									variant="outline"
									size="sm"
									className="h-7 w-7 p-0"
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page <= 1}
								>
									<ChevronLeft className="size-3.5" />
								</Button>
								<span className="px-2 text-xs tabular-nums">{page} / {totalPages}</span>
								<Button
									variant="outline"
									size="sm"
									className="h-7 w-7 p-0"
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									disabled={page >= totalPages}
								>
									<ChevronRight className="size-3.5" />
								</Button>
							</div>
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
