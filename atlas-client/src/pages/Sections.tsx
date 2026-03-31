import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, GraduationCap, RefreshCw, ServerOff, Users, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50];

type SortField = 'name' | 'gradeLevelId' | 'enrolledCount' | 'maxCapacity' | 'fill';
type SortDir = 'asc' | 'desc';

type SectionDetail = {
	id: number;
	name: string;
	maxCapacity: number;
	enrolledCount: number;
	gradeLevelId: number;
	gradeLevelName: string;
};

type SectionSummary = {
	schoolId: number;
	schoolYearId: number;
	totalSections: number;
	totalEnrolled: number;
	byGradeLevel: Record<number, number>;
	enrolledByGradeLevel: Record<number, number>;
	sections: SectionDetail[];
};

type FetchState =
	| { status: 'loading' }
	| { status: 'ok'; data: SectionSummary }
	| { status: 'unavailable'; message: string }
	| { status: 'no-year'; message: string };

export default function Sections() {
	const [state, setState] = useState<FetchState>({ status: 'loading' });

	const [sortField, setSortField] = useState<SortField>('name');
	const [sortDir, setSortDir] = useState<SortDir>('asc');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	const fetchSections = async () => {
		setState({ status: 'loading' });
		try {
			const settings = await fetchPublicSettings();
			const ayId = settings.activeSchoolYearId;
			if (!ayId) {
				setState({ status: 'no-year', message: 'No active school year is set. Configure it in EnrollPro before sections can be loaded.' });
				return;
			}
			const res = await atlasApi.get<SectionSummary & { code?: string }>(`/sections/summary/${ayId}?schoolId=${DEFAULT_SCHOOL_ID}`);
			if (res.data.code === 'UPSTREAM_UNAVAILABLE' || res.data.totalSections === 0 && res.data.code) {
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
	};

	useEffect(() => {
		fetchSections();
	}, []);

	const { paged, totalFiltered, totalPages } = useMemo(() => {
		if (state.status !== 'ok') return { paged: [], totalFiltered: 0, totalPages: 1 };
		const list = state.data.sections;
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'name') cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
			else if (sortField === 'gradeLevelId') cmp = a.gradeLevelId - b.gradeLevelId;
			else if (sortField === 'enrolledCount') cmp = a.enrolledCount - b.enrolledCount;
			else if (sortField === 'maxCapacity') cmp = a.maxCapacity - b.maxCapacity;
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
	}, [state, sortField, sortDir, page, pageSize]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown className="ml-1 size-3 text-muted-foreground/50 inline-block" />;
		return sortDir === 'asc' ? <ArrowUp className="ml-1 size-3 inline-block" /> : <ArrowDown className="ml-1 size-3 inline-block" />;
	};

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			{/* Compact toolbar */}
			<div className="shrink-0 px-6 pt-3 pb-2 flex items-center justify-end">
				<Button variant="outline" size="sm" onClick={fetchSections} disabled={state.status === 'loading'} className="h-8">
					<RefreshCw className={`mr-1 size-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
					Refresh
				</Button>
			</div>

			<div className="flex-1 min-h-0 px-6 pb-4 flex flex-col overflow-hidden">
				{state.status === 'loading' && (
					<div className="space-y-3 shrink-0">
						<Skeleton className="h-32 w-full rounded-lg" />
						<Skeleton className="h-24 w-full rounded-lg" />
					</div>
				)}

				{state.status === 'no-year' && (
					<Card className="shrink-0 border-blue-200 bg-blue-50/50 shadow-sm mt-4">
						<CardContent className="pt-6">
							<div className="flex items-start gap-4">
								<div className="rounded-lg bg-blue-100 p-3">
									<AlertTriangle className="size-6 text-blue-600" />
								</div>
								<div className="flex-1">
									<h3 className="font-semibold text-blue-800">No Active School Year</h3>
									<p className="mt-1 text-sm text-blue-700">{state.message}</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{state.status === 'unavailable' && (
					<Card className="shrink-0 border-amber-200 bg-amber-50/50 shadow-sm mt-4">
						<CardContent className="pt-6">
							<div className="flex items-start gap-4">
								<div className="rounded-lg bg-amber-100 p-3">
									<ServerOff className="size-6 text-amber-600" />
								</div>
								<div className="flex-1">
									<h3 className="font-semibold text-amber-800">Upstream Service Unavailable</h3>
									<p className="mt-1 text-sm text-amber-700">{state.message}</p>
									<div className="mt-4 rounded-md border border-amber-200 bg-white/70 p-3">
										<p className="text-xs font-medium text-amber-800">Setup Readiness Impact</p>
										<ul className="mt-1.5 space-y-1 text-xs text-amber-700">
											<li className="flex items-center gap-1.5">
												<AlertTriangle className="size-3 shrink-0" />
												Section count cannot be verified for scheduling
											</li>
											<li className="flex items-center gap-1.5">
												<AlertTriangle className="size-3 shrink-0" />
												Grade-level distribution is unknown
											</li>
										</ul>
									</div>
									<Button variant="outline" size="sm" className="mt-3" onClick={fetchSections}>
										<RefreshCw className="mr-1 size-3.5" /> Retry Connection
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{state.status === 'ok' && (
					<div className="flex-1 min-h-0 flex flex-col gap-4">
						{/* Summary blocks row */}
						<div className="shrink-0 flex flex-col md:flex-row gap-4">
							{/* Cards column */}
							<div className="grid gap-4 sm:grid-cols-2 flex-[2]">
								<Card className="shadow-sm">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="text-sm font-semibold">Total Sections</CardTitle>
										<div className="rounded-md bg-pink-50 p-1.5">
											<GraduationCap className="size-4 text-pink-600" />
										</div>
									</CardHeader>
									<CardContent>
										<div className="flex items-baseline gap-2">
											<span className="text-2xl font-black">{state.data.totalSections}</span>
											<span className="text-sm text-muted-foreground">sections</span>
										</div>
										{state.data.totalSections > 0 && (
											<div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600">
												<CheckCircle2 className="size-3" />
												Data available for scheduling
											</div>
										)}
									</CardContent>
								</Card>
								<Card className="shadow-sm">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="text-sm font-semibold">Total Enrolled</CardTitle>
										<div className="rounded-md bg-indigo-50 p-1.5">
											<Users className="size-4 text-indigo-600" />
										</div>
									</CardHeader>
									<CardContent>
										<div className="flex items-baseline gap-2">
											<span className="text-2xl font-black">{state.data.totalEnrolled}</span>
											<span className="text-sm text-muted-foreground">students</span>
										</div>
										{state.data.totalSections > 0 && (
											<p className="mt-1 text-xs text-muted-foreground">
												Avg {Math.round(state.data.totalEnrolled / state.data.totalSections)} per section
											</p>
										)}
									</CardContent>
								</Card>
							</div>

							{/* Grade breakdown */}
							{Object.keys(state.data.byGradeLevel).length > 0 && (
								<Card className="shadow-sm flex-[3]">
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-semibold">By Grade Level</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
											{Object.entries(state.data.byGradeLevel)
												.sort(([a], [b]) => Number(a) - Number(b))
												.map(([grade, count]) => (
													<div key={grade} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
														<span className="text-sm font-medium text-muted-foreground">
															Grade {grade}
														</span>
														<div className="mt-1 flex items-center justify-between">
															<Badge variant="secondary" className="text-xs font-bold border-0 bg-background shadow-xs">
																{count} sec
															</Badge>
															<span className="text-xs text-muted-foreground font-medium">
																{state.data.enrolledByGradeLevel?.[Number(grade)] ?? 0}
															</span>
														</div>
													</div>
												))}
										</div>
									</CardContent>
								</Card>
							)}
						</div>

						{/* Interactive table card */}
						{state.data.sections.length > 0 && (
							<Card className="flex-1 min-h-0 flex flex-col shadow-sm mt-2">
								<div className="flex-1 min-h-0 overflow-auto">
									<table className="w-full text-sm">
										<thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
											<tr className="border-b text-left text-xs font-medium text-muted-foreground">
												<th className="px-4 py-2.5">
													<button onClick={() => toggleSort('name')} className="font-semibold text-muted-foreground hover:text-foreground">
														Section <SortIcon field="name" />
													</button>
												</th>
												<th className="px-4 py-2.5">
													<button onClick={() => toggleSort('gradeLevelId')} className="font-semibold text-muted-foreground hover:text-foreground">
														Grade <SortIcon field="gradeLevelId" />
													</button>
												</th>
												<th className="px-4 py-2.5 text-right">
													<button onClick={() => toggleSort('enrolledCount')} className="font-semibold text-muted-foreground hover:text-foreground">
														Enrolled <SortIcon field="enrolledCount" />
													</button>
												</th>
												<th className="px-4 py-2.5 text-right">
													<button onClick={() => toggleSort('maxCapacity')} className="font-semibold text-muted-foreground hover:text-foreground">
														Capacity <SortIcon field="maxCapacity" />
													</button>
												</th>
												<th className="px-4 py-2.5 text-right">
													<button onClick={() => toggleSort('fill')} className="font-semibold text-muted-foreground hover:text-foreground">
														Fill <SortIcon field="fill" />
													</button>
												</th>
											</tr>
										</thead>
										<tbody>
											{paged.map((s) => {
												const fill = s.maxCapacity > 0 ? Math.round((s.enrolledCount / s.maxCapacity) * 100) : 0;
												return (
													<tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
														<td className="px-4 py-2 font-medium">{s.name}</td>
														<td className="px-4 py-2 text-muted-foreground">{`Grade ${s.gradeLevelName.replace(/^Grade\s+/i, '')}`}</td>
														<td className="px-4 py-2 text-right">{s.enrolledCount}</td>
														<td className="px-4 py-2 text-right text-muted-foreground">{s.maxCapacity}</td>
														<td className="px-4 py-2 text-right">
															<Badge variant={fill >= 90 ? 'destructive' : fill >= 70 ? 'default' : 'secondary'} className="text-xs">
																{fill}%
															</Badge>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>

								{/* Uniform Pagination Footer */}
								<div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-2 text-sm bg-background mt-auto">
									<div className="flex items-center gap-2 text-muted-foreground text-xs">
										<span>{totalFiltered} result{totalFiltered !== 1 ? 's' : ''}</span>
										<span>·</span>
										<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
											<SelectTrigger className="h-7 w-[90px] text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>)}
											</SelectContent>
										</Select>
									</div>
									<div className="flex items-center gap-1">
										<Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
											<ChevronLeft className="size-3.5" />
										</Button>
										<span className="px-2 text-xs tabular-nums">{page} / {totalPages}</span>
										<Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
											<ChevronRight className="size-3.5" />
										</Button>
									</div>
								</div>
							</Card>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
