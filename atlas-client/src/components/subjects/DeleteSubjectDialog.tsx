import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import type { Subject } from '@/types';

const DEFAULT_SCHOOL_ID = 1;

type Phase =
	| { id: 'confirm' }
	| {
			id: 'blocked_active';
			activeCount: number;
			historicalCount: number;
			subjectWasActive: boolean;
			teachingLoadPath?: string;
	  }
	| { id: 'blocked_historical'; historicalCount: number };

interface Props {
	target: Subject | null;
	onClose: () => void;
	onDeleted: () => void;
	onEnsureSchoolYear: () => Promise<number>;
}

function Spinner() {
	return <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export function DeleteSubjectDialog({ target, onClose, onDeleted, onEnsureSchoolYear }: Props) {
	const [phase, setPhase] = useState<Phase>({ id: 'confirm' });
	const [loading, setLoading] = useState(false);

	// Reset phase each time a new target opens
	useEffect(() => {
		if (target) setPhase({ id: 'confirm' });
	}, [target?.id]);

	const attemptDelete = useCallback(
		async (subject: Subject, options?: { cleanupHistorical?: boolean; cleanupAll?: boolean }) => {
			const params: Record<string, boolean> = {};
			if (options?.cleanupHistorical) params.cleanupHistorical = true;
			if (options?.cleanupAll) params.cleanupAll = true;

			const { data } = await atlasApi.delete<{ cleanedHistoricalAssignments?: number }>(
				`/subjects/${subject.id}`,
				{ params: Object.keys(params).length ? params : undefined },
			);
			const cleaned = data?.cleanedHistoricalAssignments ?? 0;
			toast.success(
				cleaned > 0
					? `"${subject.name}" deleted. Cleaned ${cleaned} record${cleaned !== 1 ? 's' : ''}.`
					: `"${subject.name}" deleted.`,
			);
			onDeleted();
			onClose();
		},
		[onDeleted, onClose],
	);

	const handleConfirmDelete = useCallback(async () => {
		if (!target) return;
		setLoading(true);
		try {
			await attemptDelete(target);
		} catch (err: any) {
			const payload = err?.response?.data;
			if (payload?.code === 'DELETE_BLOCKED') {
				const { reason, details } = payload;
				if (reason === 'ACTIVE_ASSIGNMENTS') {
					setPhase({
						id: 'blocked_active',
						activeCount: details?.activeAssignmentCount ?? 0,
						historicalCount: details?.historicalAssignmentCount ?? 0,
						subjectWasActive: target.isActive,
						teachingLoadPath: details?.teachingLoadPath,
					});
				} else {
					setPhase({
						id: 'blocked_historical',
						historicalCount: details?.historicalAssignmentCount ?? 1,
					});
				}
			} else {
				toast.error(payload?.message ?? 'Failed to delete subject.');
			}
		} finally {
			setLoading(false);
		}
	}, [target, attemptDelete]);

	const handleArchiveAndDelete = useCallback(async () => {
		if (!target) return;
		setLoading(true);
		try {
			// Step 1: Archive the subject (sets isActive: false)
			await atlasApi.post(`/subjects/${target.id}/archive`);
			// Step 2: Clear active section ownership rows from the current school year
			const schoolYearId = await onEnsureSchoolYear();
			const preview = await atlasApi.post<{ ownershipRowsToRemove: number }>('/faculty-assignments/reset', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId,
				subjectId: target.id,
				previewOnly: true,
			});
			if ((preview.data.ownershipRowsToRemove ?? 0) > 0) {
				await atlasApi.post('/faculty-assignments/reset', {
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId,
					subjectId: target.id,
					previewOnly: false,
					confirmReset: true,
				});
			}
			// Step 3: Delete with full cleanup for any remaining historical records
			await attemptDelete(target, { cleanupAll: true });
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Archive and delete failed.');
		} finally {
			setLoading(false);
		}
	}, [target, onEnsureSchoolYear, attemptDelete]);

	const handleClearAndDelete = useCallback(async () => {
		if (!target) return;
		setLoading(true);
		try {
			const schoolYearId = await onEnsureSchoolYear();
			const preview = await atlasApi.post<{ ownershipRowsToRemove: number }>('/faculty-assignments/reset', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId,
				subjectId: target.id,
				previewOnly: true,
			});
			if ((preview.data.ownershipRowsToRemove ?? 0) > 0) {
				await atlasApi.post('/faculty-assignments/reset', {
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId,
					subjectId: target.id,
					previewOnly: false,
					confirmReset: true,
				});
			}
			await attemptDelete(target, { cleanupAll: true });
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to clear assignments.');
		} finally {
			setLoading(false);
		}
	}, [target, onEnsureSchoolYear, attemptDelete]);

	const handleCleanupAndDelete = useCallback(async () => {
		if (!target) return;
		setLoading(true);
		try {
			await attemptDelete(target, { cleanupHistorical: true });
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to clean up and delete.');
		} finally {
			setLoading(false);
		}
	}, [target, attemptDelete]);

	const subjectLabel = target ? `"${target.name}"` : '';

	return (
		<Dialog open={target !== null} onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
			<DialogContent className="max-w-md">

				{/* Phase 1: Simple confirmation */}
				{phase.id === 'confirm' && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-destructive">
								<Trash2 className="size-5 shrink-0" />
								Delete {subjectLabel}?
							</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2 pt-1">
									<p>
										<code className="text-xs font-mono font-bold">{target?.code}</code> will be permanently removed. This cannot be undone.
									</p>
									{target?.isActive && (
										<p className="text-xs text-amber-700 font-semibold rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
											This subject is active. If it has teaching load assignments you will be guided through clearing them first.
										</p>
									)}
								</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="gap-2">
							<Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
								Cancel
							</Button>
							<Button variant="destructive" size="sm" disabled={loading} onClick={handleConfirmDelete}>
								{loading ? <><Spinner />Checking...</> : 'Delete'}
							</Button>
						</DialogFooter>
					</>
				)}

				{/* Phase 2: Blocked — active assignments exist */}
				{phase.id === 'blocked_active' && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-amber-700">
								<AlertTriangle className="size-5 shrink-0" />
								Clear assignments first
							</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2.5 pt-1 text-sm">
									<p className="text-foreground">
										{subjectLabel} has{' '}
										<span className="font-bold">
											{phase.activeCount} active assignment{phase.activeCount !== 1 ? 's' : ''}
										</span>{' '}
										in the current teaching load and cannot be deleted directly.
									</p>
									{phase.historicalCount > 0 && (
										<p className="text-xs text-muted-foreground">
											Also has {phase.historicalCount} historical record{phase.historicalCount !== 1 ? 's' : ''} that will be removed.
										</p>
									)}
									<p className="text-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 font-medium leading-relaxed">
										{phase.subjectWasActive
											? 'Clicking "Archive & Delete" will deactivate this subject, remove its section assignments from the current school year, then permanently delete it.'
											: 'Clicking "Clear & Delete" will remove all active section assignments then permanently delete this subject.'}
									</p>
								</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="flex-wrap gap-2">
							<Button variant="ghost" size="sm" disabled={loading} onClick={onClose}>
								Cancel
							</Button>
							{phase.teachingLoadPath && (
								<Link to={phase.teachingLoadPath} onClick={onClose}>
									<Button variant="outline" size="sm" type="button">
										View Teaching Load
									</Button>
								</Link>
							)}
							{phase.subjectWasActive ? (
								<Button variant="destructive" size="sm" disabled={loading} onClick={handleArchiveAndDelete}>
									{loading
										? <><Spinner />Working...</>
										: <><Archive className="mr-2 size-4" />Archive &amp; Delete</>}
								</Button>
							) : (
								<Button variant="destructive" size="sm" disabled={loading} onClick={handleClearAndDelete}>
									{loading ? <><Spinner />Clearing...</> : 'Clear & Delete'}
								</Button>
							)}
						</DialogFooter>
					</>
				)}

				{/* Phase 3: Blocked — historical records only */}
				{phase.id === 'blocked_historical' && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-amber-700">
								<AlertTriangle className="size-5 shrink-0" />
								Historical records found
							</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2.5 pt-1 text-sm">
									<p className="text-foreground">
										{subjectLabel} has{' '}
										<span className="font-bold">
											{phase.historicalCount} historical record{phase.historicalCount !== 1 ? 's' : ''}
										</span>. These will be permanently removed along with the subject.
									</p>
								</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="gap-2">
							<Button variant="ghost" size="sm" disabled={loading} onClick={onClose}>
								Cancel
							</Button>
							<Button variant="destructive" size="sm" disabled={loading} onClick={handleCleanupAndDelete}>
								{loading ? <><Spinner />Deleting...</> : 'Clean Up & Delete'}
							</Button>
						</DialogFooter>
					</>
				)}

			</DialogContent>
		</Dialog>
	);
}
