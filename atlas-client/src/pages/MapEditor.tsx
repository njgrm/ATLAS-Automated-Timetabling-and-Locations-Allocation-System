import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPinned, MousePointer2, Pencil } from 'lucide-react';

import { CampusMapOverview } from '@/components/campus-map/CampusMapOverview';
import { SmartHelpTrigger } from '@/components/smart/SmartPageShell';
import atlasApi from '@/lib/api';
import type { Building, Room } from '@/types';
import { Button } from '@/ui/button';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };

const DEFAULT_SCHOOL_ID = 1;

const MAX_HISTORY = 30;
const CampusMapEditor = lazy(() => import('@/components/CampusMapEditor').then((module) => ({ default: module.CampusMapEditor })));
const BuildingPanel = lazy(() => import('@/components/BuildingPanel').then((module) => ({ default: module.BuildingPanel })));

export default function MapEditor() {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const queryBuildingId = searchParams.get('buildingId');
	const rawMode = searchParams.get('mode');
	const mode: 'overview' | 'editor' = rawMode === 'editor' ? 'editor' : 'overview';

	const [buildings, setBuildings] = useState<EditorBuilding[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const initialLoadDone = useRef(false);
	const selectedIdRef = useRef(selectedId);
	selectedIdRef.current = selectedId;

	// Undo / Redo stacks
	const [historyStack, setHistoryStack] = useState<EditorBuilding[][]>([]);
	const [redoStack, setRedoStack] = useState<EditorBuilding[][]>([]);
	const buildingsRef = useRef(buildings);
	buildingsRef.current = buildings;

	const handlePushHistory = useCallback(() => {
		const snapshot = buildingsRef.current.map((b) => ({ ...b, rooms: [...b.rooms] }));
		setHistoryStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snapshot]);
		setRedoStack([]);
	}, []);

	const handleUndo = useCallback(() => {
		setHistoryStack((prev) => {
			if (prev.length === 0) return prev;
			const snapshot = prev[prev.length - 1];
			setRedoStack((r) => [...r, buildingsRef.current.map((b) => ({ ...b, rooms: [...b.rooms] }))]);
			setBuildings(snapshot);
			return prev.slice(0, -1);
		});
	}, []);

	const handleRedo = useCallback(() => {
		setRedoStack((prev) => {
			if (prev.length === 0) return prev;
			const snapshot = prev[prev.length - 1];
			setHistoryStack((h) => [...h, buildingsRef.current.map((b) => ({ ...b, rooms: [...b.rooms] }))]);
			setBuildings(snapshot);
			return prev.slice(0, -1);
		});
	}, []);

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const [buildingsRes, imageRes] = await Promise.all([
				atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
				atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${DEFAULT_SCHOOL_ID}/campus-image`),
			]);
			const blds = buildingsRes.data.buildings.map((b) => ({ ...b, dirty: false, isNew: false }));
			setBuildings(blds);
			setCampusImageUrl(imageRes.data.campusImageUrl);

			if (blds.length > 0) {
				// On initial load: URL param → first building
				// On refetch: preserve current selection → URL param → first
				const currentSel = selectedIdRef.current;
				const currentValid = currentSel !== null && blds.some((b) => b.id === currentSel);

				if (!initialLoadDone.current) {
					// First load: try query param
					const qId = queryBuildingId ? Number(queryBuildingId) : NaN;
					const matchQuery = !isNaN(qId) && blds.some((b) => b.id === qId);
					setSelectedId(matchQuery ? qId : currentValid ? currentSel : blds[0].id);
					initialLoadDone.current = true;
				} else if (!currentValid) {
					// Refetch but current selection no longer exists
					setSelectedId(blds[0].id);
				}
			}
		} catch {
			setBuildings([]);
			setCampusImageUrl(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const selectedBuilding = buildings.find((b) => b.id === selectedId) ?? null;

	const handleBuildingUpdate = useCallback(
		(updates: Partial<EditorBuilding>) => {
			if (selectedId == null) return;
			setBuildings((prev) =>
				prev.map((b) => (b.id === selectedId ? { ...b, ...updates } : b)),
			);
		},
		[selectedId],
	);

	const handleBuildingDelete = useCallback(() => {
		if (selectedId == null) return;
		setBuildings((prev) => prev.filter((b) => b.id !== selectedId));
		setSelectedId(null);
	}, [selectedId]);

	const handleRoomAdded = useCallback(
		(room: Room) => {
			if (selectedId == null) return;
			setBuildings((prev) =>
				prev.map((b) =>
					b.id === selectedId ? { ...b, rooms: [...b.rooms, room] } : b,
				),
			);
		},
		[selectedId],
	);

	const handleRoomDeleted = useCallback(
		(roomId: number) => {
			if (selectedId == null) return;
			setBuildings((prev) =>
				prev.map((b) =>
					b.id === selectedId
						? { ...b, rooms: b.rooms.filter((r) => r.id !== roomId) }
						: b,
				),
			);
		},
		[selectedId],
	);

	const handleRoomUpdated = useCallback(
		(room: Room) => {
			setBuildings((prev) =>
				prev.map((b) => ({
					...b,
					rooms: b.rooms.map((r) => (r.id === room.id ? room : r)),
				})),
			);
		},
		[],
	);

	const handleSaved = useCallback(() => {
		// Refetch from server to get canonical IDs
		fetchData();
	}, [fetchData]);

	if (loading) {
		return (
			<div className="p-6">
				<Skeleton className="h-150 w-full rounded-lg" />
			</div>
		);
	}

	if (mode === 'overview') {
		return (
			<>
				<div className="fixed right-6 top-32 z-30">
					<SmartHelpTrigger
						title="How to review rooms"
						description="Start with room readiness before opening the map editor."
						steps={[
							{ title: 'Review readiness first', body: 'The readiness list shows which rooms need capacity, type, or section review.', target: 'Room readiness' },
							{ title: 'Open a building only when needed', body: 'Use the map to inspect a building after you know what needs attention.', target: 'Campus map' },
							{ title: 'Check schedules after generation', body: 'Room schedule overlays appear only after a current timetable exists.', target: 'Schedule overlay' },
							{ title: 'Edit only for setup corrections', body: 'Use Edit map when room or building setup needs to change.', target: 'Edit map' },
						]}
					/>
				</div>
				<ModeToggle mode={mode} onChange={(next) => {
					const next2 = new URLSearchParams(searchParams);
					if (next === 'overview') next2.delete('mode'); else next2.set('mode', 'editor');
					setSearchParams(next2);
				}} />
				<CampusMapOverview buildings={buildings} campusImageUrl={campusImageUrl} />
			</>
		);
	}

	return (
		<div className="flex h-[calc(100svh-3.5rem)] overflow-hidden bg-primary/5">
			{/* Canvas area */}
			<div className="flex-1 min-w-0 overflow-hidden p-4">
				<div className="mb-3 flex items-center justify-between gap-3">
					<div>
						<p className="text-[10px] font-bold uppercase text-primary">
							Scheduling Portal
						</p>
						<h1 className="text-lg font-bold text-slate-900">
							Campus map editor
						</h1>
					</div>
					<div className="flex items-center gap-2">
						<SmartHelpTrigger
							title="How to use the campus map editor"
							description="Use this workspace only when room or building information needs correction."
							steps={[
								{ title: 'Select a building', body: 'Click a building on the map or choose it from the side panel.', target: 'Campus map' },
								{ title: 'Review rooms first', body: 'Check room type, capacity, and teaching-space status before editing shapes.', target: 'Room list' },
								{ title: 'Edit carefully', body: 'Use undo if a map shape or room detail changes by mistake.', target: 'Undo' },
								{ title: 'Return to overview', body: 'Use Overview when you only need readiness or schedule information.', target: 'Overview' },
							]}
						/>
						<ModeToggle mode={mode} inline onChange={(next) => {
							const next2 = new URLSearchParams(searchParams);
							if (next === 'overview') next2.delete('mode'); else next2.set('mode', 'editor');
							setSearchParams(next2);
						}} />
					</div>
				</div>
				<Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Loading map editor…</div>}>
				<CampusMapEditor
					schoolId={DEFAULT_SCHOOL_ID}
					buildings={buildings}
					campusImageUrl={campusImageUrl}
					onBuildingsChange={setBuildings}
					selectedBuildingId={selectedId}
					onSelect={setSelectedId}
					onSaved={handleSaved}
					historyStack={historyStack}
					redoStack={redoStack}
					onPushHistory={handlePushHistory}
					onUndo={handleUndo}
					onRedo={handleRedo}
				/>
				</Suspense>
			</div>

			{/* Side panel — always visible */}
			<div className="w-88 shrink-0 border-l border-slate-200 bg-white overflow-y-auto scrollbar-thin shadow-soft">
				<Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading room editor…</div>}>
				{selectedBuilding ? (
					<BuildingPanel
						building={selectedBuilding}
						onUpdate={handleBuildingUpdate}
						onDelete={handleBuildingDelete}
						onClose={() => setSelectedId(null)}
						onRoomAdded={handleRoomAdded}
						onRoomDeleted={handleRoomDeleted}
						onRoomUpdated={handleRoomUpdated}
						onPushHistory={handlePushHistory}
					/>
				) : (
					<div className="flex h-full items-center justify-center p-6 text-center">
						<div>
							<MapPinned className="mx-auto size-10 text-primary/30" />
							<p className="mt-2 text-sm text-slate-500">
								{buildings.length === 0
									? 'Choose Draw building to add the first campus building.'
									: 'Select a building on the map to edit rooms and readiness.'}
							</p>
						</div>
					</div>
				)}
				</Suspense>
			</div>
		</div>
	);
}

function ModeToggle({
	mode,
	onChange,
	inline = false,
}: {
	mode: 'overview' | 'editor';
	onChange: (next: 'overview' | 'editor') => void;
	inline?: boolean;
}) {
	const wrapperClass = inline
		? 'inline-flex rounded-md border border-border bg-card p-0.5'
		: 'fixed right-6 top-20 z-30 inline-flex rounded-md border border-border bg-card p-0.5 shadow-sm';
	return (
		<TooltipProvider>
			<div className={wrapperClass} role="tablist" aria-label="Campus map mode">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={mode === 'overview' ? 'default' : 'ghost'}
							size="sm"
							className="h-8"
							aria-pressed={mode === 'overview'}
							onClick={() => onChange('overview')}
						>
							<MousePointer2 className="size-3.5" /> Overview
						</Button>
					</TooltipTrigger>
					<TooltipContent>Read-only view of buildings and rooms</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={mode === 'editor' ? 'default' : 'ghost'}
							size="sm"
							className="h-8"
							aria-pressed={mode === 'editor'}
							onClick={() => onChange('editor')}
						>
							<Pencil className="size-3.5" /> Edit map
						</Button>
					</TooltipTrigger>
					<TooltipContent>Draw, move, and label buildings</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	);
}
