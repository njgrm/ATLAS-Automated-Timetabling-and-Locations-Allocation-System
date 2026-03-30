import { Fragment, useEffect, useMemo, useState } from 'react';
import { Layer, Rect, Stage, Text } from 'react-konva';
import { Link } from 'react-router-dom';
import { Minus, Pencil, Plus, RotateCcw } from 'lucide-react';

import atlasApi from '@/lib/api';
import type { Building } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;
const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 580;

export default function MapView() {
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	useEffect(() => {
		setLoading(true);
		atlasApi
			.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`)
			.then((res) => setBuildings(res.data.buildings))
			.catch(() => setBuildings([]))
			.finally(() => setLoading(false));
	}, []);

	const selected = useMemo(
		() => buildings.find((b) => b.id === selectedId) ?? null,
		[buildings, selectedId],
	);

	if (loading) {
		return (
			<div className="p-6">
				<Skeleton className="h-[600px] w-full rounded-lg" />
			</div>
		);
	}

	return (
		<div className="px-6 py-4">
			<div className="mb-3 flex items-center justify-between">
				<div>
					<h2 className="text-lg font-bold">Campus Map</h2>
					<p className="text-[0.8125rem] text-muted-foreground">
						View building locations and room assignments. Select a building for details.
					</p>
				</div>
				<Button asChild variant="outline" size="sm">
					<Link to="/map/editor">
						<Pencil className="size-3.5" /> Edit Map
					</Link>
				</Button>
			</div>

			<div className="rounded-lg border border-border bg-card p-3 shadow-sm">
				{/* Toolbar */}
				<div className="mb-2 flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}>
						<Plus className="size-3.5" /> Zoom In
					</Button>
					<Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}>
						<Minus className="size-3.5" /> Zoom Out
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setScale(1);
							setPosition({ x: 0, y: 0 });
							setSelectedId(null);
						}}
					>
						<RotateCcw className="size-3.5" /> Reset
					</Button>
					<span className="ml-auto text-[0.6875rem] text-muted-foreground">
						{Math.round(scale * 100)}% • Read-only view
					</span>
				</div>

				{/* Canvas */}
				<div className="overflow-hidden rounded-md border border-border">
					<Stage
						width={CANVAS_WIDTH}
						height={CANVAS_HEIGHT}
						draggable
						x={position.x}
						y={position.y}
						scaleX={scale}
						scaleY={scale}
						onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
					>
						<Layer>
							<Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="hsl(40 30% 95%)" cornerRadius={8} />
							{buildings.map((b) => {
								const isSelected = selectedId === b.id;
								return (
									<Fragment key={b.id}>
										<Rect
											x={b.x}
											y={b.y}
											width={b.width}
											height={b.height}
											fill={b.color}
											opacity={isSelected ? 0.95 : 0.78}
											cornerRadius={8}
											stroke={isSelected ? '#111827' : '#ffffff'}
											strokeWidth={isSelected ? 4 : 2}
											shadowColor="rgba(0,0,0,0.1)"
											shadowBlur={3}
											shadowOffsetY={1}
											onClick={() => setSelectedId(b.id)}
										/>
										<Text
											x={b.x + 10}
											y={b.y + 12}
											text={b.name}
											fontSize={14}
											fill="#ffffff"
											fontStyle="bold"
											width={b.width - 20}
											ellipsis
											wrap="none"
										/>
										<Text
											x={b.x + 10}
											y={b.y + b.height - 24}
											text={`${b.rooms.length} room${b.rooms.length !== 1 ? 's' : ''}`}
											fontSize={11}
											fill="rgba(255,255,255,0.8)"
										/>
									</Fragment>
								);
							})}
						</Layer>
					</Stage>
				</div>

				{/* Inspector */}
				{selected ? (
					<div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
						<p className="text-sm font-bold text-foreground">{selected.name}</p>
						<p className="mt-1 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							Rooms
						</p>
						<ul className="mt-1.5 space-y-1">
							{selected.rooms.map((room) => (
								<li key={room.id} className="flex items-center gap-2 text-sm text-foreground">
									<span className="size-1.5 shrink-0 rounded-full bg-primary" />
									<span className="flex-1">{room.name}</span>
									<Badge variant="outline" className="text-[0.6rem] px-1 py-0">
										{room.type?.replace(/_/g, ' ') ?? 'Classroom'}
									</Badge>
									{room.capacity && (
										<span className="text-[0.6875rem] text-muted-foreground">
											Cap: {room.capacity}
										</span>
									)}
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="mt-3 text-[0.8125rem] text-muted-foreground">
						Select a building to inspect rooms and details.
					</p>
				)}
			</div>
		</div>
	);
}
