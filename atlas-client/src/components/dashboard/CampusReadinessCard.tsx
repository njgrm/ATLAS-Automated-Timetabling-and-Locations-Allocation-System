import { Link } from 'react-router-dom';
import { ArrowRight, Building2, DoorOpen, MapPinned, Pencil } from 'lucide-react';

import type { BuildingSetupStatus } from '@/hooks/useDashboardData';
import type { Building } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

export type CampusReadinessCardProps = {
	loading: boolean;
	buildings: Building[];
	teachingRoomCount: number;
	totalRoomCount: number;
	setupStatus: BuildingSetupStatus;
};

type Chip = {
	key: string;
	label: string;
	tone: 'ready' | 'attention';
};

function buildChips(
	buildings: Building[],
	teachingRoomCount: number,
	totalRoomCount: number,
	setupStatus: BuildingSetupStatus,
): Chip[] {
	const chips: Chip[] = [];
	const teachingBuildings = buildings.filter((b) => b.isTeachingBuilding !== false);

	if (teachingBuildings.length > 0) {
		chips.push({
			key: 'buildings',
			label: `${teachingBuildings.length} teaching ${teachingBuildings.length === 1 ? 'building' : 'buildings'}`,
			tone: 'ready',
		});
	}
	if (teachingRoomCount > 0) {
		chips.push({
			key: 'rooms',
			label: `${teachingRoomCount} of ${totalRoomCount} rooms ready for teaching`,
			tone: 'ready',
		});
	}
	if (!setupStatus.done && setupStatus.subMessage) {
		chips.push({ key: 'attention', label: setupStatus.subMessage, tone: 'attention' });
	}
	if (chips.length === 0) {
		chips.push({ key: 'empty', label: 'No buildings yet', tone: 'attention' });
	}
	return chips.slice(0, 3);
}

export function CampusReadinessCard({
	loading,
	buildings,
	teachingRoomCount,
	totalRoomCount,
	setupStatus,
}: CampusReadinessCardProps) {
	const chips = buildChips(buildings, teachingRoomCount, totalRoomCount, setupStatus);
	const teachingBuildings = buildings.filter((b) => b.isTeachingBuilding !== false);

	return (
		<Card className='shadow-sm border-border'>
			<CardContent className='p-5'>
				{loading ? (
					<div className='space-y-3'>
						<Skeleton className='h-5 w-40' />
						<Skeleton className='h-4 w-72' />
						<Skeleton className='h-9 w-44' />
					</div>
				) : (
					<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
						<div className='flex items-start gap-3 min-w-0'>
							<div className='rounded-xl bg-emerald-50 text-emerald-700 p-3 shrink-0'>
								<MapPinned className='size-6' />
							</div>
							<div className='min-w-0'>
								<div className='flex items-center gap-2 flex-wrap'>
									<h3 className='text-base font-semibold tracking-tight text-foreground'>
										Campus and rooms
									</h3>
									<Badge variant='outline' className='text-[0.65rem] font-medium'>
										<Building2 className='mr-1 size-3' />
										{teachingBuildings.length} building{teachingBuildings.length === 1 ? '' : 's'}
									</Badge>
									<Badge variant='outline' className='text-[0.65rem] font-medium'>
										<DoorOpen className='mr-1 size-3' />
										{teachingRoomCount} teaching room{teachingRoomCount === 1 ? '' : 's'}
									</Badge>
								</div>
								<div className='mt-2 flex flex-wrap gap-1.5'>
									{chips.map((chip) => (
										<Badge
											key={chip.key}
											variant='outline'
											className={chip.tone === 'ready'
												? 'text-[0.7rem] border-emerald-200 bg-emerald-50 text-emerald-700'
												: 'text-[0.7rem] border-amber-200 bg-amber-50 text-amber-800'}
										>
											{chip.label}
										</Badge>
									))}
								</div>
							</div>
						</div>
						<div className='flex shrink-0 gap-2'>
							<Button asChild size='sm' className='h-9'>
								<Link to='/map'>
									Review campus map
									<ArrowRight className='ml-1 size-3.5' />
								</Link>
							</Button>
							<Button asChild size='sm' variant='outline' className='h-9'>
								<Link to='/map?mode=editor'>
									<Pencil className='mr-1 size-3.5' />
									Edit rooms
								</Link>
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
