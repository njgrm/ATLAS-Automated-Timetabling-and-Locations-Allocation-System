/**
 * RoomScheduleOverlay — Full-screen-ish overlay that renders a complete
 * room timetable grid with utilization stats. Used from Dashboard to avoid
 * page navigation. Closes with Escape or close button.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	Clock,
	ExternalLink,
	X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { formatTime } from '@/lib/utils';
import type { RoomScheduleView, RoomScheduleEntry } from '@/types';
import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { GradeLevelBadge, parseGradeFromSectionName } from '@/components/GradeLevelBadge';

/* ─── Constants ─── */

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

const DEFAULT_SCHOOL_ID = 1;

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadWithFallback<T>(request: () => Promise<{ data: T }>, fallback: T, timeoutMs = 4000): Promise<{ data: T }> {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		let timer: number | null = null;
		try {
			const timeout = new Promise<never>((_, reject) => {
				timer = window.setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
			});
			const result = await Promise.race([request(), timeout]);
			if (timer) window.clearTimeout(timer);
			return result;
		} catch {
			if (timer) window.clearTimeout(timer);
			if (attempt === 0) await wait(250);
		}
	}

	return { data: fallback };
}

async function fetchVersionedApi<T>(path: string): Promise<{ data: T }> {
	const token = getPreferredAccessToken();
	const response = await fetch(`/api/v1${path}`, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	});
	if (!response.ok) throw new Error(`Request failed: ${response.status}`);
	return { data: await response.json() as T };
}

/* ─── Types ─── */

export interface RoomScheduleOverlayProps {
	open: boolean;
	onClose: () => void;
	roomName: string;
	roomId: number;
	schedule: RoomScheduleView | null;
	loading?: boolean;
	subjectMap?: Map<number, string>;
	facultyMap?: Map<number, string>;
	sectionMap?: Map<number, { name: string; gradeLevel: number | null }>;
}

/* ─── Component ─── */

export function RoomScheduleOverlay({
	open,
	onClose,
	roomName,
	roomId,
	schedule,
	loading = false,
	subjectMap: parentSubjectMap,
	facultyMap: parentFacultyMap,
	sectionMap: parentSectionMap,
}: RoomScheduleOverlayProps) {
	const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, string>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, { name: string; gradeLevel: number | null }>>(new Map());

	// Escape key handler
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		},
		[onClose],
	);

	useEffect(() => {
		if (open) {
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [open, handleKeyDown]);

	useEffect(() => {
		if (!open || !schedule) return;
		let cancelled = false;

		(async () => {
			const context = await resolveActiveSchoolYearContext({ allowStaleOnError: true, preferCache: true, backgroundRefresh: true }).catch(() => ({ activeSchoolYearId: null }));
			const activeSchoolYearId = context.activeSchoolYearId;

			const [subjectsRes, facultyRes, sectionsRes] = await Promise.all([
				loadWithFallback(() => atlasApi.get<{ subjects: Array<{ id: number; code?: string | null; displayCode?: string | null; name: string }> }>(
					`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`,
				), { subjects: [] }),
				loadWithFallback(() => atlasApi.get<{
					faculty: Array<{ id: number; firstName: string; lastName: string }>;
				}>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`), { faculty: [] }),
				activeSchoolYearId
					? loadWithFallback(() => fetchVersionedApi<{
							sections: Array<{ id: number; name: string; gradeLevelName?: string | null }>;
					  }>(`/sections/summary/${activeSchoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`), { sections: [] })
					: Promise.resolve({ data: { sections: [] } }),
			]);

			if (cancelled) return;

			setSubjectMap(
				new Map(
					(subjectsRes.data.subjects ?? []).map((s) => [
						s.id,
						s.displayCode ?? s.code ?? s.name,
					]),
				),
			);
			setFacultyMap(
				new Map(
					(facultyRes.data.faculty ?? []).map((f) => [
						f.id,
						`${f.lastName}, ${f.firstName}`,
					]),
				),
			);
			setSectionMap(
				new Map((sectionsRes.data.sections ?? []).map((s) => [
					s.id,
					{ name: s.name, gradeLevel: parseGradeFromSectionName(s.gradeLevelName) ?? parseGradeFromSectionName(s.name) },
				])),
			);
		})();

		return () => {
			cancelled = true;
		};
	}, [open, schedule]);

	const displayMaps = useMemo(
		() => ({
			subjectMap: new Map([...(parentSubjectMap ?? new Map()), ...subjectMap]),
			facultyMap: new Map([...(parentFacultyMap ?? new Map()), ...facultyMap]),
			sectionMap: new Map([...(parentSectionMap ?? new Map()), ...sectionMap]),
		}),
		[parentFacultyMap, parentSectionMap, parentSubjectMap, subjectMap, facultyMap, sectionMap],
	);

	return (
		<AnimatePresence>
			{open && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="fixed inset-0 z-50 bg-black/60"
						onClick={onClose}
					/>

					{/* Overlay panel */}
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 16 }}
						transition={{ duration: 0.2, ease: 'easeOut' }}
						className="fixed inset-4 z-50 flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
						role="dialog"
						aria-labelledby="room-schedule-overlay-title"
						aria-describedby="room-schedule-overlay-description"
						aria-modal="true"
					>
						{/* Header */}
						<div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border">
							<Clock className="size-4 text-primary" />
							<h2 id="room-schedule-overlay-title" className="text-sm font-bold flex-1">{roomName} room schedule</h2>
							<p id="room-schedule-overlay-description" className="sr-only">
								Review the latest classes scheduled in this room, then open the full room schedule page if more detail is needed.
							</p>

							{/* Inline stat banner */}
							{schedule && (
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span>
										Utilization: <span className="font-semibold text-foreground">{schedule.summary.utilizationPercent}%</span>
									</span>
									<span className="text-border">•</span>
									<span>
										{schedule.summary.occupiedMinutes}/{schedule.summary.availableMinutes} min
									</span>
									<span className="text-border">•</span>
									{schedule.summary.conflictCount > 0 ? (
										<Badge variant="destructive" className="text-[11px]">
											<AlertTriangle className="mr-0.5 size-3" />
											{schedule.summary.conflictCount} conflict{schedule.summary.conflictCount !== 1 ? 's' : ''}
										</Badge>
									) : (
										<span className="text-green-600 font-medium">0 conflicts</span>
									)}
									<span className="text-border">•</span>
									<span>
										Run #{schedule.source.runId} · {schedule.source.status}
									</span>
								</div>
							)}

							<Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1.5">
								<Link to={`/room-schedules?roomId=${roomId}&source=latest`}>
									<ExternalLink className="size-3" />
									Open Full Page
								</Link>
							</Button>

							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={onClose}
								aria-label="Close overlay (Esc)"
							>
								<X className="size-4" />
							</Button>
						</div>

						{/* Grid area */}
						<div className="flex-1 min-h-0 overflow-auto">
							{schedule ? (
								<div className="min-w-3xl p-5">
									<OverlayTimetableGrid schedule={schedule} {...displayMaps} />
								</div>
							) : loading ? (
								<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
									Loading the latest room schedule...
								</div>
							) : (
								<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
									No latest schedule is available for this room yet.
								</div>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

/* ─── Grid rendering (simplified from RoomSchedules) ─── */

function OverlayTimetableGrid({
	schedule,
	subjectMap,
	facultyMap,
	sectionMap,
}: {
	schedule: RoomScheduleView;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, { name: string; gradeLevel: number | null }>;
}) {
	return (
		<table className="min-w-4xl w-full border-collapse" style={{ tableLayout: 'fixed' }}>
			<colgroup>
				<col className="w-24" />
				{schedule.days.map((d) => (
					<col key={d} />
				))}
			</colgroup>
			<thead className="sticky top-0 z-10 bg-background">
				<tr>
					<th className="sticky left-0 z-20 bg-background border-b-2 border-r px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Time
					</th>
					{schedule.days.map((d) => (
						<th
							key={d}
							className="border-b-2 px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
						>
							{DAY_SHORT[d] ?? d}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{schedule.grid.map((row, rowIdx) => (
					<tr key={rowIdx}>
						<td className="sticky left-0 z-5 bg-background border-r border-b px-2 py-3 align-middle w-24">
							<div className="text-[10px] font-semibold text-foreground leading-tight">
								{formatTime(row.timeSlot.startTime)}–{formatTime(row.timeSlot.endTime)}
							</div>
						</td>
						{row.cells.map((cell, dayIdx) => {
							if (!cell.occupied) {
								return (
									<td key={dayIdx} className="border-b border-r last:border-r-0 px-1 py-1" />
								);
							}
							const firstGrade = cell.entries.length > 0
								? sectionMap.get(cell.entries[0].sectionId)?.gradeLevel ?? null
								: null;
							let baseCellClass = 'bg-primary/5 border-primary/20';
							if (firstGrade === 7) baseCellClass = 'bg-green-50 border-green-200';
							else if (firstGrade === 8) baseCellClass = 'bg-yellow-50 border-yellow-200';
							else if (firstGrade === 9) baseCellClass = 'bg-red-50 border-red-200';
							else if (firstGrade === 10) baseCellClass = 'bg-blue-50 border-blue-200';
							return (
								<td
									key={dayIdx}
									className={`border-b border-r last:border-r-0 px-1 py-0.5 align-top ${
										cell.conflict
											? 'bg-red-50 border-red-200'
											: baseCellClass
									}`}
								>
									{cell.entries.map((entry) => (
										<OverlayEntryCell
											key={entry.entryId}
											entry={entry}
											subjectMap={subjectMap}
											facultyMap={facultyMap}
											sectionMap={sectionMap}
										/>
									))}
									{cell.conflict && (
										<Badge variant="destructive" className="mt-0.5 text-[9px] px-1 py-0">
											<AlertTriangle className="mr-0.5 size-2.5" />
											Conflict
										</Badge>
									)}
								</td>
							);
						})}
					</tr>
				))}
			</tbody>
		</table>
	);
}

function OverlayEntryCell({
	entry,
	subjectMap,
	facultyMap,
	sectionMap,
}: {
	entry: RoomScheduleEntry;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, { name: string; gradeLevel: number | null }>;
}) {
	const sectionInfo = sectionMap.get(entry.sectionId);
	const subjectLabel = entry.subjectDisplayLabel ?? subjectMap.get(entry.subjectId) ?? 'Subject not listed';
	const sectionLabel = entry.sectionDisplayLabel ?? sectionInfo?.name ?? 'Assigned section';
	const facultyLabel = entry.facultyId != null
		? entry.facultyDisplayLabel ?? facultyMap.get(entry.facultyId) ?? 'Teacher not listed'
		: 'Unassigned teacher';
	return (
		<div className="px-1.5 py-1 text-[11px] leading-snug">
			<div className="font-semibold text-foreground truncate">
				{subjectLabel}
			</div>
			<div className="flex items-center gap-1 min-w-0">
				<GradeLevelBadge grade={sectionInfo?.gradeLevel ?? null} size="xs" />
				<span className="text-muted-foreground truncate">
					{sectionLabel}
				</span>
			</div>
			<div className="text-muted-foreground/80 truncate">
				{facultyLabel}
			</div>
		</div>
	);
}
