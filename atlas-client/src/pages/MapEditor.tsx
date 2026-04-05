import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPinned } from 'lucide-react';

import { CampusMapEditor } from '@/components/CampusMapEditor';
import { BuildingPanel } from '@/components/BuildingPanel';
import atlasApi from '@/lib/api';
import type { Building, Room } from '@/types';
import { Skeleton } from '@/ui/skeleton';

type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };

const DEFAULT_SCHOOL_ID = 1;

const MAX_HISTORY = 30;

export default function MapEditor() {
	const [searchParams] = useSearchParams();
	const queryBuildingId = searchParams.get('buildingId');

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

	return (
		<div className="flex h-[calc(100svh-3.5rem)] overflow-hidden">
			{/* Canvas area */}
			<div className="flex-1 min-w-0 overflow-hidden p-4">
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
			</div>

			{/* Side panel — always visible */}
			<div className="w-80 shrink-0 border-l border-border bg-muted/30 overflow-y-auto scrollbar-thin">
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
							<MapPinned className="mx-auto size-10 text-muted-foreground/30" />
							<p className="mt-2 text-sm text-muted-foreground">
								{buildings.length === 0
									? 'Click the + button on the canvas to add your first building.'
									: 'Select a building on the map to edit its details.'}
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
