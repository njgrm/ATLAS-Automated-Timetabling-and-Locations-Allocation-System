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

function blockerCopy(reason: string): string {
	const labels: Record<string, string> = {
		NO_AVAILABLE_SLOT: 'No room and teacher time is available.',
		FACULTY_OVERLOAD: 'The assigned teacher is over the workload limit.',
		FACULTY_NOT_QUALIFIED: 'The assigned teacher is not qualified for this subject.',
		NO_FACULTY: 'Fix the Teaching Load owner before placing this session.',
	};
	return labels[reason] ?? reason.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

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
			<DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg rounded-lg p-5 bg-background shadow-xl">
				<DialogHeader className="space-y-2">
					<DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
						Review placements
					</DialogTitle>
					<DialogDescription className="text-sm leading-relaxed text-gray-500">
						ATLAS checked {total} session{total !== 1 ? 's' : ''}. Confirm the available placements below.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[350px] mt-4 pr-3 border-t border-b border-border/40 py-4">
					<div className="space-y-6">
						{/* Placed Sessions */}
						{placed.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs tracking-wider uppercase">
									<CheckCircle2 className="size-4 text-emerald-600" />
									Can place ({placed.length})
								</div>
								<div className="space-y-2">
									{placed.map((p, idx) => (
										<div
											key={`placed-${idx}`}
											className="space-y-1.5 rounded-md border border-emerald-200 bg-emerald-50/30 p-3"
										>
											<div className="flex justify-between items-start gap-2">
												<span className="font-semibold text-xs text-gray-900 leading-tight">
													{p.subjectCode} - {p.subjectName}
												</span>
												<Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50/50 py-0 text-xs font-semibold uppercase text-emerald-800">
													Session {p.session}
												</Badge>
											</div>
											<div className="space-y-0.5 text-xs font-medium text-gray-600">
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
									Still blocked ({unplaced.length})
								</div>
								<div className="space-y-2">
									{unplaced.map((u, idx) => (
										<div
											key={`unplaced-${idx}`}
											className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/30 p-3"
										>
											<div className="flex justify-between items-start gap-2">
												<span className="font-semibold text-xs text-gray-900 leading-tight">
													{u.subjectCode} - {u.subjectName}
												</span>
												<Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50/50 py-0 text-xs font-semibold uppercase text-amber-800">
													Session {u.session}
												</Badge>
											</div>
											<div className="text-xs font-medium text-gray-600">
												<p>Section: <span className="font-semibold text-gray-800">{u.sectionName}</span></p>
												<p className="mt-1 text-red-600 font-semibold flex items-center gap-1">
													<span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" />
													{blockerCopy(u.reason)}
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
					className="h-9 flex-1 border border-border bg-background text-xs font-semibold text-foreground sm:flex-initial"
					>
						Discard
					</Button>
					<Button
						variant="default"
						onClick={onConfirm}
						disabled={loading || placed.length === 0}
					className="h-9 flex-1 shrink-0 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 sm:flex-initial"
					>
						{loading ? (
							<span className="flex items-center gap-1.5">
								<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Applying...
							</span>
						) : (
							'Place sessions'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
