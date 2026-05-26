import { Fragment, useCallback, useMemo, useState } from 'react';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import type { Building } from '../types';

type CampusMapProps = {
	buildings: Building[];
	activeBuildingId: number | null;
	onSelect: (buildingId: number | null) => void;
	/** Map of buildingId -> occupancy percentage (0-100) */
	buildingOccupancy?: Map<number, number>;
};

const DEPED_COLORS = {
	roof: '#95d1af',
	roofStroke: '#6fb890',
	walls: '#f1edca',
} as const;

export function CampusMap({ buildings, activeBuildingId, onSelect, buildingOccupancy }: CampusMapProps) {
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	const active = useMemo(
		() => buildings.find((b) => b.id === activeBuildingId) ?? null,
		[buildings, activeBuildingId],
	);

	const getOccupancyColor = (pct: number) => {
		if (pct >= 90) return '#dc2626'; // Red
		if (pct >= 70) return '#ea580c'; // Orange
		if (pct >= 50) return '#ca8a04'; // Yellow
		return '#16a34a'; // Green
	};

	return (
		<div className="h-full flex flex-col">
			{/* Toolbar */}
			<div className="shrink-0 mb-3 flex items-center gap-1.5 px-4 pt-4">
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition-all shadow-sm"
					onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}
				>
					<Plus className="size-3.5" /> Zoom In
				</button>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition-all shadow-sm"
					onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}
				>
					<Minus className="size-3.5" /> Zoom Out
				</button>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition-all shadow-sm"
					onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
				>
					<RotateCcw className="size-3.5" /> Reset
				</button>
				<div className="h-4 w-px bg-border mx-2" />
				<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Campus Map View</span>
			</div>

			{/* Canvas */}
			<div className="flex-1 overflow-hidden relative bg-slate-50 shadow-inner">
				<Stage
					width={920}
					height={520}
					draggable
					x={position.x}
					y={position.y}
					scaleX={scale}
					scaleY={scale}
					onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
					style={{ cursor: 'grab' }}
				>
					<Layer>
						<Rect x={-2000} y={-2000} width={4000} height={4000} fill="hsl(40 30% 95%)" />
						{buildings.map((b) => {
							const isSelected = active?.id === b.id;
							const occupancy = buildingOccupancy?.get(b.id) ?? 0;
							const occColor = getOccupancyColor(occupancy);
							
							return (
								<Group 
									key={b.id} 
									x={b.x} y={b.y} 
									rotation={b.rotation ?? 0}
									onClick={() => onSelect(b.id)}
									onTap={() => onSelect(b.id)}
								>
									{/* Building Shadow */}
									<Rect
										x={4} y={4}
										width={b.width} height={b.height}
										fill="rgba(0,0,0,0.08)"
										cornerRadius={8}
										listening={false}
									/>
									{/* Building Body */}
									<Rect
										width={b.width} height={b.height}
										fill={b.color}
										opacity={isSelected ? 1 : 0.85}
										cornerRadius={8}
										stroke={isSelected ? '#111827' : '#ffffff'}
										strokeWidth={isSelected ? 4 : 2}
										shadowColor="rgba(0,0,0,0.15)"
										shadowBlur={isSelected ? 10 : 4}
										shadowOffsetY={2}
									/>
									
									{/* Name on Roof */}
									<Text
										x={8} y={8}
										width={b.width - 16}
										text={b.name}
										fontSize={Math.max(10, b.width / 8)} 
										fill="#ffffff" 
										fontStyle="bold"
										align="center"
										listening={false}
									/>

									{/* Occupancy Indicator */}
									<Group x={6} y={b.height - 18}>
										<Rect
											width={b.width - 12}
											height={12}
											fill="rgba(255,255,255,0.2)"
											cornerRadius={4}
										/>
										{occupancy > 0 && (
											<Rect
												width={(b.width - 12) * (occupancy / 100)}
												height={12}
												fill={occColor}
												cornerRadius={4}
												opacity={0.9}
											/>
										)}
										<Text
											x={0} y={2.5}
											width={b.width - 12}
											text={`${Math.round(occupancy)}% FILLED`}
											fontSize={7}
											fontStyle="black"
											fill="#ffffff"
											align="center"
											listening={false}
										/>
									</Group>
								</Group>
							);
						})}
					</Layer>
				</Stage>
			</div>
		</div>
	);
}
