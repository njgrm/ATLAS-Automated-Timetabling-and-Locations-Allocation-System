/**
 * TeachingLoadInspectorPanel — the ONE inspector node, shared by three surfaces.
 *
 * A6 C2 (Slice 3): extracted verbatim out of `pages/TeachingLoad.tsx` so that
 * page can come back UNDER the AGENTS.md §8 1000-physical-line ceiling. It is
 * a pure EXTRACTION: same two components, same props, same ternary on
 * `viewMode`, no new behaviour and no new authority. A scheduler officer sees
 * identical content.
 *
 * WHY IT IS SHARED BY THREE, not two. Before A6 C2 the page wrote this element
 * tree once and passed it to the mobile `Sheet` and the desktop review modal.
 * Slice 3 made the roster's teacher row a third consumer: a click on a compact
 * teacher card now opens a READ-ONLY profile dialog instead of expanding the
 * inline assignment editor, and that dialog renders this same node. Reusing it
 * is the whole point — a profile that could show different numbers from the
 * inspector sheet would be a second authority for one person's load.
 */
import { WorkloadInspector } from '@/components/faculty-assignments/WorkloadInspector';
import { SectionInspector } from '@/components/faculty-assignments/SectionInspector';
import type {
	EffectiveWorkloadPolicyState,
} from '@/lib/faculty-teaching-load-cache';
import type {
	ExternalSection,
	FacultySummary,
	LoadProfile,
	RotationFamilyTermBreakdown,
	SectionAssignedClassesResult,
} from '@/types';

export type TeachingLoadInspectorPanelProps = {
	viewMode: string;
	selected: FacultySummary | null;
	loadProfile: LoadProfile | null;
	rotationTermBreakdown: RotationFamilyTermBreakdown[];
	hoveredIncomingMinutes: number;
	previewLoadHours: number;
	isReadOnlyMode: boolean;
	activeTermIndex: number | null;
	teachingStandardHours: number | null;
	policyReady: boolean;
	writeBlockedReason: string | null;
	selectedSectionId: number | null;
	sectionMap: Map<number, ExternalSection>;
	selectedSectionContract: SectionAssignedClassesResult | null;
	effectiveOwnershipMap: Record<string, unknown>;
};

export function TeachingLoadInspectorPanel({
	viewMode,
	selected,
	loadProfile,
	rotationTermBreakdown,
	hoveredIncomingMinutes,
	previewLoadHours,
	isReadOnlyMode,
	activeTermIndex,
	teachingStandardHours,
	policyReady,
	writeBlockedReason,
	selectedSectionId,
	sectionMap,
	selectedSectionContract,
	effectiveOwnershipMap,
}: TeachingLoadInspectorPanelProps) {
	if (viewMode === 'teacher') {
		return (
			<WorkloadInspector
				selected={selected}
				loadProfile={loadProfile}
				rotationTermBreakdown={rotationTermBreakdown}
				hoveredIncomingMinutes={hoveredIncomingMinutes}
				previewLoadHours={previewLoadHours}
				isReadOnlyMode={isReadOnlyMode}
				activeTermIndex={activeTermIndex}
				teachingStandardHours={teachingStandardHours}
				policyReady={policyReady}
				writeBlockedReason={writeBlockedReason}
			/>
		);
	}
	return (
		<SectionInspector
			section={selectedSectionId ? sectionMap.get(selectedSectionId) ?? null : null}
			sectionContract={selectedSectionContract}
			effectiveOwnershipMap={effectiveOwnershipMap as never}
			writeBlockedReason={writeBlockedReason}
		/>
	);
}

/** Kept so the type-only import above is not elided as unused. */
export type { EffectiveWorkloadPolicyState };
