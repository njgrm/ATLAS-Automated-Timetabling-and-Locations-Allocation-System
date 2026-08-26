import { useCallback, useEffect, useState } from 'react';
import { Wand2, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
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
import { Badge } from '@/ui/badge';
import { ScrollArea } from '@/ui/scroll-area';
import { Switch } from '@/ui/switch';

type AutoAssignResult = {
	schoolId: number;
	schoolYearId: number;
	mode: string;
	overwriteExisting: boolean;
	allowCrossGradeFallback: boolean;
	assignments: Array<{
		sectionId: number;
		sectionName: string;
		gradeLevel: number;
		homeRoomId: number;
		roomName: string;
		buildingId: number;
		buildingName: string;
		reason: string;
	}>;
	skipped: Array<{
		sectionId: number;
		sectionName: string;
		gradeLevel: number;
		reason: string;
	}>;
	counts: {
		sectionsConsidered: number;
		assigned: number;
		skipped: number;
		existingPreserved: number;
		applied: number;
	};
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schoolId: number;
	schoolYearId: number;
	onApplied: () => void;
};

const GRADE_COLORS: Record<number, string> = {
	7: 'bg-green-100 text-green-700',
	8: 'bg-yellow-100 text-yellow-700',
	9: 'bg-red-100 text-red-700',
	10: 'bg-blue-100 text-blue-700',
};

const REASON_LABELS: Record<string, string> = {
	GRADE_SCOPE_MATCH: 'Grade match',
	ANY_GRADE_FALLBACK: 'Any-grade building',
	ALREADY_ASSIGNED: 'Already assigned',
	NO_ELIGIBLE_ROOM: 'No eligible room',
	NO_GRADE_MATCHING_ROOM: 'No grade-matching room',
};

export function HomeRoomAutoAssignDialog({ open, onOpenChange, schoolId, schoolYearId, onApplied }: Props) {
	const [loading, setLoading] = useState(false);
	const [applying, setApplying] = useState(false);
	const [result, setResult] = useState<AutoAssignResult | null>(null);
	const [overwriteExisting, setOverwriteExisting] = useState(false);
	const [allowCrossGradeFallback, setAllowCrossGradeFallback] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [appliedCount, setAppliedCount] = useState<number | null>(null);

	const fetchPreview = useCallback(async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		setAppliedCount(null);
		try {
			const { data } = await atlasApi.post<AutoAssignResult>(
				`/sections/home-rooms/${schoolYearId}/auto-assign`,
				{ schoolId, mode: 'preview', overwriteExisting, allowCrossGradeFallback },
			);
			setResult(data);
		} catch (err: any) {
			setError(err?.response?.data?.message || 'Failed to load preview.');
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId, overwriteExisting, allowCrossGradeFallback]);

	useEffect(() => {
		if (open) {
			void fetchPreview();
		}
	}, [open, fetchPreview]);

	const handleApply = useCallback(async () => {
		if (!result) return;
		setApplying(true);
		setError(null);
		try {
			const { data } = await atlasApi.post<AutoAssignResult>(
				`/sections/home-rooms/${schoolYearId}/auto-assign`,
				{ schoolId, mode: 'apply', overwriteExisting, allowCrossGradeFallback },
			);
			setAppliedCount(data.counts.applied);
			setResult(data);
			onApplied();
		} catch (err: any) {
			setError(err?.response?.data?.message || 'Failed to apply assignments.');
		} finally {
			setApplying(false);
		}
	}, [result, schoolId, schoolYearId, overwriteExisting, allowCrossGradeFallback, onApplied]);

	const handleClose = useCallback(() => {
		setResult(null);
		setError(null);
		setAppliedCount(null);
		onOpenChange(false);
	}, [onOpenChange]);

	// Group assignments by grade
	const grouped = (result?.assignments ?? []).reduce<Record<number, AutoAssignResult['assignments']>>((acc, a) => {
		(acc[a.gradeLevel] ??= []).push(a);
		return acc;
	}, {});

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Wand2 className="size-4" />
						Auto-assign home rooms
					</DialogTitle>
					<DialogDescription>
						Preview which sections will receive a home room, then apply after confirming.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 min-h-0 overflow-auto space-y-3">
					{/* Options */}
					<div className="flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
						<label className="flex items-center gap-2 text-sm">
							<Switch
								checked={overwriteExisting}
								onCheckedChange={setOverwriteExisting}
								disabled={loading || applying}
							/>
							<span>Overwrite existing</span>
						</label>
						<label className="flex items-center gap-2 text-sm">
							<Switch
								checked={allowCrossGradeFallback}
								onCheckedChange={setAllowCrossGradeFallback}
								disabled={loading || applying}
							/>
							<span>Cross-grade fallback</span>
						</label>
					</div>

					{/* Loading */}
					{loading && (
						<div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							Loading preview…
						</div>
					)}

					{/* Error */}
					{error && (
						<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							<AlertCircle className="size-4 shrink-0" />
							{error}
						</div>
					)}

					{/* Applied success */}
					{appliedCount !== null && (
						<div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
							<CheckCircle2 className="size-4 shrink-0" />
							Applied {appliedCount} home-room assignment{appliedCount !== 1 ? 's' : ''}.
						</div>
					)}

					{/* Summary counts */}
					{result && !loading && (
						<div className="flex flex-wrap gap-2 text-xs">
							<Badge variant="outline">{result.counts.sectionsConsidered} considered</Badge>
							<Badge variant="outline" className="bg-green-50 text-green-700">{result.counts.assigned} to assign</Badge>
							{result.counts.skipped > 0 && (
								<Badge variant="outline" className="bg-amber-50 text-amber-700">{result.counts.skipped} skipped</Badge>
							)}
							{result.counts.existingPreserved > 0 && (
								<Badge variant="outline">{result.counts.existingPreserved} preserved</Badge>
							)}
						</div>
					)}

					{/* Assignments grouped by grade */}
					{result && !loading && result.assignments.length > 0 && (
						<div className="space-y-2">
							<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proposed assignments</p>
							<ScrollArea className="max-h-60">
								<div className="space-y-2">
									{Object.entries(grouped)
										.sort(([a], [b]) => Number(a) - Number(b))
										.map(([grade, items]) => (
											<div key={grade} className="space-y-1">
												<div className="flex items-center gap-1.5">
													<Badge className={`text-[0.65rem] ${GRADE_COLORS[Number(grade)] ?? ''}`}>G{grade}</Badge>
													<span className="text-xs text-muted-foreground">{items.length} section{items.length !== 1 ? 's' : ''}</span>
												</div>
												{items.map((item) => (
													<div key={item.sectionId} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
														<span className="font-medium flex-1 truncate">{item.sectionName}</span>
														<span className="text-muted-foreground">→</span>
														<span className="truncate">{item.roomName}</span>
														<Badge variant="outline" className="text-[0.6rem] shrink-0">
															{REASON_LABELS[item.reason] ?? item.reason}
														</Badge>
													</div>
												))}
											</div>
										))}
								</div>
							</ScrollArea>
						</div>
					)}

					{/* Skipped sections */}
					{result && !loading && result.skipped.length > 0 && (
						<div className="space-y-2">
							<p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Skipped sections</p>
							<div className="space-y-1">
								{result.skipped.map((item) => (
									<div key={item.sectionId} className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs">
										<Badge className={`text-[0.65rem] ${GRADE_COLORS[item.gradeLevel] ?? ''}`}>G{item.gradeLevel}</Badge>
										<span className="font-medium flex-1 truncate">{item.sectionName}</span>
										<span className="text-amber-600">{REASON_LABELS[item.reason] ?? item.reason}</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* No-op message */}
					{result && !loading && result.counts.sectionsConsidered === 0 && appliedCount === null && (
						<div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-muted-foreground justify-center">
							<CheckCircle2 className="size-4" />
							All sections already have a home room.
						</div>
					)}
				</div>

				<DialogFooter className="flex-row gap-2 sm:gap-0">
					<Button variant="ghost" size="sm" onClick={handleClose}>
						Close
					</Button>
					<div className="flex gap-2 ml-auto">
						<Button variant="outline" size="sm" onClick={fetchPreview} disabled={loading || applying}>
							<RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
							Refresh
						</Button>
						<Button
							size="sm"
							onClick={handleApply}
							disabled={loading || applying || !result || result.counts.assigned === 0}
							className="font-bold"
						>
							{applying ? 'Applying…' : `Apply ${result?.counts.assigned ?? 0} assignment${(result?.counts.assigned ?? 0) !== 1 ? 's' : ''}`}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
