import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';

import type { CenterViewMode, PreGenPendingPlacement } from '@/components/timetable/ScheduleReviewWorkspace.constants';

type ViewNavigationOptions = {
	centerView: CenterViewMode;
	setCenterView: Dispatch<SetStateAction<CenterViewMode>>;
	isLeftCollapsed: boolean;
	isRightCollapsed: boolean;
	leftPanelRef: RefObject<ImperativePanelHandle | null>;
	rightPanelRef: RefObject<ImperativePanelHandle | null>;
	preGenPending: PreGenPendingPlacement | null;
	draftPlacementCount: number;
	preGenMapContext: boolean;
	preGenOnboarding: boolean;
	setPreGenOnboarding: Dispatch<SetStateAction<boolean>>;
	setPendingAction: Dispatch<SetStateAction<'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | null>>;
	setPendingCenterSwitch: Dispatch<SetStateAction<(() => void) | null>>;
	setShowLeavePreGenDialog: Dispatch<SetStateAction<boolean>>;
	setPresentationMode: Dispatch<SetStateAction<'workflow' | 'matrix'>>;
};

export function useTimetableViewNavigation(options: ViewNavigationOptions) {
	const {
		centerView,
		setCenterView,
		isLeftCollapsed,
		isRightCollapsed,
		leftPanelRef,
		rightPanelRef,
		preGenPending,
		draftPlacementCount,
		preGenMapContext,
		preGenOnboarding,
		setPreGenOnboarding,
		setPendingAction,
		setPendingCenterSwitch,
		setShowLeavePreGenDialog,
		setPresentationMode,
	} = options;
	const panelSnapshot = useRef<{ left: boolean; right: boolean } | null>(null);

	const collapseSidePanels = useCallback(() => {
		panelSnapshot.current = { left: isLeftCollapsed, right: isRightCollapsed };
		leftPanelRef.current?.collapse();
		rightPanelRef.current?.collapse();
	}, [isLeftCollapsed, isRightCollapsed, leftPanelRef, rightPanelRef]);

	const restoreSidePanels = useCallback(() => {
		if (!panelSnapshot.current) return;
		if (!panelSnapshot.current.left) leftPanelRef.current?.expand();
		if (!panelSnapshot.current.right) rightPanelRef.current?.expand();
		panelSnapshot.current = null;
	}, [leftPanelRef, rightPanelRef]);

	const enterPolicyView = useCallback(() => {
		collapseSidePanels();
		setCenterView('policy');
	}, [collapseSidePanels, setCenterView]);

	const exitPolicyView = useCallback(() => {
		restoreSidePanels();
		setCenterView('schedule');
	}, [restoreSidePanels, setCenterView]);

	const enterManualEditView = useCallback((action: 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY') => {
		collapseSidePanels();
		setPendingAction(action);
		setCenterView('manual-edit');
	}, [collapseSidePanels, setCenterView, setPendingAction]);

	const exitManualEditView = useCallback(() => {
		restoreSidePanels();
		setPendingAction(null);
		setCenterView('schedule');
	}, [restoreSidePanels, setCenterView, setPendingAction]);

	const switchCenterViewWithGuard = useCallback((action: () => void) => {
		if (centerView === 'pre-generation' && (preGenPending != null || draftPlacementCount > 0)) {
			setPendingCenterSwitch(() => action);
			setShowLeavePreGenDialog(true);
			return;
		}
		action();
	}, [centerView, draftPlacementCount, preGenPending, setPendingCenterSwitch, setShowLeavePreGenDialog]);

	const returnToGeneratedRun = useCallback(() => {
		switchCenterViewWithGuard(() => {
			setCenterView('schedule');
			setPreGenOnboarding(false);
			try { localStorage.removeItem('atlas_pregen_active'); } catch { /* storage may be unavailable */ }
		});
	}, [setCenterView, setPreGenOnboarding, switchCenterViewWithGuard]);

	const handlePresentationModeChange = useCallback((mode: 'workflow' | 'matrix') => {
		setPresentationMode(mode);
		if (mode !== 'matrix') return;
		if (!['map', 'building', 'policy', 'manual-edit'].includes(centerView)) return;
		setCenterView(preGenMapContext || preGenOnboarding ? 'pre-generation' : 'schedule');
	}, [centerView, preGenMapContext, preGenOnboarding, setCenterView, setPresentationMode]);

	return {
		enterPolicyView,
		exitPolicyView,
		enterManualEditView,
		exitManualEditView,
		switchCenterViewWithGuard,
		returnToGeneratedRun,
		handlePresentationModeChange,
	};
}
