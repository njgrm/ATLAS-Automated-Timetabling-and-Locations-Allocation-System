import { Zap } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

type OverviewHeaderProps = {
	assignedPairs: number;
	totalPairs: number;
	assignedFacultyCount: number;
	totalFacultyCount: number;
	activeDraftCount: number;
	autoFillLoading: boolean;
	autoFillEnabled: boolean;
	onAutoFillClick: () => void;
};

export function OverviewHeader({
	assignedPairs,
	totalPairs,
	assignedFacultyCount,
	totalFacultyCount,
	activeDraftCount,
	autoFillLoading,
	autoFillEnabled,
	onAutoFillClick,
}: OverviewHeaderProps) {
	return (
		<div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-sm">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span className="font-semibold text-foreground">Teaching Load Overview</span>
				<Badge variant="secondary" className="text-[0.625rem]">
					{assignedPairs} / {totalPairs} assigned
				</Badge>
				<Badge variant="outline" className="text-[0.625rem]">
					{assignedFacultyCount} / {totalFacultyCount} faculty assigned
				</Badge>
				{activeDraftCount > 0 && (
					<Badge className="border-sky-200 bg-sky-50 text-[0.625rem] text-sky-700">
						{activeDraftCount} draft{activeDraftCount === 1 ? '' : 's'}
					</Badge>
				)}
			</div>
			<Button type="button" variant="outline" size="sm" onClick={onAutoFillClick} disabled={autoFillLoading || !autoFillEnabled}>
				<Zap className="mr-1.5 size-3.5" />
				{autoFillLoading ? 'Running...' : 'Auto-Fill Remaining'}
			</Button>
		</div>
	);
}
