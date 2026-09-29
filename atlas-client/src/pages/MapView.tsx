import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage, Text } from 'react-konva';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';

import type { Building } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Skeleton } from '@/ui/skeleton';
// A9 m1 — the framing and the background are the SHARED ones. The fixed
// `CANVAS_WIDTH = 920` / `CANVAS_HEIGHT = 580` and the `scale`/`position` state
// that this page kept for itself are gone; see the file header.
import { backgroundWorld, fitViewTransform, nextBackgroundZoom } from '@/components/campus-map/campusMapBackground';
import { CampusMapBackgroundLayer, useCampusImage, viewerPlacement } from '@/components/campus-map/CampusMapBackgroundLayer';
import { CampusMapZoomControls } from '@/components/campus-map/CampusMapZoomControls';
import { fetchCampusBackground } from '@/lib/campus-background-api';

/**
 * A9 m1 — the read-only campus map page.
 *
 * WHAT WAS WRONG HERE. This page declared `CANVAS_WIDTH = 920` and
 * `CANVAS_HEIGHT = 580` as module constants, multiplied them by a `scale` state
 * that ran 0.4–2.5, and painted the buildings inside a `Stage` with NO photo at
 * all — so this view showed a bare beige rectangle whatever the operator had
 * uploaded. Three surfaces, three private copies of the world (this page, the
 * overview preview, and the editor), which is how a school ended up with a
 * background visible in one place and absent in another.
 *
 * IT IS NOW THE SHARED FRAMING. The world is the union of the measured box, the
 * buildings and the photo; the view is `fitViewTransform`, which is the editor's
 * own function; the zoom cluster, its range and its "75%" readout are the same
 * component the editor uses. A school with no stored placement gets the same
 * "fit whole image, locked" default as everywhere else.
 */
const DEFAULT_SCHOOL_ID = 1;
const UNMEASURED_WORLD = { width: 920, height: 580 };

export default function MapView() {
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [storedPlacement, setStoredPlacement] = useState<unknown>(null);
	const [loading, setLoading] = useState(true);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [zoom, setZoom] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const boxRef = useRef<HTMLDivElement>(null);
	const [box, setBox] = useState({ width: UNMEASURED_WORLD.width, height: UNMEASURED_WORLD.height });

	useEffect(() => {
		setLoading(true);
		// The photo and its placement come from ONE call, so this page cannot show
		// a background framed by a placement it never received.
		Promise.all([
			atlasApiBuildings(),
			fetchCampusBackground(DEFAULT_SCHOOL_ID).catch(() => ({ campusImageUrl: null, campusMapPlacement: null })),
		])
			.then(([buildingList, background]) => {
				setBuildings(buildingList);
				setCampusImageUrl(background.campusImageUrl);
				setStoredPlacement(background.campusMapPlacement);
			})
			.catch(() => {
				setBuildings([]);
				setCampusImageUrl(null);
			})
			.finally(() => setLoading(false));
	}, []);

	// The box is MEASURED, not assumed. The old page hard-coded 920x580 and then
	// multiplied it, which is exactly the arithmetic the shared fit replaces.
	useEffect(() => {
		const element = boxRef.current;
		if (!element) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect?.width) setBox((current) => ({ ...current, width: Math.floor(rect.width) }));
			if (rect?.height) setBox((current) => ({ ...current, height: Math.floor(rect.height) }));
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const campusImage = useCampusImage(campusImageUrl);
	const world = useMemo(() => {
		const placement = viewerPlacement(storedPlacement, campusImage, box);
		return backgroundWorld(placement, buildings, box);
	}, [storedPlacement, campusImage, box, buildings]);
	const placement = useMemo(
		() => viewerPlacement(storedPlacement, campusImage, world),
		[storedPlacement, campusImage, world],
	);
	// The free area the world is fitted into, named the way the shared function
	// wants it, so this page cannot invent its own notion of "the box".
	const fitBox = useMemo(() => ({ freeWidth: box.width, freeHeight: box.height }), [box.width, box.height]);
	const view = useMemo(
		() => fitViewTransform({ content: world, box: fitBox, zoom, pan: position }),
		[world, fitBox, zoom, position],
	);

	const clampPosition = useCallback(
		(next: { x: number; y: number }, atZoom: number) => {
			const transform = fitViewTransform({ content: world, box: fitBox, zoom: atZoom, pan: next });
			return { x: transform.x, y: transform.y };
		},
		[world, box],
	);

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
					<p className="text-sm text-muted-foreground">
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
				{/* Toolbar. A9 m1: the three hand-rolled "Zoom In" / "Zoom Out" /
				    "Reset" buttons with their own 0.4-2.5 arithmetic are replaced by
				    the shared cluster, so this page zooms exactly like the editor and
				    the overview and says the percentage in words. */}
				<div className="mb-2 flex items-center gap-2">
					<CampusMapZoomControls
						zoom={zoom}
						onZoomIn={() => setZoom((z) => nextBackgroundZoom(z, 0.15))}
						onZoomOut={() => setZoom((z) => nextBackgroundZoom(z, -0.15))}
						onReset={() => {
							setZoom(1);
							setPosition({ x: 0, y: 0 });
							setSelectedId(null);
						}}
						label="campus map"
					/>
					<span className="ml-auto text-sm text-muted-foreground">Read-only view</span>
				</div>

				{/* Canvas */}
				<div ref={boxRef} className="h-[580px] overflow-hidden rounded-md border border-border">
					<Stage
						width={box.width}
						height={box.height}
						draggable
						x={view.x}
						y={view.y}
						scaleX={view.scale}
						scaleY={view.scale}
						onDragEnd={(e) => setPosition(clampPosition({ x: e.target.x(), y: e.target.y() }, zoom))}
						dragBoundFunc={(next) => clampPosition(next, zoom)}
					>
						<Layer>
							{/* A9 m1: the shared background layer. This page painted a bare
							    beige rect whatever the operator had uploaded; it now shows
							    the same photo, at the same framing, as every other map. */}
							<CampusMapBackgroundLayer
								image={campusImage}
								placement={placement}
								world={world}
								cornerRadius={8}
							/>
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
						<p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
							Rooms
						</p>
						<ul className="mt-1.5 space-y-1">
							{selected.rooms.map((room) => (
								<li key={room.id} className="flex items-center gap-2 text-sm text-foreground">
									<span className="size-1.5 shrink-0 rounded-full bg-primary" />
									<span className="flex-1">{room.name}</span>
									<Badge variant="outline" className="px-1 py-0 text-xs">
										{room.type?.replace(/_/g, ' ') ?? 'Classroom'}
									</Badge>
									{room.capacity && (
										<span className="text-xs text-muted-foreground">
											Cap: {room.capacity}
										</span>
									)}
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="mt-3 text-xs text-muted-foreground">
						Select a building to inspect rooms and details.
					</p>
				)}
			</div>
		</div>
	);
}

/** The buildings read, isolated so the placement read cannot mask a failure. */
async function atlasApiBuildings(): Promise<Building[]> {
	const { default: atlasApi } = await import('@/lib/api');
	const res = await atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`);
	return res.data.buildings;
}
