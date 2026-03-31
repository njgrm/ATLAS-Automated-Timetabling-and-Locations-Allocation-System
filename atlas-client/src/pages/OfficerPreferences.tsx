import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	Bell,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ClipboardList,
	Eye,
	FileQuestion,
	Loader2,
	Search,
	Users,
	FlaskConical,
	MessageSquareWarning,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import type {
	OfficerSummaryCounts,
	OfficerSummaryFacultyWithReview,
	OfficerSummaryWithReviewsResponse,
	PreferenceDetail,
	ReminderResponse,
	DevBulkSubmitResponse,
	ReviewStatus,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/ui/sheet';
import { Textarea } from '@/ui/textarea';

/* ─── Constants ─── */

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50];

type StatusFilter = 'ALL' | 'SUBMITTED' | 'DRAFT' | 'MISSING';

const TAB_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: 'SUBMITTED', label: 'Submitted' },
	{ value: 'DRAFT', label: 'Draft' },
	{ value: 'MISSING', label: 'Missing' },
	{ value: 'ALL', label: 'All' },
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

function reviewBadge(status: ReviewStatus | null) {
	switch (status) {
		case 'REVIEWED':
			return <Badge variant='success'>Reviewed</Badge>;
		case 'NEEDS_FOLLOW_UP':
			return <Badge variant='warning'>Follow-up</Badge>;
		case 'PENDING':
			return <Badge variant='secondary'>Pending</Badge>;
		default:
			return null;
	}
}

const DAY_LABELS: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

const PREF_COLORS: Record<string, string> = {
	PREFERRED: 'text-green-600',
	AVAILABLE: 'text-foreground',
	UNAVAILABLE: 'text-red-600',
};

/* ─── Page ─── */

export default function OfficerPreferences() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);

	const [counts, setCounts] = useState<OfficerSummaryCounts>({ total: 0, submitted: 0, draft: 0, missing: 0 });
	const [faculty, setFaculty] = useState<OfficerSummaryFacultyWithReview[]>([]);

	const [statusFilter, setStatusFilter] = useState<StatusFilter>('SUBMITTED');
	const [searchQuery, setSearchQuery] = useState('');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	// Reminder state
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [reminding, setReminding] = useState(false);

	// Review sheet state
	const [reviewOpen, setReviewOpen] = useState(false);
	const [reviewFacultyId, setReviewFacultyId] = useState<number | null>(null);
	const [reviewDetail, setReviewDetail] = useState<PreferenceDetail | null>(null);
	const [reviewLoading, setReviewLoading] = useState(false);
	const [reviewAction, setReviewAction] = useState<'REVIEWED' | 'NEEDS_FOLLOW_UP' | null>(null);
	const [reviewerNotes, setReviewerNotes] = useState('');
	const [reviewSaving, setReviewSaving] = useState(false);

	// Dev bulk-submit state
	const [devSubmitting, setDevSubmitting] = useState(false);

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

			const { data } = await atlasApi.get<OfficerSummaryWithReviewsResponse>(
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
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: list.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [faculty, searchQuery, page, pageSize]);

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

	/* ── Open review sheet ── */
	const openReview = async (facultyId: number) => {
		if (!activeSchoolYearId) return;
		setReviewFacultyId(facultyId);
		setReviewOpen(true);
		setReviewLoading(true);
		setReviewDetail(null);
		setReviewAction(null);
		setReviewerNotes('');
		try {
			const { data } = await atlasApi.get<{ preference: PreferenceDetail }>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/faculty/${facultyId}/detail`,
			);
			setReviewDetail(data.preference);
			if (data.preference.review) {
				setReviewAction(data.preference.review.reviewStatus === 'PENDING' ? null : data.preference.review.reviewStatus as 'REVIEWED' | 'NEEDS_FOLLOW_UP');
				setReviewerNotes(data.preference.review.reviewerNotes ?? '');
			}
		} catch {
			toast.error('Failed to load preference detail.');
			setReviewOpen(false);
		} finally {
			setReviewLoading(false);
		}
	};

	/* ── Save review ── */
	const saveReview = async () => {
		if (!reviewDetail || !reviewAction || !activeSchoolYearId) return;
		setReviewSaving(true);
		try {
			await atlasApi.patch(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/review/${reviewDetail.id}`,
				{ reviewStatus: reviewAction, reviewerNotes: reviewerNotes || null },
			);
			toast.success(`Marked as ${reviewAction === 'REVIEWED' ? 'Reviewed' : 'Needs Follow-up'}.`);
			setReviewOpen(false);
			loadSummary();
		} catch (err) {
			const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(msg ?? 'Failed to save review.');
		} finally {
			setReviewSaving(false);
		}
	};

	/* ── Dev: bulk-submit seeded ── */
	const devBulkSubmit = async () => {
		if (!activeSchoolYearId) return;
		setDevSubmitting(true);
		try {
			const { data } = await atlasApi.post<DevBulkSubmitResponse>(
				`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/dev/submit-seeded`,
			);
			if (data.converted > 0) {
				toast.success(`Dev: Converted ${data.converted} draft(s) to SUBMITTED. Audit ID: ${data.auditId}`);
				loadSummary();
			} else {
				toast.info('Dev: No drafts to convert.');
			}
		} catch (err) {
			const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(msg ?? 'Dev bulk-submit failed.');
		} finally {
			setDevSubmitting(false);
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
		<div className='flex flex-col h-[calc(100svh-3.5rem)]'>
			
			<div className='shrink-0 px-6 pt-6 pb-2 space-y-6'>

				{/* Filters + Toolbar */}
				<div className='flex flex-wrap items-center gap-3'>
					<div className='flex flex-wrap items-center gap-1.5'>
						{TAB_OPTIONS.map((opt) => {
							const isActive = statusFilter === opt.value;
							return (
								<button
									key={opt.value}
									onClick={() => setStatusFilter(opt.value as StatusFilter)}
									className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
										isActive
											? 'border-primary bg-primary text-primary-foreground shadow-sm'
											: 'border-border bg-background text-muted-foreground hover:bg-muted'
									}`}
								>
									{opt.label}
									{opt.value === 'SUBMITTED' && counts.submitted > 0 && (
										<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-green-100 text-green-700'}`}>
											{counts.submitted}
										</span>
									)}
									{opt.value === 'DRAFT' && counts.draft > 0 && (
										<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-yellow-100 text-yellow-700'}`}>
											{counts.draft}
										</span>
									)}
									{opt.value === 'MISSING' && counts.missing > 0 && (
										<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-red-100 text-red-700'}`}>
											{counts.missing}
										</span>
									)}
								</button>
							);
						})}
					</div>

					<div className='relative flex-1 min-w-[200px] max-w-sm'>
						<Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
						<Input
							placeholder='Search faculty…'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='pl-8 h-8 text-sm'
						/>
					</div>

					<div className='ml-auto flex items-center gap-2'>
						{/* Dev bulk-submit button (visible only in non-production) */}
						{counts.draft > 0 && (
							<Button
								variant='outline'
								size='sm'
								className='h-8 px-2 text-xs gap-1 border-dashed border-amber-400 text-amber-700 hover:bg-amber-50'
								onClick={devBulkSubmit}
								disabled={devSubmitting}
							>
								{devSubmitting ? <Loader2 className='size-3 animate-spin' /> : <FlaskConical className='size-3' />}
								Dev: Submit All Drafts
							</Button>
						)}
						{counts.missing > 0 && (
							<Button variant='outline' size='sm' className='h-8 px-2 text-xs gap-1' onClick={selectAllMissing}>
								<Users className="size-3" /> Select All Missing
							</Button>
						)}
						{selectedIds.size > 0 && (
							<>
								<Button variant='ghost' size='sm' className='h-8 px-2 text-xs' onClick={clearSelection}>
									Clear ({selectedIds.size})
								</Button>
								<Button
									size='sm'
									className='h-8 gap-1.5 text-xs'
									onClick={sendReminder}
									disabled={reminding}
								>
									{reminding ? <Loader2 className='size-3 animate-spin' /> : <Bell className='size-3' />}
									Remind ({selectedIds.size})
								</Button>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Faculty table */}
			<div className='flex-1 min-h-0 px-6 pb-4'>
				<Card className="h-full flex flex-col shadow-sm overflow-hidden">
					<div className='flex-1 min-h-0 overflow-auto'>
						{totalFiltered === 0 ? (
							<div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
								<FileQuestion className='size-10 mb-3 opacity-40' />
								<p className='text-sm font-medium'>No faculty found</p>
								<p className='text-xs mt-1'>
									{searchQuery ? 'Try a different search term.' : 'No faculty match the current filter.'}
								</p>
							</div>
						) : (
							<table className='w-full text-sm'>
								<thead className='sticky top-0 z-10 bg-muted/80 backdrop-blur-sm'>
									<tr className='border-b'>
										<th className='w-10 px-3 py-2.5 text-left'>
											{/* Checkbox column */}
										</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Name</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Department</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Status</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Review</th>
										<th className='px-3 py-2.5 text-left font-medium text-muted-foreground'>Submitted</th>
										<th className='w-10 px-3 py-2.5' />
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
												className='border-b last:border-0 hover:bg-muted/30 transition-colors'
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
												<td className='px-3 py-2.5'>
													{f.preferenceStatus === 'SUBMITTED' ? reviewBadge(f.reviewStatus) : <span className='text-muted-foreground'>—</span>}
												</td>
												<td className='px-3 py-2.5 text-muted-foreground'>
													{f.submittedAt
														? new Date(f.submittedAt).toLocaleDateString()
														: '—'}
												</td>
												<td className='px-3 py-2.5'>
													{f.preferenceStatus !== 'MISSING' && (
														<Button
															variant='ghost'
															size='sm'
															className='h-7 w-7 p-0'
															onClick={() => openReview(f.facultyId)}
														>
															<Eye className='size-3.5' />
														</Button>
													)}
												</td>
											</motion.tr>
										))}
									</AnimatePresence>
								</tbody>
							</table>
						)}
					</div>
					
					{/* Uniform Pagination Footer */}
					{totalFiltered > 0 && (
						<div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-2 text-sm bg-background">
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
					)}
				</Card>
			</div>

			{/* Review Sheet */}
			<Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
				<SheetContent side='right' className='flex flex-col overflow-hidden sm:max-w-lg'>
					<SheetHeader className='shrink-0'>
						<SheetTitle>
							{reviewDetail
								? `${reviewDetail.faculty.lastName}, ${reviewDetail.faculty.firstName}`
								: 'Loading…'}
						</SheetTitle>
						<SheetDescription>
							{reviewDetail?.faculty.department ?? 'Preference review'}
						</SheetDescription>
					</SheetHeader>

					{reviewLoading ? (
						<div className='flex-1 flex items-center justify-center'>
							<Loader2 className='size-6 animate-spin text-muted-foreground' />
						</div>
					) : reviewDetail ? (
						<div className='flex-1 min-h-0 overflow-auto space-y-5 pt-2'>
							{/* Meta */}
							<div className='grid grid-cols-2 gap-3 text-sm'>
								<div>
									<p className='text-muted-foreground text-xs'>Status</p>
									<div className='mt-1'>{statusBadge(reviewDetail.status)}</div>
								</div>
								<div>
									<p className='text-muted-foreground text-xs'>Version</p>
									<p className='mt-1 font-mono'>{reviewDetail.version}</p>
								</div>
								<div>
									<p className='text-muted-foreground text-xs'>Submitted At</p>
									<p className='mt-1'>{reviewDetail.submittedAt ? new Date(reviewDetail.submittedAt).toLocaleString() : '—'}</p>
								</div>
								<div>
									<p className='text-muted-foreground text-xs'>Review Status</p>
									<div className='mt-1'>
										{reviewDetail.review ? reviewBadge(reviewDetail.review.reviewStatus) : <Badge variant='secondary'>Not reviewed</Badge>}
									</div>
								</div>
							</div>

							{/* Faculty notes */}
							{reviewDetail.notes && (
								<div>
									<p className='text-xs text-muted-foreground mb-1'>Faculty Notes</p>
									<p className='text-sm bg-muted/50 rounded p-2'>{reviewDetail.notes}</p>
								</div>
							)}

							{/* Time slots */}
							<div>
								<p className='text-xs text-muted-foreground mb-2'>Time Slot Preferences</p>
								<div className='border rounded-md overflow-hidden'>
									<table className='w-full text-xs'>
										<thead className='bg-muted/60'>
											<tr>
												<th className='px-2 py-1.5 text-left font-medium'>Day</th>
												<th className='px-2 py-1.5 text-left font-medium'>Start</th>
												<th className='px-2 py-1.5 text-left font-medium'>End</th>
												<th className='px-2 py-1.5 text-left font-medium'>Preference</th>
											</tr>
										</thead>
										<tbody>
											{reviewDetail.timeSlots.map((ts) => (
												<tr key={ts.id} className='border-t'>
													<td className='px-2 py-1.5'>{DAY_LABELS[ts.day] ?? ts.day}</td>
													<td className='px-2 py-1.5 font-mono'>{ts.startTime}</td>
													<td className='px-2 py-1.5 font-mono'>{ts.endTime}</td>
													<td className={`px-2 py-1.5 font-medium ${PREF_COLORS[ts.preference] ?? ''}`}>
														{ts.preference}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>

							{/* Review actions (only for SUBMITTED preferences) */}
							{reviewDetail.status === 'SUBMITTED' && (
								<div className='space-y-3 border-t pt-4'>
									<p className='text-xs font-medium text-muted-foreground'>Officer Review</p>
									<div className='flex gap-2'>
										<Button
											variant={reviewAction === 'REVIEWED' ? 'default' : 'outline'}
											size='sm'
											className='text-xs gap-1'
											onClick={() => setReviewAction('REVIEWED')}
										>
											<CheckCircle2 className='size-3' />
											Mark Reviewed
										</Button>
										<Button
											variant={reviewAction === 'NEEDS_FOLLOW_UP' ? 'default' : 'outline'}
											size='sm'
											className='text-xs gap-1'
											onClick={() => setReviewAction('NEEDS_FOLLOW_UP')}
										>
											<MessageSquareWarning className='size-3' />
											Needs Follow-up
										</Button>
									</div>
									<Textarea
										placeholder='Reviewer notes (optional)…'
										value={reviewerNotes}
										onChange={(e) => setReviewerNotes(e.target.value)}
										rows={3}
									/>
									<Button
										size='sm'
										className='w-full text-xs'
										onClick={saveReview}
										disabled={!reviewAction || reviewSaving}
									>
										{reviewSaving ? <Loader2 className='size-3 animate-spin mr-1' /> : null}
										Save Review
									</Button>
								</div>
							)}
						</div>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}


