import { Fragment, useMemo, useState } from 'react';
import { Layer, Rect, Stage, Text } from 'react-konva';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import type { Building } from '../types';

type CampusMapProps = {
	buildings: Building[];
	activeBuildingId: number | null;
	onSelect: (buildingId: number | null) => void;
};

export function CampusMap({ buildings, activeBuildingId, onSelect }: CampusMapProps) {
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	const active = useMemo(
		() => buildings.find((b) => b.id === activeBuildingId) ?? null,
		[buildings, activeBuildingId],
	);

	return (
		<div className="rounded-lg border border-border bg-card p-3 shadow-sm">
			{/* Toolbar */}
			<div className="mb-2 flex items-center gap-2">
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
					onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}
				>
					<Plus className="size-3.5" /> Zoom In
				</button>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
					onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}
				>
					<Minus className="size-3.5" /> Zoom Out
				</button>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
					onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); onSelect(null); }}
				>
					<RotateCcw className="size-3.5" /> Reset
				</button>
				<span className="ml-auto text-[0.6875rem] text-muted-foreground">Published Overlay Preview</span>
			</div>

			{/* Canvas */}
			<div className="overflow-auto rounded-md border border-border">
				<Stage
					width={920}
					height={520}
					draggable
					x={position.x}
					y={position.y}
					scaleX={scale}
					scaleY={scale}
					onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
				>
					<Layer>
						<Rect x={0} y={0} width={920} height={520} fill="hsl(40 30% 95%)" cornerRadius={8} />
						{buildings.map((b) => {
							const selected = active?.id === b.id;
							return (
								<Fragment key={b.id}>
									<Rect
										x={b.x} y={b.y} width={b.width} height={b.height}
										fill={b.color}
										opacity={selected ? 0.95 : 0.78}
										cornerRadius={8}
										stroke={selected ? '#111827' : '#ffffff'}
										strokeWidth={selected ? 4 : 2}
										onClick={() => onSelect(b.id)}
									/>
									<Text
										x={b.x + 10} y={b.y + 12}
										text={b.name}
										fontSize={16} fill="#ffffff" fontStyle="bold"
									/>
								</Fragment>
							);
						})}
					</Layer>
				</Stage>
			</div>

			{/* Inspector */}
			{active ? (
				<div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
					<p className="text-sm font-bold text-foreground">{active.name}</p>
					<p className="mt-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">Rooms</p>
					<ul className="mt-1 space-y-0.5 text-sm text-foreground">
						{active.rooms.map((room) => (
							<li key={room.id} className="flex items-center gap-1.5">
								<span className="size-1.5 rounded-full bg-primary" />
								{room.name}
							</li>
						))}
					</ul>
				</div>
			) : (
				<p className="mt-3 text-[0.8125rem] text-muted-foreground">
					Select a building to inspect rooms and active class blocks.
				</p>
			)}
		</div>
	);
}
