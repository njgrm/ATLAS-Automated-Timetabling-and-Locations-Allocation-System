import { AlertTriangle, CheckCircle2, ClipboardCheck, MoreHorizontal, Save, UserRoundCheck, UsersRound } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type TeachingLoadTaskGuideProps = {
	unassignedPairs: number;
	overCapCount: number;
	activeDraftCount: number;
	totalPairs: number;
	assignedPairs: number;
	isReadOnly: boolean;
	saving: boolean;
	onShowUnassigned: () => void;
	onShowOverloaded: () => void;
	onShowUnloadedTeachers: () => void;
	onSaveDraft: () => void;
};

function formatPairCount(value: number) {
	if (value > 99) return '99+';
	return String(Math.max(0, value));
}

export function TeachingLoadTaskGuide({
	unassignedPairs,
	overCapCount,
	activeDraftCount,
	totalPairs,
	assignedPairs,
	isReadOnly,
	saving,
	onShowUnassigned,
	onShowOverloaded,
	onShowUnloadedTeachers,
	onSaveDraft,
}: TeachingLoadTaskGuideProps) {
	const hasBlockingWork = unassignedPairs > 0 || overCapCount > 0 || activeDraftCount > 0;
	const coveragePercent = totalPairs > 0 ? Math.round((assignedPairs / totalPairs) * 100) : 0;
	const nextLabel = activeDraftCount > 0
		? 'Save your draft changes'
		: unassignedPairs > 0
		? 'Fill missing teaching loads'
		: overCapCount > 0
		? 'Review overloaded teachers'
		: 'Teaching Load looks ready';
	const primaryFix = activeDraftCount > 0
		? { label: saving ? 'Saving...' : `Save ${activeDraftCount}`, icon: Save, onClick: onSaveDraft, disabled: saving || isReadOnly, variant: 'default' as const }
		: unassignedPairs > 0
		? { label: `${formatPairCount(unassignedPairs)} missing`, icon: ClipboardCheck, onClick: onShowUnassigned, disabled: false, variant: 'default' as const }
		: overCapCount > 0
		? { label: `${formatPairCount(overCapCount)} over cap`, icon: UsersRound, onClick: onShowOverloaded, disabled: false, variant: 'secondary' as const }
		: { label: 'Review teachers', icon: UserRoundCheck, onClick: onShowUnloadedTeachers, disabled: false, variant: 'outline' as const };
	const PrimaryIcon = primaryFix.icon;

	return (
		<section
			data-testid="teaching-load-task-guide"
			className="shrink-0 border-b border-border/40 bg-primary/[0.03] px-2.5 py-1 lg:px-4"
			aria-label="Teaching Load next task guide"
		>
			<div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
				<div className="flex shrink-0 items-center gap-2">
					<div className={cn(
						'flex size-7 shrink-0 items-center justify-center rounded-full border',
						hasBlockingWork ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
					)}>
						{hasBlockingWork ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
					</div>
					<div className="min-w-0">
						<p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Fix first</p>
						<p data-testid="teaching-load-next-action" className="max-w-[12rem] truncate text-sm font-bold text-foreground sm:max-w-[15rem]">{nextLabel}</p>
					</div>
					<Badge variant="outline" className="hidden h-7 rounded-full border-primary/15 bg-background px-2.5 text-xs font-semibold text-primary sm:inline-flex">
						{coveragePercent}% staffed
					</Badge>
				</div>

				<div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
					<Button
						type="button"
						variant={primaryFix.variant}
						size="sm"
						className="h-8 shrink-0 gap-2 font-bold"
						onClick={primaryFix.onClick}
						disabled={primaryFix.disabled}
					>
						<PrimaryIcon className="size-4" />
						{primaryFix.label}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" size="icon-sm" className="size-8" aria-label="More Teaching Load fixes">
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuItem onSelect={onShowUnassigned} className="gap-2 font-semibold">
								<ClipboardCheck className="size-4" />
								{formatPairCount(unassignedPairs)} missing loads
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onShowOverloaded} className="gap-2 font-semibold">
								<UsersRound className="size-4" />
								{formatPairCount(overCapCount)} over cap
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onShowUnloadedTeachers} className="gap-2 font-semibold">
								<UserRoundCheck className="size-4" />
								Teachers without load
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</section>
	);
}
