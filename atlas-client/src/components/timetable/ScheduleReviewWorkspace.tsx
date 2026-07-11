import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useScheduleReviewWorkspaceState } from '@/hooks/useScheduleReviewWorkspaceState';
import { ScheduleReviewWorkspaceHeader } from '@/components/timetable/ScheduleReviewWorkspaceHeader';
import { ScheduleReviewWorkspaceBody } from '@/components/timetable/ScheduleReviewWorkspaceBody';
import { ScheduleReviewWorkspaceOverlays } from '@/components/timetable/ScheduleReviewWorkspaceOverlays';
import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';
import { Button } from '@/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ScheduleReviewWorkspace() {
	const state = useScheduleReviewWorkspaceState();

	if (state.loading && !state.draft) {
		return <TimetableSkeleton />;
	}

	if (state.error) {
		return (
			<div className="flex flex-col h-[calc(100svh-3.5rem)] items-center justify-center gap-4">
				<div className="flex items-center gap-2 text-destructive">
					<AlertCircle className="size-5" />
					<span className="text-sm font-medium">{state.error}</span>
				</div>
				<Button variant="outline" size="sm" onClick={() => state.loadAll()}>
					<RefreshCw className="size-3.5 mr-1.5" />
					Retry
				</Button>
			</div>
		);
	}
	if (!state.headerContext || !state.leftRailContentContext || !state.centerWorkspaceContext || !state.rightPanelContext || !state.overlaysContext) {
		return <TimetableSkeleton />;
	}

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)] relative">
			{state.loading && state.draft && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[2px] transition-all duration-150">
					<div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
						<RefreshCw className="size-8 animate-spin text-primary" />
						<div className="text-sm font-medium text-muted-foreground">Loading run data...</div>
					</div>
				</div>
			)}
			<div className={`h-0.5 shrink-0 bg-emerald-500 transition-opacity duration-150 ${state.showTopLoadingStrip ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
			{state.inlineActionStatus ? (
				<div
					className={`border-b px-3 py-1 text-xs ${
						state.inlineActionStatus.tone === 'error'
							? 'border-destructive/40 bg-destructive/10 text-destructive'
							: state.inlineActionStatus.tone === 'warning'
								? 'border-amber-400/40 bg-amber-50 text-amber-700'
								: state.inlineActionStatus.tone === 'success'
									? 'border-emerald-400/40 bg-emerald-50 text-emerald-700'
									: 'border-border bg-muted/30 text-muted-foreground'
					}`}
				>
					{state.inlineActionStatus.message}
				</div>
			) : null}
			<DndContext sensors={state.sensors} onDragStart={state.handleGlobalDragStart} onDragOver={state.handleGlobalDragOver} onDragEnd={state.handleGlobalDragEnd}>
				<ScheduleReviewWorkspaceHeader context={state.headerContext} />
				<ScheduleReviewWorkspaceBody
					context={{
						leftPanelRef: state.leftPanelRef,
						setIsLeftCollapsed: state.setIsLeftCollapsed,
						isLeftCollapsed: state.isLeftCollapsed,
						isPreGenerationWorkspace: state.isPreGenerationWorkspace,
						leftTab: state.leftTab,
						setLeftTab: state.setLeftTab,
						violations: state.violations,
						summary: state.summary,
						roomRequestSummary: state.roomRequestSummary,
						leftRailContentContext: state.leftRailContentContext,
						centerWorkspaceContext: state.centerWorkspaceContext,
						rightPanelContext: state.rightPanelContext,
					}}
				/>
				<DragOverlay dropAnimation={null}>
					{state.dragItem && (
						<div className="rounded border border-primary/60 bg-card shadow-md px-2.5 py-1.5 text-xs font-medium pointer-events-none select-none">
							{state.dragItem.type === 'entry'
								? state.subjectLabel(state.dragItem.entry.subjectId)
								: state.dragItem.type === 'draftQueue'
									? `${state.dragItem.item.subjectCode} \u00B7 ${state.dragItem.item.sectionName}`
									: state.dragItem.type === 'draftPlacement'
										? `Draft \u00B7 ${state.subjectLabel(state.dragItem.placement.subjectId)}`
										: `${state.subjectLabel(state.dragItem.item.subjectId)} \u00B7 ${state.sectionLabel(state.dragItem.item.sectionId)}`
							}
						</div>
					)}
				</DragOverlay>
			</DndContext>
			<ScheduleReviewWorkspaceOverlays context={state.overlaysContext} />
		</div>
	);
}
