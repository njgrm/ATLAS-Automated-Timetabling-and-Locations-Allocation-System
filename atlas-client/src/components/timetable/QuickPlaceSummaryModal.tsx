import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Badge } from '@/ui/badge';
import { formatTime } from '@/lib/utils';

export interface PlacedSessionResult {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	session: number;
	day: string;
	startTime: string;
	endTime: string;
	roomId: number;
	roomName: string;
	facultyId: number;
	facultyName: string;
}

export interface UnplacedSessionResult {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	session: number;
	reason: string;
}

interface QuickPlaceSummaryModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	placed: PlacedSessionResult[];
	unplaced: UnplacedSessionResult[];
	onConfirm: () => void;
	loading?: boolean;
}

const DAY_LABELS: Record<string, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
};

export function QuickPlaceSummaryModal({
	open,
	onOpenChange,
	placed,
	unplaced,
	onConfirm,
	loading = false,
}: QuickPlaceSummaryModalProps) {
	const total = placed.length + unplaced.length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg rounded-3xl p-6 bg-sidebar shadow-2xl">
				<DialogHeader className="space-y-2">
					<DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
						Auto-Placement (Quick Place) Summary
					</DialogTitle>
					<DialogDescription className="text-sm leading-relaxed text-gray-500">
						ATLAS ran the scheduling algorithm to auto-place {total} displaced session{total !== 1 ? 's' : ''}.
						Review the proposed placements below before committing.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[350px] mt-4 pr-3 border-t border-b border-border/40 py-4">
					<div className="space-y-6">
						{/* Placed Sessions */}
						{placed.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs tracking-wider uppercase">
									<CheckCircle2 className="size-4 text-emerald-600" />
									Successfully Resolved ({placed.length})
								</div>
								<div className="space-y-2">
									{placed.map((p, idx) => (
										<div
											key={`placed-${idx}`}
											className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/20 space-y-1.5"
										>
											<div className="flex justify-between items-start gap-2">
												<span className="font-semibold text-xs text-gray-900 leading-tight">
													{p.subjectCode} - {p.subjectName}
												</span>
												<Badge variant="outline" className="text-[10px] py-0 border-emerald-200 bg-emerald-50/50 text-emerald-800 font-semibold uppercase shrink-0">
													Session {p.session}
												</Badge>
											</div>
											<div className="text-[11px] text-gray-600 space-y-0.5 font-medium">
												<p>Section: <span className="font-semibold text-gray-800">{p.sectionName}</span></p>
												<p>Teacher: <span className="font-semibold text-gray-800">{p.facultyName}</span></p>
												<p>
													Slot: <span className="font-semibold text-gray-800">{DAY_LABELS[p.day] ?? p.day} at {formatTime(p.startTime)}-{formatTime(p.endTime)}</span>
												</p>
												<p>Room: <span className="font-semibold text-gray-800">{p.roomName}</span></p>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Unplaced Sessions */}
						{unplaced.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center gap-2 text-amber-800 font-semibold text-xs tracking-wider uppercase">
									<AlertTriangle className="size-4 text-amber-600" />
									Could Not Resolve ({unplaced.length})
								</div>
								<div className="space-y-2">
									{unplaced.map((u, idx) => (
										<div
											key={`unplaced-${idx}`}
											className="p-3.5 rounded-2xl border border-amber-100 bg-amber-50/20 space-y-1.5"
										>
											<div className="flex justify-between items-start gap-2">
												<span className="font-semibold text-xs text-gray-900 leading-tight">
													{u.subjectCode} - {u.subjectName}
												</span>
												<Badge variant="outline" className="text-[10px] py-0 border-amber-200 bg-amber-50/50 text-amber-800 font-semibold uppercase shrink-0">
													Session {u.session}
												</Badge>
											</div>
											<div className="text-[11px] text-gray-600 font-medium">
												<p>Section: <span className="font-semibold text-gray-800">{u.sectionName}</span></p>
												<p className="mt-1 text-red-600 font-semibold flex items-center gap-1">
													<span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" />
													{u.reason}
												</p>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</ScrollArea>

				<DialogFooter className="flex flex-row gap-3 mt-6 sm:justify-end">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
						className="flex-1 sm:flex-initial h-10 rounded-2xl font-semibold text-xs border border-border bg-white text-gray-700 hover:bg-muted"
					>
						Discard
					</Button>
					<Button
						variant="default"
						onClick={onConfirm}
						disabled={loading || placed.length === 0}
						className="flex-1 sm:flex-initial h-10 rounded-2xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shrink-0"
					>
						{loading ? (
							<span className="flex items-center gap-1.5">
								<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Applying...
							</span>
						) : (
							'Apply Placements'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
