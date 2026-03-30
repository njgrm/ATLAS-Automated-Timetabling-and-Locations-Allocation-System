import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	CalendarClock,
	ClipboardList,
	MapPinned,
	Pencil,
	Users,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import type { Building } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { Button } from '@/ui/button';

const DEFAULT_SCHOOL_ID = 1;

type StatCard = {
	title: string;
	value: string;
	icon: typeof CalendarClock;
	color: string;
	bg: string;
};

export default function Dashboard() {
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		atlasApi
			.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`)
			.then((res) => setBuildings(res.data.buildings))
			.catch(() => setBuildings([]))
			.finally(() => setLoading(false));
	}, []);

	const totalRooms = useMemo(() => buildings.reduce((sum, b) => sum + b.rooms.length, 0), [buildings]);

	const statCards: StatCard[] = useMemo(
		() => [
			{ title: 'Published Classes', value: '—', icon: CalendarClock, color: 'text-blue-600', bg: 'bg-blue-50' },
			{ title: 'Active Faculty', value: '—', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
			{ title: 'Buildings', value: String(buildings.length), icon: MapPinned, color: 'text-amber-600', bg: 'bg-amber-50' },
			{ title: 'Rooms', value: String(totalRooms), icon: ClipboardList, color: 'text-violet-600', bg: 'bg-violet-50' },
		],
		[buildings, totalRooms],
	);

	return (
		<div className="px-6 py-4">
			{/* Section heading */}
			<div className="mb-4 flex items-center gap-3">
				<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
					Overview
				</h2>
				<div className="h-px flex-1 bg-sidebar-accent" />
			</div>

			{/* Stats grid */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{statCards.map((stat) => (
					<Card key={stat.title} className="shadow-sm">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-xs font-bold uppercase text-muted-foreground">
								{stat.title}
							</CardTitle>
							<div className={`${stat.bg} rounded-md p-2`}>
								<stat.icon className={`h-4 w-4 ${stat.color}`} />
							</div>
						</CardHeader>
						<CardContent>
							{loading ? (
								<Skeleton className="h-8 w-20" />
							) : (
								<div className="text-2xl font-black">{stat.value}</div>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			{/* Quick Actions */}
			<div className="mt-6 flex items-center gap-3">
				<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
					Quick Actions
				</h2>
				<div className="h-px flex-1 bg-sidebar-accent" />
			</div>

			<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<Card className="shadow-sm">
					<CardContent className="pt-6">
						<div className="flex items-start gap-3">
							<div className="rounded-md bg-blue-50 p-2.5">
								<MapPinned className="size-5 text-blue-600" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold">Campus Map</p>
								<p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
									View building layout and room assignments.
								</p>
								<Button asChild variant="outline" size="sm" className="mt-3">
									<Link to="/map">View Map</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="shadow-sm">
					<CardContent className="pt-6">
						<div className="flex items-start gap-3">
							<div className="rounded-md bg-emerald-50 p-2.5">
								<Pencil className="size-5 text-emerald-600" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold">Map Editor</p>
								<p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
									Add buildings, resize, and manage rooms.
								</p>
								<Button asChild variant="outline" size="sm" className="mt-3">
									<Link to="/map/editor">Open Editor</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="shadow-sm">
					<CardContent className="pt-6">
						<div className="flex items-start gap-3">
							<div className="rounded-md bg-amber-50 p-2.5">
								<Users className="size-5 text-amber-600" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold">Faculty Import</p>
								<p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
									Coming soon — import faculty records via API or CSV.
								</p>
								<Button variant="outline" size="sm" className="mt-3" disabled>
									Coming Soon
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
