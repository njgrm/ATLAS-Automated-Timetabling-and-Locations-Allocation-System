import { useState } from 'react';

import { TimetableTaskDrawer } from '@/components/timetable/TimetableTaskDrawer';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { UnassignedItem } from '@/types';

const FIXTURE_ITEMS: UnassignedItem[] = [
	{ sectionId: 701, subjectId: 31, gradeLevel: 7, termIndex: 2, session: 1, reason: 'NO_AVAILABLE_SLOT', facultyId: 91, homeRoomId: 41 },
	{ sectionId: 701, subjectId: 32, gradeLevel: 7, termIndex: 2, session: 2, reason: 'NO_AVAILABLE_SLOT', facultyId: 92, homeRoomId: 41 },
	{ sectionId: 702, subjectId: 33, gradeLevel: 7, termIndex: 2, session: 1, reason: 'NO_AVAILABLE_SLOT', facultyId: 93, homeRoomId: 42 },
	{ sectionId: 702, subjectId: 34, gradeLevel: 7, termIndex: 2, session: 2, reason: 'NO_AVAILABLE_SLOT', facultyId: 94, homeRoomId: 42 },
	{ sectionId: 703, subjectId: 35, gradeLevel: 7, termIndex: 2, session: 1, reason: 'NO_AVAILABLE_SLOT', facultyId: 95, homeRoomId: 43 },
	{ sectionId: 703, subjectId: 36, gradeLevel: 7, termIndex: 2, session: 2, reason: 'NO_AVAILABLE_SLOT', facultyId: 96, homeRoomId: 43 },
];

const sectionNames: Record<number, string> = {
	701: 'Grade 7 · Section A',
	702: 'Grade 7 · Section B',
	703: 'Grade 7 · Section C',
};

const subjectNames: Record<number, string> = {
	31: 'English',
	32: 'Mathematics',
	33: 'Science',
	34: 'Filipino',
	35: 'Araling Panlipunan',
	36: 'Technology and Livelihood Education',
};

/** Synthetic local-only rendering of the production Class Schedule queue. */
export function A2A5UnassignedVisualFixture() {
	const [task, setTask] = useState<TimetableSimpleTask | null>('unassigned-sessions');
	const [status, setStatus] = useState('Choose Place to see the local-only selection response.');
	const context = {
		leftTab: 'unassigned',
		isPreGenerationWorkspace: false,
		summary: { classesProcessed: 6, assignedCount: 0, unassignedCount: 6 },
		filteredUnassignedItems: FIXTURE_ITEMS,
		programKindFilteredUnassignedItems: FIXTURE_ITEMS,
		unassignedCountForSelectedTerm: 6,
		UNASSIGNED_REASON_LABELS: { NO_AVAILABLE_SLOT: { label: 'No open time slot', className: 'border-amber-300' } },
		sectionLabel: (id: number) => sectionNames[id] ?? `Section ${id}`,
		subjectLabel: (id: number) => subjectNames[id] ?? `Class ${id}`,
		facultyLabel: (id: number) => `Teacher ${id - 90}`,
		buildUnassignedKey: (item: UnassignedItem) => `${item.sectionId}-${item.subjectId}-${item.session}`,
		setSelectedEntry: () => {},
		setSelectedViolation: () => {},
		setSelectedUnassignedForRepair: () => {},
		setKbSelectedSource: () => setStatus('Class selected. No request was sent; this is synthetic data.'),
		openTacticalSandbox: () => setStatus('Teaching Load is not opened in this local-only fixture.'),
		toast: {
			info: (message: string) => setStatus(`${message} No request was sent.`),
			error: (message: string) => setStatus(message),
		},
	} as unknown as LeftRailContentContext;

	return (
		<main className="flex h-svh min-h-0 flex-col overflow-hidden bg-muted/30 p-3 text-foreground sm:p-5" data-testid="a2a5-unassigned-visual-fixture">
			<header className="mx-auto mb-3 w-full max-w-5xl shrink-0">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Local visual fixture · synthetic data only</p>
				<h1 className="mt-1 text-lg font-semibold">Class Schedule · Unassigned sessions</h1>
				<p className="mt-1 text-xs text-muted-foreground">Place only selects a sample class. Nothing is saved or sent to ATLAS.</p>
			</header>
			<section className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 justify-center overflow-hidden rounded-xl border border-border bg-background" aria-label="Synthetic timetable workspace">
				<TimetableTaskDrawer
					task={task}
					onTaskChange={setTask}
					leftRailContentContext={context}
					hardCount={0}
					blockingHardCount={0}
					softCount={0}
					unassignedCount={6}
					assignedCount={0}
					runId={1}
					isPreGenerationWorkspace={false}
					onPublish={() => setStatus('Publishing is disabled in this fixture.')}
				/>
			</section>
			<p role="status" aria-live="polite" className="mx-auto mt-2 min-h-5 w-full max-w-5xl text-xs text-muted-foreground" data-testid="a2a5-fixture-status">{status}</p>
		</main>
	);
}
