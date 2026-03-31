import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, GraduationCap, RefreshCw, ServerOff } from 'lucide-react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

type SectionSummary = {
	totalSections: number;
	byGradeLevel: Record<number, number>;
};

type FetchState =
	| { status: 'loading' }
	| { status: 'ok'; data: SectionSummary }
	| { status: 'unavailable'; message: string }
	| { status: 'no-year'; message: string };

export default function Sections() {
	const [state, setState] = useState<FetchState>({ status: 'loading' });

	const fetchSections = async () => {
		setState({ status: 'loading' });
		try {
			const settings = await fetchPublicSettings();
			const ayId = settings.activeSchoolYearId;
			if (!ayId) {
				setState({ status: 'no-year', message: 'No active school year is set. Configure it in EnrollPro before sections can be loaded.' });
				return;
			}
			const res = await atlasApi.get<SectionSummary & { code?: string }>(`/sections/summary/${ayId}`);
			if (res.data.code === 'UPSTREAM_UNAVAILABLE' || res.data.totalSections === 0 && res.data.code) {
				setState({
					status: 'unavailable',
					message: 'Section data source is currently unavailable. Sections are sourced from the enrollment service and will appear here once the upstream API is connected.',
				});
				return;
			}
			setState({ status: 'ok', data: { totalSections: res.data.totalSections, byGradeLevel: res.data.byGradeLevel } });
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

	return (
		<div className="h-[calc(100svh-3.5rem)] overflow-auto px-6 py-4 scrollbar-thin">
			<div className="flex items-center justify-end">
				<Button variant="outline" size="sm" onClick={fetchSections} disabled={state.status === 'loading'}>
					<RefreshCw className={`size-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
					Refresh
				</Button>
			</div>

			<div className="mt-4">
				{state.status === 'loading' && (
					<div className="space-y-3">
						<Skeleton className="h-32 w-full rounded-lg" />
						<Skeleton className="h-24 w-full rounded-lg" />
					</div>
				)}

				{state.status === 'no-year' && (
					<Card className="border-blue-200 bg-blue-50/50 shadow-sm">
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
					<Card className="border-amber-200 bg-amber-50/50 shadow-sm">
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
										<RefreshCw className="size-3.5" /> Retry Connection
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{state.status === 'ok' && (
					<div className="space-y-4">
						{/* Summary card */}
						<Card className="shadow-sm">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-semibold">Section Summary</CardTitle>
								<div className="rounded-md bg-pink-50 p-1.5">
									<GraduationCap className="size-4 text-pink-600" />
								</div>
							</CardHeader>
							<CardContent>
								<div className="flex items-baseline gap-2">
									<span className="text-2xl font-black">{state.data.totalSections}</span>
									<span className="text-sm text-muted-foreground">total sections</span>
								</div>
								{state.data.totalSections > 0 && (
									<div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600">
										<CheckCircle2 className="size-3" />
										Section data available for scheduling
									</div>
								)}
							</CardContent>
						</Card>

						{/* Grade-level breakdown */}
						{Object.keys(state.data.byGradeLevel).length > 0 && (
							<Card className="shadow-sm">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-semibold">By Grade Level</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
										{Object.entries(state.data.byGradeLevel)
											.sort(([a], [b]) => Number(a) - Number(b))
											.map(([grade, count]) => (
												<div
													key={grade}
													className="flex items-center justify-between rounded-md border px-3 py-2"
												>
													<span className="text-sm font-medium text-muted-foreground">
														Grade {grade}
													</span>
													<Badge variant="secondary" className="text-xs font-bold">
														{count}
													</Badge>
												</div>
											))}
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
