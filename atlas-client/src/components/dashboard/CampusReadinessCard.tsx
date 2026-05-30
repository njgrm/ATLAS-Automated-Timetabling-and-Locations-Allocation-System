import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, DoorOpen, MapPinned, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { CampusMapCanvasPreview } from '@/components/campus-map/CampusMapCanvasPreview';
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

function teachingRoomCount(building: Building): number {
	return (building.rooms ?? []).filter((room) => room.isTeachingSpace).length;
}

export function CampusReadinessCard({
	loading,
	buildings,
	teachingRoomCount: totalTeachingRooms,
	totalRoomCount,
	setupStatus,
}: CampusReadinessCardProps) {
	const teachingBuildings = buildings.filter((building) => building.isTeachingBuilding !== false);
	const attentionBuildings = teachingBuildings.filter((building) => teachingRoomCount(building) === 0);
	const selectedBuilding = attentionBuildings[0] ?? teachingBuildings[0] ?? buildings[0] ?? null;
	const selectedTeachingRooms = selectedBuilding ? teachingRoomCount(selectedBuilding) : 0;
	const readyCount = teachingBuildings.length - attentionBuildings.length;

	return (
		<Card className="overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-soft-xl">
			<CardContent className="p-0">
				{loading ? (
					<div className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
						<Skeleton className="h-72 rounded-2xl" />
						<div className="space-y-3">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-72" />
							<Skeleton className="h-9 w-44" />
						</div>
					</div>
				) : (
					<div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
						<div className="bg-stone-50 p-4">
							<CampusMapCanvasPreview
								buildings={buildings}
								selectedBuildingId={selectedBuilding?.id ?? null}
								height={292}
								compact
							/>
						</div>

						<div className="flex flex-col justify-between gap-5 p-6">
							<div>
								<div className="flex items-center gap-2">
									<div className="rounded-xl bg-primary/10 p-2.5 text-primary">
										<MapPinned className="size-5" />
									</div>
									<div>
										<p className="text-[0.7rem] font-bold uppercase text-primary">Campus readiness</p>
										<h3 className="text-lg font-bold text-slate-900">Buildings and rooms</h3>
									</div>
								</div>
								<p className="mt-3 text-sm leading-relaxed text-slate-500">
									Use the same campus map view before reviewing rooms or editing building details.
								</p>
								<div className="mt-4 grid grid-cols-2 gap-3">
									<MiniStat icon={Building2} label="Buildings" value={teachingBuildings.length.toString()} />
									<MiniStat icon={DoorOpen} label="Teaching rooms" value={`${totalTeachingRooms}/${totalRoomCount}`} />
								</div>
								<div className="mt-4 flex flex-wrap gap-1.5">
									<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
										<CheckCircle2 className="size-3" />
										{readyCount} ready
									</Badge>
									<Badge variant="outline" className={attentionBuildings.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}>
										<AlertTriangle className="size-3" />
										{setupStatus.done ? 'No room blockers' : setupStatus.subMessage ?? 'Needs review'}
									</Badge>
								</div>
							</div>

							<div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p className="text-xs font-semibold text-slate-500">Selected building</p>
								<p className="mt-1 truncate text-base font-bold text-slate-900">{selectedBuilding?.name ?? 'No building selected'}</p>
								<p className="mt-1 text-xs text-slate-500">
									{selectedBuilding ? `${selectedTeachingRooms} teaching room${selectedTeachingRooms === 1 ? '' : 's'} ready` : 'Open the map editor to draw buildings.'}
								</p>
							</div>

							<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
								<Button asChild className="h-11 justify-between rounded-xl bg-primary font-semibold text-primary-foreground shadow-primary-glow hover:bg-primary/90">
									<Link to="/map">
										Review campus map
										<ArrowRight className="size-4" />
									</Link>
								</Button>
								<Button asChild variant="outline" className="h-11 justify-between rounded-xl">
									<Link to="/map?mode=editor">
										Edit rooms
										<Pencil className="size-4" />
									</Link>
								</Button>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
	return (
		<div className="rounded-xl border border-slate-100 bg-white p-3">
			<Icon className="size-4 text-primary" />
			<p className="mt-2 text-[0.68rem] font-semibold uppercase text-slate-500">{label}</p>
			<p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
		</div>
	);
}
