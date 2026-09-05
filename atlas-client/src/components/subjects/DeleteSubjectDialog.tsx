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

type DeletePreview = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	actorSchoolId: number;
	currentVersion: string;
	dependencies: Array<{
		type: string;
		id: number;
		classification: 'ACTIVE' | 'HISTORICAL' | 'BLOCKING';
		description: string;
	}>;
	activeCount: number;
	historicalCount: number;
	blockingCount: number;
	deletable: boolean;
	fingerprint: string;
	generatedAt: string;
};

type Phase =
	| { id: 'confirm' }
	| { id: 'preview'; preview: DeletePreview }
	| { id: 'blocked'; preview: DeletePreview }
	| { id: 'applying' };

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

	const handlePreview = useCallback(async () => {
		if (!target) return;
		setLoading(true);
		try {
			const { data } = await atlasApi.post<{ preview: DeletePreview }>(`/subjects/${target.id}/delete-preview`);
			const preview = data?.preview;
			if (!preview) {
				toast.error('Failed to generate delete preview.');
				return;
			}
			if (preview.deletable) {
				setPhase({ id: 'preview', preview });
			} else {
				setPhase({ id: 'blocked', preview });
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to preview deletion.');
		} finally {
			setLoading(false);
		}
	}, [target]);

	const handleApply = useCallback(async () => {
		if (!target || phase.id !== 'preview') return;
		setLoading(true);
		setPhase({ id: 'applying' });
		try {
			const currentSubject = target;
			const expectedUpdatedAt = currentSubject.updatedAt;
			await atlasApi.post(`/subjects/${target.id}/delete-apply`, {
				expectedUpdatedAt,
				fingerprint: phase.preview.fingerprint,
			});
			toast.success(`"${target.name}" deleted.`);
			onDeleted();
			onClose();
		} catch (err: any) {
			const code = err?.response?.data?.code;
			const msg = err?.response?.data?.message ?? 'Failed to delete subject.';
			if (code === 'DEPENDENCY_DRIFT') {
				toast.error('Dependencies changed. Re-running preview...');
				setPhase({ id: 'confirm' });
				await handlePreview();
			} else if (code === 'STALE_WRITE') {
				toast.error('Subject was modified by another user. Refresh and retry.');
				setPhase({ id: 'confirm' });
			} else {
				toast.error(msg);
				setPhase({ id: 'confirm' });
			}
		} finally {
			setLoading(false);
		}
	}, [target, phase, onDeleted, onClose, handlePreview]);

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
								Delete subject permanently?
							</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2 pt-1">
									<p>
										{subjectLabel} <code className="text-xs font-mono font-bold">{target?.code}</code> will be permanently removed from the curriculum list. This cannot be undone.
									</p>
									{target?.isActive && (
										<p className="text-xs text-amber-700 font-semibold rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
											This subject is active for scheduling. If teachers or sections still use it, ATLAS will ask you to clear those assignments first.
										</p>
									)}
								</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="gap-2">
							<Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
								Cancel
							</Button>
							<Button variant="destructive" size="sm" disabled={loading} onClick={handlePreview}>
								{loading ? <><Spinner />Checking...</> : 'Check dependencies'}
							</Button>
						</DialogFooter>
					</>
				)}

				{/* Phase 2: Preview — deletable */}
				{phase.id === 'preview' && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-destructive">
								<Trash2 className="size-5 shrink-0" />
								Confirm deletion
							</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2.5 pt-1 text-sm">
									<p className="text-foreground">
										{subjectLabel} has{' '}
										<span className="font-bold">
											{phase.preview.historicalCount} historical record{phase.preview.historicalCount !== 1 ? 's' : ''}
										</span>{' '}
										that will be removed along with the subject.
									</p>
									{phase.preview.historicalCount > 0 && (
										<p className="text-xs text-muted-foreground">
											Dependencies: {phase.preview.dependencies.map((d) => d.description).join(', ')}
										</p>
									)}
								</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="gap-2">
							<Button variant="ghost" size="sm" disabled={loading} onClick={onClose}>
								Cancel
							</Button>
							<Button variant="destructive" size="sm" disabled={loading} onClick={handleApply}>
								{loading ? <><Spinner />Deleting...</> : 'Delete permanently'}
							</Button>
						</DialogFooter>
					</>
				)}

				{/* Phase 3: Blocked — active/blocking dependencies */}
				{phase.id === 'blocked' && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-amber-700">
								<AlertTriangle className="size-5 shrink-0" />
								Cannot delete — dependencies exist
							</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2.5 pt-1 text-sm">
									<p className="text-foreground">
										{subjectLabel} has{' '}
										<span className="font-bold">
											{phase.preview.activeCount} active assignment{phase.preview.activeCount !== 1 ? 's' : ''}
										</span>
										{phase.preview.blockingCount > 0 && (
											<>, and <span className="font-bold">{phase.preview.blockingCount} blocking reference{phase.preview.blockingCount !== 1 ? 's' : ''}</span></>
										)}
										.
									</p>
									<div className="text-xs text-muted-foreground space-y-1">
										{phase.preview.dependencies.filter((d) => d.classification === 'ACTIVE' || d.classification === 'BLOCKING').map((d, i) => (
											<p key={i}>{d.description}</p>
										))}
									</div>
									<p className="text-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 font-medium leading-relaxed">
										Remove active assignments and blocking references before deleting this subject.
									</p>
								</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="gap-2">
							<Button variant="ghost" size="sm" disabled={loading} onClick={onClose}>
								Cancel
							</Button>
							<Button variant="outline" size="sm" asChild>
								<Link to={`/teaching-load?subjectId=${target?.id}`} onClick={onClose}>
									View Teaching Load
								</Link>
							</Button>
						</DialogFooter>
					</>
				)}

				{/* Phase 4: Applying */}
				{phase.id === 'applying' && (
					<div className="flex items-center justify-center py-8">
						<Spinner />
						<span className="ml-2 text-sm text-muted-foreground">Deleting...</span>
					</div>
				)}

			</DialogContent>
		</Dialog>
	);
}
