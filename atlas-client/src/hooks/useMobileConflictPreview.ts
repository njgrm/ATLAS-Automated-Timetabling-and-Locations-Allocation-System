import { useCallback, useState } from 'react';

import atlasApi from '@/lib/api';
import { scopePreviewToCandidate } from '@/lib/timetable-utils';
import type { DayOfWeek, FacultyRoomPreferenceEntry, PreviewResult } from '@/types';

export type MobilePreviewSlot = {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	targetEntryId: string | null;
};

type UseMobileConflictPreviewOptions = {
	schoolId: number;
	activeSchoolYearId: number | null;
	runId: number | null;
	facultyId: number | null;
	runVersion: number;
	selectedEntry: FacultyRoomPreferenceEntry | null;
};

export function useMobileConflictPreview({
	schoolId,
	activeSchoolYearId,
	runId,
	facultyId,
	runVersion,
	selectedEntry,
}: UseMobileConflictPreviewOptions) {
	const [previewSlot, setPreviewSlot] = useState<MobilePreviewSlot | null>(null);
	const [preview, setPreview] = useState<PreviewResult | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);

	const selectTarget = useCallback(async (target: MobilePreviewSlot): Promise<MobilePreviewSlot | null> => {
		if (!selectedEntry || !runId || !activeSchoolYearId || !facultyId) return null;
		setPreviewSlot(target);
		setPreview(null);
		setPreviewLoading(true);
		try {
			const actionType = target.targetEntryId ? 'SWAP_WITH_OCCUPIED' : 'MOVE_TO_EMPTY_SLOT';
			const { data } = await atlasApi.post<{ preview: PreviewResult }>(
				`/room-preferences/${schoolId}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/entries/${selectedEntry.entryId}/preview`,
				{
					actionType,
					requestedRoomId: selectedEntry.currentRoomId,
					targetDay: target.day,
					targetStartTime: target.startTime,
					targetEndTime: target.endTime,
					targetEntryId: target.targetEntryId,
					expectedRunVersion: runVersion,
				},
			);
			const scoped = scopePreviewToCandidate(data.preview, {
				day: target.day,
				startTime: target.startTime,
				endTime: target.endTime,
			});
			setPreview(scoped);
			return target;
		} catch {
			setPreview(null);
			return target;
		} finally {
			setPreviewLoading(false);
		}
	}, [selectedEntry, runId, activeSchoolYearId, facultyId, runVersion, schoolId]);

	const clearPreview = useCallback(() => {
		setPreviewSlot(null);
		setPreview(null);
	}, []);

	return { previewSlot, preview, previewLoading, selectTarget, clearPreview };
}
