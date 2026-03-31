import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	CheckCircle2,
	RefreshCw,
	Search,
	Users,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import type { FacultyMirror } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;

export default function Faculty() {
	const [faculty, setFaculty] = useState<FacultyMirror[]>([]);
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState(false);
	const [syncError, setSyncError] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [error, setError] = useState<string | null>(null);

	const fetchFaculty = useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ faculty: FacultyMirror[]; lastSyncedAt: string | null }>('/faculty', {
				params: { schoolId: DEFAULT_SCHOOL_ID },
			});
			setFaculty(data.faculty);
			setLastSyncedAt(data.lastSyncedAt);
			setSyncError(false);
			setError(null);
		} catch {
			setSyncError(true);
			setError('Failed to load faculty data.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchFaculty();
	}, [fetchFaculty]);

	const handleSync = async () => {
		setSyncing(true);
		setSyncError(false);
		try {
			const { data } = await atlasApi.post<{ synced: boolean; count: number }>('/faculty/sync', {
				schoolId: DEFAULT_SCHOOL_ID,
			});
			if (data.synced) {
				await fetchFaculty();
			} else {
				setSyncError(true);
			}
		} catch {
			setSyncError(true);
		} finally {
			setSyncing(false);
		}
	};

	const filtered = useMemo(() => {
		if (!searchQuery.trim()) return faculty;
		const q = searchQuery.toLowerCase();
		return faculty.filter(
			(f) =>
				f.firstName.toLowerCase().includes(q) ||
				f.lastName.toLowerCase().includes(q) ||
				(f.department ?? '').toLowerCase().includes(q),
		);
	}, [faculty, searchQuery]);

	const timeSince = useMemo(() => {
		if (!lastSyncedAt) return null;
		const diff = Date.now() - new Date(lastSyncedAt).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
		const hours = Math.floor(mins / 60);
		return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
	}, [lastSyncedAt]);

	return (
		<div className="px-6 py-4">
			{/* Page header */}
			<div className="mb-1 flex items-center justify-end">
				<div className="flex items-center gap-3">
					{timeSince && (
						<span className="text-xs text-muted-foreground">
							Last synced: {timeSince}
						</span>
					)}
					<Button onClick={handleSync} disabled={syncing} size="sm" variant="outline">
						<RefreshCw className={`mr-1.5 size-4 ${syncing ? 'animate-spin' : ''}`} />
						{syncing ? 'Syncing...' : 'Sync Now'}
					</Button>
				</div>
			</div>

			{/* Sync warning banner */}
			{syncError && (
				<div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
					<AlertTriangle className="size-4 shrink-0" />
					<span className="flex-1">
						EnrollPro bridge is unreachable. Showing cached faculty data.
					</span>
					<Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="shrink-0">
						<RefreshCw className={`mr-1 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry
					</Button>
				</div>
			)}

			{error && !syncError && (
				<div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{error}
					<button className="ml-2 font-semibold" onClick={() => setError(null)}>
						Dismiss
					</button>
				</div>
			)}

			{/* Search */}
			<div className="mt-4 relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
				<Input
					placeholder="Search by name or department..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
			</div>

			{/* Faculty table */}
			<Card className="mt-4 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Department</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Contact</th>
								<th className="px-4 py-3 text-center font-semibold text-muted-foreground">Subjects</th>
								<th className="px-4 py-3 text-center font-semibold text-muted-foreground">Weekly Load</th>
								<th className="px-4 py-3 text-center font-semibold text-muted-foreground">Preferences</th>
								<th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
										Loading faculty...
									</td>
								</tr>
							) : filtered.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
										{faculty.length === 0 ? (
											<div className="flex flex-col items-center gap-2">
												<Users className="size-8 text-muted-foreground/50" />
												<p>No faculty synced yet.</p>
												<Button size="sm" onClick={handleSync} disabled={syncing}>
													<RefreshCw className="mr-1.5 size-3.5" /> Sync from EnrollPro
												</Button>
											</div>
										) : (
											'No faculty match your search.'
										)}
									</td>
								</tr>
							) : (
								filtered.map((f) => {
									const subjectCount = f.facultySubjects?.length ?? 0;
									const weeklyMinutes = (f.facultySubjects ?? []).reduce(
										(sum, fs) => sum + (fs.subject?.minMinutesPerWeek ?? 0) * fs.gradeLevels.length,
										0,
									);
									const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
									const maxHours = f.maxHoursPerWeek;
									const loadColor =
										weeklyHours === 0
											? 'text-muted-foreground'
											: weeklyHours > maxHours
												? 'text-red-600'
												: weeklyHours >= maxHours * 0.85
													? 'text-amber-600'
													: 'text-emerald-600';

									return (
										<tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
											<td className="px-4 py-3">
												<div className="flex items-center gap-3">
													<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
														{f.firstName[0]}
														{f.lastName[0]}
													</div>
													<div>
														<p className="font-medium">
															{f.lastName}, {f.firstName}
														</p>
														<p className="text-[0.6875rem] text-muted-foreground">
															ID: {f.externalId}
														</p>
													</div>
												</div>
											</td>
											<td className="px-4 py-3 text-muted-foreground">
												{f.department ?? '—'}
											</td>
											<td className="px-4 py-3 text-muted-foreground text-[0.8125rem]">
												{f.contactInfo ?? '—'}
											</td>
											<td className="px-4 py-3 text-center">
												{subjectCount > 0 ? (
													<Badge className="bg-blue-100 text-blue-700 text-[0.6rem]">
														{subjectCount}
													</Badge>
												) : (
													<Badge variant="secondary" className="text-[0.6rem]">
														0
													</Badge>
												)}
											</td>
											<td className="px-4 py-3 text-center">
												<span className={`font-medium ${loadColor}`}>
													{weeklyHours > 0 ? `${weeklyHours}h` : '—'}
												</span>
												<span className="text-muted-foreground text-[0.6875rem]">
													{' '}/ {maxHours}h
												</span>
											</td>
											<td className="px-4 py-3 text-center">
												<span className="text-muted-foreground">—</span>
											</td>
											<td className="px-4 py-3 text-center">
												{f.isActiveForScheduling ? (
													<CheckCircle2 className="mx-auto size-4 text-emerald-500" />
												) : (
													<Badge variant="secondary" className="text-[0.6rem]">
														Excluded
													</Badge>
												)}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</Card>

			{/* Summary */}
			{!loading && faculty.length > 0 && (
				<div className="mt-3 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
					<Users className="size-4" />
					<span>
						{searchQuery && filtered.length !== faculty.length
							? `Showing ${filtered.length} of ${faculty.length} · `
							: ''}
						{faculty.filter((f) => f.isActiveForScheduling).length} active faculty
						{' · '}
						{faculty.filter((f) => (f.facultySubjects?.length ?? 0) === 0).length} without subject assignments
					</span>
				</div>
			)}
		</div>
	);
}
