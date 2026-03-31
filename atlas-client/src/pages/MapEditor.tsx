import { useCallback, useEffect, useState } from 'react';

import { CampusMapEditor } from '@/components/CampusMapEditor';
import { BuildingPanel } from '@/components/BuildingPanel';
import atlasApi from '@/lib/api';
import type { Building, Room } from '@/types';
import { Skeleton } from '@/ui/skeleton';

type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };

const DEFAULT_SCHOOL_ID = 1;

export default function MapEditor() {
	const [buildings, setBuildings] = useState<EditorBuilding[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const [buildingsRes, imageRes] = await Promise.all([
				atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
				atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${DEFAULT_SCHOOL_ID}/campus-image`),
			]);
			setBuildings(buildingsRes.data.buildings.map((b) => ({ ...b, dirty: false, isNew: false })));
			setCampusImageUrl(imageRes.data.campusImageUrl);
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

	const handleSaved = useCallback(() => {
		// Refetch from server to get canonical IDs
		fetchData();
	}, [fetchData]);

	if (loading) {
		return (
			<div className="p-6">
				<Skeleton className="h-[600px] w-full rounded-lg" />
			</div>
		);
	}

	return (
		<div className="flex h-full">
			{/* Canvas area */}
			<div className="flex-1 overflow-auto p-4">
				<div className="mb-3">
					<h2 className="text-lg font-bold">Map Editor</h2>
					<p className="text-[0.8125rem] text-muted-foreground">
						Add buildings, drag to position, resize with handles, and manage rooms.
					</p>
				</div>
				<CampusMapEditor
					schoolId={DEFAULT_SCHOOL_ID}
					buildings={buildings}
					campusImageUrl={campusImageUrl}
					onBuildingsChange={setBuildings}
					selectedBuildingId={selectedId}
					onSelect={setSelectedId}
					onSaved={handleSaved}
				/>
			</div>

			{/* Side panel */}
			{selectedBuilding && (
				<BuildingPanel
					building={selectedBuilding}
					onUpdate={handleBuildingUpdate}
					onDelete={handleBuildingDelete}
					onClose={() => setSelectedId(null)}
					onRoomAdded={handleRoomAdded}
					onRoomDeleted={handleRoomDeleted}
				/>
			)}
		</div>
	);
}
