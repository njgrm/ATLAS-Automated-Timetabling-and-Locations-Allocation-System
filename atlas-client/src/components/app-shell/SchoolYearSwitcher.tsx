import { CalendarDays, ChevronsUpDown } from 'lucide-react';

import type { SchoolYear } from '@/lib/settings';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export type SchoolYearSwitcherProps = {
	schoolYears: SchoolYear[];
	selectedYearId: number | null;
	open: boolean;
	onToggle: () => void;
	onSelect: (sy: SchoolYear) => void;
};

export function SchoolYearSwitcher({
	schoolYears,
	selectedYearId,
	open,
	onToggle,
	onSelect,
}: SchoolYearSwitcherProps) {
	if (schoolYears.length === 0) return null;

	const selectedLabel = schoolYears.find((y) => y.id === selectedYearId)?.yearLabel ?? 'No Year';

	return (
		<div className='relative'>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant='outline'
							size='sm'
							className='h-8 gap-1.5 text-xs font-medium'
							onClick={onToggle}
							aria-haspopup='listbox'
							aria-expanded={open}
						>
							<CalendarDays className='size-3.5' />
							<span>{selectedLabel}</span>
							<ChevronsUpDown className='size-3 opacity-50' />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Switch School Year</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			{open && (
				<>
					<div className='fixed inset-0 z-40' onClick={onToggle} />
					<div className='absolute right-0 top-full z-50 mt-1 min-w-45 rounded-md border border-border bg-popover p-1 shadow-md'>
						{schoolYears.map((sy) => (
							<button
								key={sy.id}
								type='button'
								onClick={() => onSelect(sy)}
								className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${
									sy.id === selectedYearId
										? 'bg-accent text-accent-foreground'
										: 'hover:bg-sidebar-accent hover:text-accent-foreground'
								}`}
							>
								<span className='flex-1 text-left'>{sy.yearLabel}</span>
								<span className={`rounded px-1 py-0.5 text-[0.625rem] font-medium ${
									sy.isActive
										? 'bg-emerald-100 text-emerald-700'
										: (sy.status === 'UPCOMING'
											? 'bg-sky-100 text-sky-700'
											: sy.status === 'DRAFT'
												? 'bg-amber-100 text-amber-700'
												: 'bg-gray-100 text-gray-500')
								}`}>
									{sy.isActive ? 'ACTIVE' : (sy.status ?? 'CLOSED')}
								</span>
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}
