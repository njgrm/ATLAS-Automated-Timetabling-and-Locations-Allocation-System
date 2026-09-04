import type { DraftPlacement, ScheduledEntry } from '@/types';
import { parseDraftPlacementId } from '@/lib/timetable-utils';

type EntryLike = Pick<ScheduledEntry, 'entryId' | 'sectionId' | 'subjectId' | 'day' | 'startTime' | 'endTime' | 'entryKind' | 'cohortCode' | 'facultyId' | 'roomId'>;

type TimetableSlotLike = Pick<ScheduledEntry, 'day' | 'startTime' | 'endTime'>;

export type TimetableDropTarget = {
	day: string;
	startTime: string;
	endTime: string;
};

export function isSameTimetableSlot(source: TimetableSlotLike, target: TimetableSlotLike): boolean {
	return source.day === target.day
		&& source.startTime === target.startTime
		&& source.endTime === target.endTime;
}

export function resolveTimetableDropTarget(input: {
	pointerUpCell?: TimetableDropTarget | null;
	explicit?: Partial<TimetableDropTarget> | null;
	finalPointerCell?: TimetableDropTarget | null;
	lastOverCell?: TimetableDropTarget | null;
	targetEntry?: TimetableDropTarget | null;
}): TimetableDropTarget | null {
	if ('pointerUpCell' in input) return input.pointerUpCell ?? null;
	const day = input.explicit?.day ?? input.finalPointerCell?.day ?? input.lastOverCell?.day ?? input.targetEntry?.day;
	const startTime = input.explicit?.startTime ?? input.finalPointerCell?.startTime ?? input.lastOverCell?.startTime ?? input.targetEntry?.startTime;
	const endTime = input.explicit?.endTime ?? input.finalPointerCell?.endTime ?? input.lastOverCell?.endTime ?? input.targetEntry?.endTime;

	return day && startTime && endTime ? { day, startTime, endTime } : null;
}

export function resolveDraftPlacementFromEntry(
	entry: EntryLike,
	placements: DraftPlacement[] | undefined,
): DraftPlacement | null {
	if (!placements?.length) return null;

	const parsedPlacementId = parseDraftPlacementId(entry.entryId);
	if (parsedPlacementId != null) {
		return placements.find((placement) => placement.id === parsedPlacementId) ?? null;
	}

	const matches = placements.filter((placement) => {
		if (placement.status !== 'DRAFT') return false;
		if (placement.sectionId !== entry.sectionId) return false;
		if (placement.subjectId !== entry.subjectId) return false;
		if (placement.day !== entry.day) return false;
		if (placement.startTime !== entry.startTime) return false;
		if (placement.endTime !== entry.endTime) return false;
		if ((entry.entryKind ?? null) !== (placement.entryKind ?? null)) return false;
		if ((entry.cohortCode ?? null) !== (placement.cohortCode ?? null)) return false;
		return true;
	});

	return matches.length === 1 ? matches[0] : null;
}

export function resolvePreGenSlotDisplacement(
	placements: DraftPlacement[] | undefined,
	target: { day: string; startTime: string; endTime: string },
	sourcePlacementId?: number,
): { kind: 'none' | 'single' | 'multiple'; placement: DraftPlacement | null; count: number } {
	if (!placements?.length) {
		return { kind: 'none', placement: null, count: 0 };
	}

	const slotMatches = placements.filter((placement) => (
		placement.status === 'DRAFT'
		&& placement.day === target.day
		&& placement.startTime === target.startTime
		&& placement.endTime === target.endTime
		&& placement.id !== sourcePlacementId
	));

	if (slotMatches.length === 0) {
		return { kind: 'none', placement: null, count: 0 };
	}
	if (slotMatches.length === 1) {
		return { kind: 'single', placement: slotMatches[0], count: 1 };
	}
	return { kind: 'multiple', placement: null, count: slotMatches.length };
}

export function findRegularSwapCandidate(
	source: Pick<ScheduledEntry, 'entryId' | 'sectionId' | 'facultyId' | 'roomId'>,
	slotEntries: Array<Pick<ScheduledEntry, 'entryId' | 'sectionId' | 'facultyId' | 'roomId'>>,
): ScheduledEntry | null {
	let best: { score: number; candidate: Pick<ScheduledEntry, 'entryId' | 'sectionId' | 'facultyId' | 'roomId'> } | null = null;

	for (const candidate of slotEntries) {
		if (candidate.entryId === source.entryId) continue;
		const sameSection = candidate.sectionId === source.sectionId;
		const sameFaculty = source.facultyId != null && candidate.facultyId != null && candidate.facultyId === source.facultyId;
		const sameRoom = candidate.roomId === source.roomId;
		if (!sameSection && !sameFaculty && !sameRoom) continue;

		const score = (sameSection ? 4 : 0) + (sameFaculty ? 2 : 0) + (sameRoom ? 1 : 0);
		if (!best || score > best.score) {
			best = { score, candidate };
		}
	}

	return (best?.candidate as ScheduledEntry | undefined) ?? null;
}
