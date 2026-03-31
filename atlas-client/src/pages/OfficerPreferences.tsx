import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	Bell,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ClipboardList,
	FileQuestion,
	Loader2,
	Search,
	Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import type {
	OfficerSummaryCounts,
	OfficerSummaryFaculty,
	ReminderResponse,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';

/* ─── Constants ─── */

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZE = 25;

type StatusFilter = 'ALL' | 'SUBMITTED' | 'DRAFT' | 'MISSING';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: 'ALL', label: 'All Statuses' },
	{ value: 'SUBMITTED', label: 'Submitted' },
	{ value: 'DRAFT', label: 'Draft' },
	{ value: 'MISSING', label: 'Missing' },
];

function statusBadge(status: string) {
	switch (status) {
		case 'SUBMITTED':
			return <Badge variant='success'>Submitted</Badge>;
		case 'DRAFT':
			return <Badge variant='warning'>Draft</Badge>;
		case 'MISSING':
			return <Badge variant='danger'>Missing</Badge>;
		default:
			return <Badge variant='secondary'>{status}</Badge>;
	}
}

/* ─── Page ─── */

export default function OfficerPreferences() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);

	const [counts, setCounts] = useState<OfficerSummaryCounts>({ total: 0, submitted: 0, draft: 0, missing: 0 });
	const [faculty, setFaculty] = useState<OfficerSummaryFaculty[]>([]);

	const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
	const [searchQuery, setSearchQuery] = useState('');
	const [page, setPage] = useState(1);

	// Reminder state
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [reminding, setReminding] = useState(false);

	/* ── Resolve school year ── */
	useEffect(() => {
		fetchPublicSettings()
			.then((s) => {
				if (!s.activeSchoolYearId) {
					setError('No active school year configured.');
					setLoading(false);
					return;
				}
				setActiveSchoolYearId(s.activeSchoolYearId);
			})
			.catch(() => {
				setError('Failed to load settings.');
				setLoading(false);
			});
	}, []);

	/* ── Load summary ── */
	const loadSummary = useCallback(async () => {
		if (!activeSchoolYearId) return;
		setLoading(true);
		try {
			const params: Record<string, string> = {};
			if (statusFilter !== 'ALL') params.status = statusFilter;

			const { data } = await atlasApi.get<{ counts: OfficerSummaryCounts; faculty: OfficerSummaryFaculty[] }>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/summary`,
				{ params },
			);
			setCounts(data.counts);
			setFaculty(data.faculty);
			setError(null);
		} catch {
			setError('Failed to load preference summary.');
		} finally {
			setLoading(false);
		}
	}, [activeSchoolYearId, statusFilter]);

	useEffect(() => {
		if (activeSchoolYearId) loadSummary();
	}, [activeSchoolYearId, statusFilter, loadSummary]);

	/* Reset page on filter/search change */
	useEffect(() => { setPage(1); }, [statusFilter, searchQuery]);
	/* Clear selection on filter change */
	useEffect(() => { setSelectedIds(new Set()); }, [statusFilter]);

	/* ── Client-side search ── */
	const { paged, totalFiltered, totalPages } = useMemo(() => {
		let list = faculty;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(f) =>
					f.firstName.toLowerCase().includes(q) ||
					f.lastName.toLowerCase().includes(q) ||
					(f.department ?? '').toLowerCase().includes(q),
			);
		}
		const tf = list.length;
		const tp = Math.max(1, Math.ceil(tf / PAGE_SIZE));
		const start = (page - 1) * PAGE_SIZE;
		return { paged: list.slice(start, start + PAGE_SIZE), totalFiltered: tf, totalPages: tp };
	}, [faculty, searchQuery, page]);

	/* ── Selection helpers ── */
	const toggleOne = (id: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};
	const selectAllMissing = () => {
		const missingIds = faculty.filter((f) => f.preferenceStatus === 'MISSING').map((f) => f.facultyId);
		setSelectedIds(new Set(missingIds));
	};
	const clearSelection = () => setSelectedIds(new Set());

	/* ── Send reminder ── */
	const sendReminder = async () => {
		if (selectedIds.size === 0) return;
		setReminding(true);
		try {
			const { data } = await atlasApi.post<ReminderResponse>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/remind`,
				{ facultyIds: [...selectedIds] },
			);
			toast.success(
				`Reminder sent to ${data.reminded} faculty member${data.reminded > 1 ? 's' : ''}. Audit ID: ${data.auditId}`,
			);
			clearSelection();
		} catch (err) {
			const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(msg ?? 'Failed to send reminder.');
		} finally {
			setReminding(false);
		}
	};

	/* ── Render ── */

	if (loading && !faculty.length) {
		return (
			<div className='p-6 space-y-4'>
				<Skeleton className='h-8 w-64' />
				<div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className='h-20' />
					))}
				</div>
				<Skeleton className='h-10 w-full' />
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className='h-12 w-full' />
				))}
			</div>
		);
	}

	if (error && !faculty.length) {
		return (
			<div className='p-6'>
				<Card>
					<CardContent className='flex items-center gap-3 py-8'>
						<AlertCircle className='size-5 text-destructive shrink-0' />
						<div>
							<p className='font-medium text-destructive'>Cannot load preferences</p>
							<p className='text-sm text-muted-foreground mt-1'>{error}</p>
						</div>
						{activeSchoolYearId && (
							<Button variant='outline' size='sm' className='ml-auto' onClick={loadSummary}>
								Retry
							</Button>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='p-6 space-y-6'>
			{/* Header */}
			<div>
				<h1 className='text-xl font-semibold tracking-tight'>Faculty Preferences</h1>
				<p className='text-sm text-muted-foreground mt-0.5'>
					Monitor preference submission status and send reminders.
				</p>
			</div>

			{/* Summary cards */}
			<div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
				<SummaryCard icon={Users} label='Total Faculty' value={counts.total} color='text-foreground' />
				<SummaryCard icon={CheckCircle2} label='Submitted' value={counts.submitted} color='text-green-600' />
				<SummaryCard icon={ClipboardList} label='Draft' value={counts.draft} color='text-yellow-600' />
				<SummaryCard icon={FileQuestion} label='Missing' value={counts.missing} color='text-red-600' />
			</div>

			{/* Toolbar */}
			<div className='flex flex-wrap items-center gap-2'>
				<div className='relative flex-1 min-w-[200px] max-w-xs'>
					<Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
					<Input
						placeholder='Search faculty…'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='pl-8 h-9 text-sm'
					/>
				</div>
				<Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
					<SelectTrigger className='w-[160px] h-9 text-sm'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{STATUS_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className='ml-auto flex items-center gap-2'>
					{counts.missing > 0 && (
						<Button variant='outline' size='sm' className='h-9 gap-1.5 text-sm' onClick={selectAllMissing}>
							Select All Missing
						</Button>
					)}
					{selectedIds.size > 0 && (
						<>
							<Button variant='ghost' size='sm' className='h-9 text-sm' onClick={clearSelection}>
								Clear ({selectedIds.size})
							</Button>
							<Button
								size='sm'
								className='h-9 gap-1.5 text-sm'
								onClick={sendReminder}
								disabled={reminding}
							>
								{reminding ? <Loader2 className='size-3.5 animate-spin' /> : <Bell className='size-3.5' />}
								Remind ({selectedIds.size})
							</Button>
						</>
					)}
				</div>
			</div>

			{/* Faculty table */}
			<Card>
				<CardContent className='p-0'>
					{totalFiltered === 0 ? (
						<div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
							<FileQuestion className='size-10 mb-3 opacity-40' />
							<p className='text-sm font-medium'>No faculty found</p>
							<p className='text-xs mt-1'>
								{searchQuery ? 'Try a different search term.' : 'No faculty match the current filter.'}
							</p>
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full text-sm'>
								<thead>
									<tr className='border-b bg-muted/30'>
										<th className='w-10 px-3 py-2.5 text-left'>
											{/* Checkbox column */}
										</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Name</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Department</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Status</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Submitted</th>
									</tr>
								</thead>
								<tbody>
									<AnimatePresence initial={false}>
										{paged.map((f) => (
											<motion.tr
												key={f.facultyId}
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
												className='border-b last:border-0 hover:bg-muted/20 transition-colors'
											>
												<td className='px-3 py-2.5'>
													<input
														type='checkbox'
														checked={selectedIds.has(f.facultyId)}
														onChange={() => toggleOne(f.facultyId)}
														className='size-4 rounded border-input accent-[hsl(var(--primary))]'
													/>
												</td>
												<td className='px-3 py-2.5 font-medium'>
													{f.lastName}, {f.firstName}
												</td>
												<td className='px-3 py-2.5 text-muted-foreground'>
													{f.department ?? '—'}
												</td>
												<td className='px-3 py-2.5'>
													{statusBadge(f.preferenceStatus)}
												</td>
												<td className='px-3 py-2.5 text-muted-foreground'>
													{f.submittedAt
														? new Date(f.submittedAt).toLocaleDateString()
														: '—'}
												</td>
											</motion.tr>
										))}
									</AnimatePresence>
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className='flex items-center justify-between text-sm text-muted-foreground'>
					<span>
						Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalFiltered)} of {totalFiltered}
					</span>
					<div className='flex items-center gap-1'>
						<Button
							variant='outline'
							size='icon'
							className='size-8'
							disabled={page <= 1}
							onClick={() => setPage((p) => p - 1)}
						>
							<ChevronLeft className='size-4' />
						</Button>
						<span className='px-2'>
							{page} / {totalPages}
						</span>
						<Button
							variant='outline'
							size='icon'
							className='size-8'
							disabled={page >= totalPages}
							onClick={() => setPage((p) => p + 1)}
						>
							<ChevronRight className='size-4' />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

/* ─── Summary Card ─── */

function SummaryCard({
	icon: Icon,
	label,
	value,
	color,
}: {
	icon: typeof Users;
	label: string;
	value: number;
	color: string;
}) {
	return (
		<Card>
			<CardContent className='flex items-center gap-3 py-4'>
				<div className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted ${color}`}>
					<Icon className='size-5' />
				</div>
				<div>
					<p className='text-2xl font-bold tracking-tight'>{value}</p>
					<p className='text-xs text-muted-foreground'>{label}</p>
				</div>
			</CardContent>
		</Card>
	);
}
