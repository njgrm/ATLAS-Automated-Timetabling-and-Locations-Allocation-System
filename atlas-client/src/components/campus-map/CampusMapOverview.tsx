import { CheckCircle2, AlertTriangle, MapPinned, DoorOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Building } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';

export type CampusMapOverviewProps = {
	buildings: Building[];
	campusImageUrl: string | null;
};

function buildingStatus(b: Building): 'ready' | 'attention' {
	const teaching = (b.rooms ?? []).filter((r) => r.isTeachingSpace).length;
	return teaching > 0 ? 'ready' : 'attention';
}

export function CampusMapOverview({ buildings, campusImageUrl }: CampusMapOverviewProps) {
	const totalRooms = buildings.reduce((acc, b) => acc + (b.rooms?.length ?? 0), 0);
	const teachingRooms = buildings.reduce(
		(acc, b) => acc + (b.rooms ?? []).filter((r) => r.isTeachingSpace).length,
		0,
	);
	const readyCount = buildings.filter((b) => buildingStatus(b) === 'ready').length;
	const attentionCount = buildings.length - readyCount;

	return (
		<div className="h-[calc(100svh-3.5rem)] overflow-auto bg-linear-to-b from-emerald-50/30 via-background to-background scrollbar-thin">
			<div className="mx-auto w-full max-w-5xl space-y-6 p-6">
				<header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
							Scheduling Portal
						</p>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
							Campus and rooms
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Review buildings, teaching rooms, and home-room readiness for the active school year.
						</p>
					</div>
					<div className="flex gap-2">
						<Button asChild variant="outline" size="sm">
							<Link to="/map?mode=editor">Edit rooms</Link>
						</Button>
						<Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
							<Link to="/map?mode=editor" aria-label="Open the campus map editor">
								<MapPinned className="size-3.5" /> Edit campus map
							</Link>
						</Button>
					</div>
				</header>

				<Card className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
					<SummaryStat label="Buildings" value={buildings.length.toString()} />
					<SummaryStat label="Teaching rooms" value={`${teachingRooms} / ${totalRooms}`} />
					<SummaryStat
						label="Ready"
						value={readyCount.toString()}
						tone={readyCount > 0 ? 'ready' : 'neutral'}
					/>
					<SummaryStat
						label="Need attention"
						value={attentionCount.toString()}
						tone={attentionCount > 0 ? 'attention' : 'neutral'}
					/>
				</Card>

				<section className="space-y-3">
					<h2 className="text-sm font-semibold text-foreground">Buildings</h2>
					{buildings.length === 0 ? (
						<Card className="p-8 text-center text-sm text-muted-foreground">
							<MapPinned className="mx-auto mb-2 size-8 text-muted-foreground/40" />
							<p>No buildings added yet. Open the editor to draw your first building.</p>
							<Button asChild size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-700">
								<Link to="/map?mode=editor">Open editor</Link>
							</Button>
						</Card>
					) : (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{buildings.map((b) => {
								const status = buildingStatus(b);
								const teachingCount = (b.rooms ?? []).filter((r) => r.isTeachingSpace).length;
								const totalCount = b.rooms?.length ?? 0;
								return (
									<Card key={b.id} className="space-y-2 p-4">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold text-foreground">{b.name}</p>
												{b.shortCode && (
													<p className="text-[11px] uppercase tracking-wider text-muted-foreground">
														{b.shortCode}
													</p>
												)}
											</div>
											{status === 'ready' ? (
												<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
													<CheckCircle2 className="size-3" /> Ready
												</Badge>
											) : (
												<Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
													<AlertTriangle className="size-3" /> Needs rooms
												</Badge>
											)}
										</div>
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
											<DoorOpen className="size-3.5" />
											{teachingCount} teaching of {totalCount} room{totalCount === 1 ? '' : 's'}
										</div>
									</Card>
								);
							})}
						</div>
					)}
				</section>

				{campusImageUrl && (
					<p className="text-xs text-muted-foreground">A campus photo is already uploaded.</p>
				)}
			</div>
		</div>
	);
}

function SummaryStat({
	label,
	value,
	tone = 'neutral',
}: {
	label: string;
	value: string;
	tone?: 'ready' | 'attention' | 'neutral';
}) {
	const cls = tone === 'ready'
		? 'text-emerald-700'
		: tone === 'attention'
			? 'text-amber-700'
			: 'text-foreground';
	return (
		<div>
			<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
			<p className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>{value}</p>
		</div>
	);
}
