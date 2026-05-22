import { ChartColumn, Zap } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

type OverviewHeaderProps = {
	assignedPairs: number;
	totalPairs: number;
	assignedFacultyCount: number;
	totalFacultyCount: number;
	activeDraftCount: number;
	autoFillLoading: boolean;
	staffingNeedsLoading: boolean;
	autoFillEnabled: boolean;
	resetLoading: boolean;
	onAutoFillClick: () => void;
	onViewStaffingNeedsClick: () => void;
	onResetGlobalClick: () => void;
};

export function OverviewHeader({
	assignedPairs,
	totalPairs,
	assignedFacultyCount,
	totalFacultyCount,
	activeDraftCount,
	autoFillLoading,
	staffingNeedsLoading,
	autoFillEnabled,
	resetLoading,
	onAutoFillClick,
	onViewStaffingNeedsClick,
	onResetGlobalClick,
}: OverviewHeaderProps) {
	return (
		<div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-sm">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span className="font-semibold text-foreground">Teaching Load Overview</span>
				<Badge variant="secondary" className="text-[0.625rem]">
					{assignedPairs} / {totalPairs} assigned
				</Badge>
				<Badge variant="outline" className="text-[0.625rem]">
					{assignedFacultyCount} / {totalFacultyCount} teachers assigned
				</Badge>
				{activeDraftCount > 0 && (
					<Badge className="border-sky-200 bg-sky-50 text-[0.625rem] text-sky-700">
						{activeDraftCount} draft{activeDraftCount === 1 ? '' : 's'}
					</Badge>
				)}
			</div>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onResetGlobalClick}
					disabled={resetLoading || !autoFillEnabled}
					className="whitespace-nowrap border-red-300 text-red-700 hover:bg-red-50"
				>
					{resetLoading ? 'Preparing...' : 'Reset Global Load'}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onViewStaffingNeedsClick}
					disabled={staffingNeedsLoading || !autoFillEnabled}
					className="whitespace-nowrap"
				>
					<ChartColumn className="mr-1.5 size-3.5" />
					{staffingNeedsLoading ? 'Checking...' : 'View Staffing Needs'}
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={onAutoFillClick} disabled={autoFillLoading || !autoFillEnabled} className="whitespace-nowrap">
					<Zap className="mr-1.5 size-3.5" />
					{autoFillLoading ? 'Running...' : 'Auto-Fill Remaining'}
				</Button>
			</div>
		</div>
	);
}
