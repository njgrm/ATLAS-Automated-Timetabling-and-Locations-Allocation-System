import { AlertTriangle, BadgeCheck, Building2, Users2 } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Separator } from '@/ui/separator';
import { cn } from '@/lib/utils';

export type StaffingCrossTrainee = {
	department: string;
	availableTeachers: number;
	totalSpareHours: number;
};

export type StaffingReport = {
	department: string;
	unassignedSections: number;
	missingHoursPerWeek: number;
	recommendedNewHires: number;
	internalCrossTrainees: StaffingCrossTrainee[];
	missingMinutesPerWeek: number;
};

export type AutoFillSummaryResult = {
	preserved: number;
	created: number;
	assignmentsCreated: number;
	uniqueTeachersAffected: number;
	unresolved: number;
	warnings: string[];
	staffingReport: StaffingReport;
};

type AutoFillSummaryModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	result: AutoFillSummaryResult | null;
};

function formatHires(value: number): string {
	return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function AutoFillSummaryModal({ open, onOpenChange, result }: AutoFillSummaryModalProps) {
	const report = result?.staffingReport ?? null;
	const hasShortage = Boolean(report && report.unassignedSections > 0);
	const hasResult = Boolean(result);

	const title = hasShortage ? 'Schedule Incomplete: Staffing Shortage Detected' : 'Schedule Fully Assigned!';
	const description = hasShortage
		? 'We assigned as many classes as possible without overloading current staff. Some classes remain unassigned because the remaining load exceeds the current staffing supply.'
		: 'All classes have been successfully assigned to a teacher. No one has exceeded their maximum allowed teaching hours.';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[calc(100%-1rem)] max-w-4xl gap-6 rounded-3xl border-border bg-card p-0 shadow-2xl sm:w-[calc(100%-2rem)]">
				<div className="max-h-[88vh] overflow-y-auto p-6 sm:p-7">
					<DialogHeader className="space-y-3 text-left">
						<div
							className={cn(
								'inline-flex h-12 w-12 items-center justify-center rounded-2xl',
								hasShortage ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
							)}
						>
							{hasShortage ? <AlertTriangle className="size-6" /> : <BadgeCheck className="size-6" />}
						</div>
						<DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
							{title}
						</DialogTitle>
						<DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
							{description}
						</DialogDescription>
					</DialogHeader>

					<Separator className="my-5" />

					{hasShortage && report ? (
						<div className="space-y-5">
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border border-border bg-muted/30 p-4">
									<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Department</p>
									<p className="mt-2 text-lg font-semibold text-foreground">{report.department}</p>
								</div>
								<div className="rounded-2xl border border-border bg-muted/30 p-4">
									<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unassigned Sections</p>
									<p className="mt-2 text-lg font-semibold text-foreground">{report.unassignedSections}</p>
								</div>
								<div className="rounded-2xl border border-border bg-muted/30 p-4">
									<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours Still Needed</p>
									<p className="mt-2 text-lg font-semibold text-foreground">{report.missingHoursPerWeek} hrs/week</p>
								</div>
							</div>

							<div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
								<div className="flex items-start gap-3">
									<div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
										<Users2 className="size-5" />
									</div>
									<div className="space-y-2">
										<h3 className="text-base font-semibold text-foreground">Strategy 1: Maximize Current Staff</h3>
										<p className="text-sm leading-6 text-muted-foreground">
											We found staff in other departments who have not yet reached their 30-hour limit. You can manually assign them by enabling Teach Outside Department on their profiles.
										</p>
									</div>
								</div>

								<div className="mt-4 space-y-3">
									{report.internalCrossTrainees.length > 0 ? (
										report.internalCrossTrainees.map((item) => (
											<div
												key={item.department}
												className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white/90 px-4 py-3"
											>
												<div className="flex items-center gap-3">
													<Building2 className="size-4 text-amber-700" />
													<div>
														<p className="text-sm font-semibold text-foreground">{item.department}</p>
														<p className="text-xs text-muted-foreground">{item.availableTeachers} teachers available</p>
													</div>
												</div>
												<Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
													{item.totalSpareHours} spare hrs/week
												</Badge>
											</div>
										))
									) : (
										<p className="rounded-2xl border border-amber-200 bg-white/90 px-4 py-3 text-sm text-muted-foreground">
											No underloaded staff were found outside the shortage department.
										</p>
									)}
								</div>
							</div>

							<div className="rounded-3xl border border-sky-200 bg-sky-50/70 p-5">
								<div className="flex items-start gap-3">
									<div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
										<AlertTriangle className="size-5" />
									</div>
									<div className="space-y-2">
										<h3 className="text-base font-semibold text-foreground">Strategy 2: Request New Hires</h3>
										<p className="text-sm leading-6 text-muted-foreground">
											If your current staff cannot teach outside their specialization, you will need to request additional faculty from the Division Office.
										</p>
									</div>
								</div>

								<div className="mt-4 rounded-2xl border border-sky-200 bg-white/90 p-4 text-sm leading-6 text-foreground">
									To cover the remaining <span className="font-semibold">{report.unassignedSections} sections</span> ({report.missingHoursPerWeek} hours/week), you need to hire{' '}
									<span className="font-semibold">~{formatHires(report.recommendedNewHires)} additional full-time Science teachers</span>.
								</div>
							</div>
						</div>
					) : (
						<div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
							<div className="flex items-start gap-3">
								<div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
									<BadgeCheck className="size-5" />
								</div>
								<div className="space-y-2">
									<h3 className="text-base font-semibold text-foreground">All classes are assigned</h3>
									<p className="text-sm leading-6 text-muted-foreground">
										The schedule is fully covered and no teacher is over the allowed workload cap.
									</p>
								</div>
							</div>

							{hasResult && result ? (
								<div className="mt-4 grid gap-3 sm:grid-cols-3">
									<div className="rounded-2xl border border-emerald-200 bg-white/90 p-4">
										<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New Assignments</p>
										<p className="mt-2 text-lg font-semibold text-foreground">{result.assignmentsCreated}</p>
									</div>
									<div className="rounded-2xl border border-emerald-200 bg-white/90 p-4">
										<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teachers Affected</p>
										<p className="mt-2 text-lg font-semibold text-foreground">{result.uniqueTeachersAffected}</p>
									</div>
									<div className="rounded-2xl border border-emerald-200 bg-white/90 p-4">
										<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections Remaining</p>
										<p className="mt-2 text-lg font-semibold text-foreground">{report?.unassignedSections ?? 0}</p>
									</div>
								</div>
							) : null}
						</div>
					)}

					<DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 rounded-2xl px-5">
							Close
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}
