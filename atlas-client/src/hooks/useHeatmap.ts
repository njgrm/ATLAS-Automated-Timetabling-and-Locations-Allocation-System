import { useMemo } from 'react';
import type { FacultyGlobalDraftEntry } from '@/types';

type UseHeatmapProps = {
	entries: FacultyGlobalDraftEntry[];
	totalRooms: number;
};

export function useHeatmap({ entries, totalRooms }: UseHeatmapProps) {
	const congestionBySlot = useMemo(() => {
		const map = new Map<string, number>();
		entries.forEach((e) => {
			const key = `${e.day}|${e.startTime}|${e.endTime}`;
			map.set(key, (map.get(key) ?? 0) + 1);
		});
		return map;
	}, [entries]);

	const getHeatColor = (count: number) => {
		if (count === 0) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
		const ratio = totalRooms > 0 ? count / totalRooms : 0;
		if (ratio < 0.3) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
		if (ratio < 0.6) return 'bg-amber-100 text-amber-800 border-amber-200';
		if (ratio < 0.9) return 'bg-orange-100 text-orange-800 border-orange-200';
		return 'bg-rose-100 text-rose-800 border-rose-200';
	};

	const getHeatLabel = (count: number) => {
		const ratio = totalRooms > 0 ? count / totalRooms : 0;
		if (count === 0) return 'Empty';
		if (ratio < 0.3) return 'Low';
		if (ratio < 0.6) return 'Moderate';
		if (ratio < 0.9) return 'High';
		return 'Full';
	};

	return {
		getHeatColor,
		getHeatLabel,
		congestionBySlot,
	};
}
