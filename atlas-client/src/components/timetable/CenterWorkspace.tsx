import { lazy, memo, Suspense, useCallback, useEffect, useState, Profiler } from 'react';
import { onProfilerRender } from './ScheduleReviewWorkspace';
import { isDraftPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
import { buildUnassignedKey } from '@/lib/timetable-utils';

import { CenterWorkspacePaneSurface, type CenterWorkspacePaneSurfaceProps } from '@/components/timetable/CenterWorkspacePaneSurface';
import { ResizablePanel } from '@/ui/resizable';

import type { CommitResult, ManualEditProposal, SchedulingPolicy, TeachingLoadRepairChange, TeachingLoadRepairPreviewResult, UnassignedItem } from '@/types';

const TacticalSandboxDock = lazy(() => import('@/components/timetable/TacticalSandboxDock').then((module) => ({
	default: module.TacticalSandboxDock,
})));

/**
 * The centre workspace = the pane surface (every arm of the centre chain) PLUS the
 * tactical sandbox that docks over it.
 *
 * C11 slice 1 moved the pane chain into `CenterWorkspacePaneSurface.tsx`, which
 * also carries the C11 M1 correction signal `routeAppliedPathname`. The props the
 * surface does not need (the unassigned-selection pair the sandbox owns, the
 * sandbox dock's own props) stay here, so the surface's prop type stays exactly the
 * set the pane renders.
 */
export type CenterWorkspaceProps = CenterWorkspacePaneSurfaceProps & {
	selectedUnassigned: UnassignedItem | null;
	setSelectedUnassigned: (value: UnassignedItem | null) => void;
	dayShort: Record<string, string>;
	/** Generation in flight; read by the tactical sandbox dock's own consumers. */
	generating: boolean;
	/** The canonical generate dispatch the setup sub-page starts a revision from. */
	handleTriggerGenerate: () => void;
	previewTeachingLoadRepair: (changes: TeachingLoadRepairChange[], placementProposal?: ManualEditProposal) => Promise<TeachingLoadRepairPreviewResult | null>;
	commitTeachingLoadRepair: (changes: TeachingLoadRepairChange[], allowSoftOverride?: boolean, placementProposal?: ManualEditProposal) => Promise<CommitResult | null>;
	handleStartNewPreGenerationDraft: () => Promise<void>;
	tacticalSandboxOpen: boolean;
	setTacticalSandboxOpen: (v: boolean) => void;
	/** UX-R03c — the workspace-owned full scheduling-policy record the policy pane hydrates from. */
	policyRecord?: SchedulingPolicy | null;
	/** UX-R03c — dedicated policy refetch trigger, threaded to the policy pane so a save converges both consumers. */
	policyRefreshToken?: number;
	refreshPolicy?: () => void;
};

/**
 * The centre RESIZABLE PANEL: the tactical sandbox that docks over it, and the pane
 * surface itself.
 *
 * C11 slice 1 — the pane chain (policy · runs · setup · manual-edit · map ·
 * building · matrix · grid), its `AnimatePresence mode="wait"` arrangement and the
 * `resolveCenterPane` decision moved to `CenterWorkspacePaneSurface.tsx`. Two
 * reasons, and the second is a QA finding:
 *
 *  - this file was at 965 physical lines against the 1000-line cap (AGENTS.md §8)
 *    with no room for the M1 correction or the M3 target highlight;
 *  - C11 F4: the M1 rows rendered a test-LOCAL fixture rather than this surface, so
 *    a 20/20 green gate could ship the M1 regression. The pane surface is now a
 *    real component the product renders and a test can drive directly.
 */
export const CenterWorkspace = memo(function CenterWorkspace(props: CenterWorkspaceProps) {
	const {
		selectedEntry,
		selectedUnassigned,
		setSelectedUnassigned,
		draft,
		roomMap,
		facultyMap,
		subjectMap,
		schoolYearId,
		draftEntries,
		defaultSchoolId,
		previewTeachingLoadRepair,
		commitTeachingLoadRepair,
		previewLoading,
		commitLoading,
		handleRefresh,
		centerView,
		tacticalSandboxOpen,
		setTacticalSandboxOpen,
	} = props;

	const [sandboxFacultyByEntryId, setSandboxFacultyByEntryId] = useState<Map<string, number>>(new Map());
	const [autoOpenedSandboxEntryId, setAutoOpenedSandboxEntryId] = useState<string | null>(null);
	const [suppressedSandboxEntryId, setSuppressedSandboxEntryId] = useState<string | null>(null);
	const [viewport, setViewport] = useState(() => {
		const width = typeof window !== 'undefined' ? window.innerWidth : 1366;
		return { width, isCompact: width < 1024 };
	});
	const selectedEntryId = selectedEntry?.entryId ?? null;
	const selectedUnassignedKey = selectedUnassigned ? buildUnassignedKey(selectedUnassigned) : null;
	const activeSandboxKey = selectedEntryId ?? selectedUnassignedKey;

	useEffect(() => {
		const syncViewport = () => setViewport({
			width: window.innerWidth,
			isCompact: window.innerWidth < 1024,
		});
		syncViewport();
		window.addEventListener('resize', syncViewport);
		return () => window.removeEventListener('resize', syncViewport);
	}, []);

	useEffect(() => {
		setSandboxFacultyByEntryId(new Map());
		setTacticalSandboxOpen(false);
		setAutoOpenedSandboxEntryId(null);
		setSuppressedSandboxEntryId(null);
	}, [draft?.runId, draft?.version]);

	const handleTacticalSandboxOpenChange = useCallback((open: boolean) => {
		setTacticalSandboxOpen(open);
		if (open && activeSandboxKey) {
			setAutoOpenedSandboxEntryId(activeSandboxKey);
			setSuppressedSandboxEntryId(null);
		} else if (!open && activeSandboxKey) {
			setSuppressedSandboxEntryId(activeSandboxKey);
		}
	}, [activeSandboxKey]);

	const dismissTacticalSandboxForEntry = useCallback((entryId: string) => {
		setSuppressedSandboxEntryId(entryId);
		setTacticalSandboxOpen(false);
	}, []);
	const dismissTacticalSandboxForUnassigned = useCallback(() => {
		setSelectedUnassigned(null);
		setTacticalSandboxOpen(false);
		setAutoOpenedSandboxEntryId(null);
		setSuppressedSandboxEntryId(null);
	}, [setSelectedUnassigned]);

	const shouldMountTacticalSandbox = tacticalSandboxOpen
		|| sandboxFacultyByEntryId.size > 0
		|| (centerView === 'schedule' && selectedUnassigned !== null);
	const compactLeftDefaultSize = Math.max(
		48,
		Math.min(72, Math.max(34, Math.ceil((280 / Math.max(viewport.width, 1)) * 100))),
	);
	const centerDefaultSize = props.simpleMode
		? 100
		: viewport.isCompact
			? Math.max(28, 100 - compactLeftDefaultSize)
			: 50;

	const applySandboxFaculty = useCallback((entryIds: string[], facultyId: number) => {
		setSandboxFacultyByEntryId((previous) => {
			const next = new Map(previous);
			const originalEntries = new Map(draftEntries.map((entry) => [entry.entryId, entry]));
			for (const entryId of entryIds) {
				const originalEntry = originalEntries.get(entryId);
				if (!originalEntry) continue;
				if (originalEntry.facultyId === facultyId) next.delete(entryId);
				else next.set(entryId, facultyId);
			}
			return next;
		});
	}, [draftEntries]);

	const resetTacticalSandbox = useCallback(() => {
		setSandboxFacultyByEntryId(new Map());
	}, []);

	const isDraftPublished = isDraftPublishedStrict(draft);

	return (
		<ResizablePanel
			id="center-panel"
			order={2}
			defaultSize={centerDefaultSize}
			minSize={props.simpleMode ? 0 : viewport.isCompact ? 28 : 36}
			className="flex-1 min-w-0 flex flex-col min-h-0 relative bg-background"
			data-tutorial="center-grid"
			data-testid="timetable-center-panel"
		>
			<CenterWorkspacePaneSurface {...props} sandboxFacultyByEntryId={sandboxFacultyByEntryId} />
			{shouldMountTacticalSandbox ? (
				<Suspense fallback={null}>
					<Profiler id="Tactical Sandbox" onRender={onProfilerRender}>
						<TacticalSandboxDock
							open={tacticalSandboxOpen}
							onOpenChange={handleTacticalSandboxOpenChange}
							selectedEntry={centerView === 'schedule' ? selectedEntry : null}
							selectedUnassigned={centerView === 'schedule' ? selectedUnassigned : null}
							draftEntries={draftEntries}
							schoolId={defaultSchoolId}
							schoolYearId={schoolYearId}
							runId={draft?.runId ?? null}
							facultyMap={facultyMap}
							subjectMap={subjectMap}
							roomMap={roomMap}
							sandboxFacultyByEntryId={sandboxFacultyByEntryId}
							onApplyFaculty={applySandboxFaculty}
							onPreviewTeachingLoadRepair={previewTeachingLoadRepair}
							onCommitTeachingLoadRepair={commitTeachingLoadRepair}
							onRevisionCreated={handleRefresh}
							onResetSandbox={resetTacticalSandbox}
							onDismissSelectedEntry={dismissTacticalSandboxForEntry}
							onDismissSelectedUnassigned={dismissTacticalSandboxForUnassigned}
							isPublished={isDraftPublished}
							subjectLabel={props.subjectLabel}
							sectionLabel={props.sectionLabel}
							facultyLabel={props.facultyLabel}
						/>
					</Profiler>
				</Suspense>
			) : null}
		</ResizablePanel>
	);
});
