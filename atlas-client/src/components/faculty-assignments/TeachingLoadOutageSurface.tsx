/**
 * A6 c5 — ONE node for the shortage line and the cover dialog it opens.
 *
 * WHY THEY ARE ONE COMPONENT, and it is not tidiness.
 *
 * The line and the dialog are two halves of ONE action: the line is the claim,
 * the dialog is the fix, and the packet's whole complaint is that reaching the
 * fix cost a side-nav detour. Splitting them across two page-level nodes would
 * mean the page wires the same `outage` object twice and keeps two places to
 * look when the two ever disagree.
 *
 * The dialog PORTALS, so rendering it from inside the header's status slot is
 * not a layout decision — `DialogContent` lands on `document.body` wherever the
 * trigger lives. The header keeps its POSITION (it owns the row), this
 * component owns both halves of the content, and the page owns neither.
 *
 * WHAT THE PAGE KEEPS. One `useTeachingLoadOutage` call, one prop, and one
 * `shortageLineSlot`. Everything the scheduler reads about an outage is decided
 * in `teachingLoadOutage.ts` and rendered here.
 */
import type { ReactNode } from 'react';

import { CoverShortageDialog } from '@/components/faculty-assignments/CoverShortageDialog';
import { TeachingLoadShortageLine } from '@/components/faculty-assignments/TeachingLoadShortageLine';
import type { useTeachingLoadOutage } from '@/hooks/useTeachingLoadOutage';

type Outage = ReturnType<typeof useTeachingLoadOutage>;

export type TeachingLoadOutageSurfaceProps = {
	outage: Outage;
	/** The page's own write gate, so a read-only workspace never offers the action. */
	writeBlockedReason: string | null;
	/** The existing coverage detail, which `+N more` links to. */
	onShowCoverageDetail: () => void;
	/** Rendered when there is no verified shortage — currently nothing. */
	children?: ReactNode;
};

export function TeachingLoadOutageSurface({
	outage,
	writeBlockedReason,
	onShowCoverageDetail,
	children = null,
}: TeachingLoadOutageSurfaceProps) {
	const { cover, shortageLine, shortage, primarySubject, isLive } = outage;
	if (!isLive) return <>{children}</>;

	return (
		<>
			<TeachingLoadShortageLine
				line={shortageLine}
				totalShortClasses={shortage.totalShortClasses}
				primarySubject={primarySubject}
				writeBlockedReason={writeBlockedReason}
				onCover={cover.openFor}
				onShowCoverageDetail={onShowCoverageDetail}
			/>
			<CoverShortageDialog
				open={cover.open}
				onOpenChange={(next) => { if (!next) cover.close(); }}
				subjectName={cover.subjectName}
				shortClassCount={primarySubject?.shortClassCount ?? 0}
				selectedOptionId={cover.selectedOptionId}
				onSelectOption={cover.onSelectOption}
				previews={cover.previews}
				previewClassNames={cover.previewClassNames}
				previewPending={cover.previewPending}
				previewError={cover.previewError}
				drift={cover.drift}
				outcome={cover.outcome}
				applying={cover.applying}
				applyError={cover.applyError}
				writeBlockedReason={writeBlockedReason}
				onPreview={cover.onPreview}
				onApply={cover.onApply}
			/>
		</>
	);
}
