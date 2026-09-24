import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { TimetableSubNav } from '../TimetableSubNav';
import { TimetableRouteViewSync } from '../TimetableRouteViewSync';
import { TimetablePublishedReturnAction } from '../TimetablePublishedReturnAction';
import { usePublishedTimetableReturnState } from '../../../hooks/usePublishedTimetableReturnState';
import { restorePublishedTimetableContext } from '../../../lib/timetable-published-return';

declare global {
	interface Window {
		__c05State?: { centerView: string; runId: string; termFilter: number; viewMode: string; entityFilter: string };
	}
}

function MountedTimetable() {
	const location = useLocation();
	const navigate = useNavigate();
	const [centerView, setCenterView] = useState('schedule');
	const [runId, setRunId] = useState('317');
	const [termFilter, setTermFilter] = useState<'all' | number>(2);
	const [viewMode, setViewMode] = useState<'section' | 'faculty' | 'room'>('faculty');
	const [entityFilter, setEntityFilter] = useState('12');
	const returnState = usePublishedTimetableReturnState({
		centerView,
		isPublished: runId === '317',
		runId,
		termFilter,
		viewMode,
		entityFilter,
	});
	const publishState = () => {
		window.__c05State = { centerView, runId, termFilter: Number(termFilter), viewMode, entityFilter };
	};
	publishState();
	const returnToPublished = () => {
		const saved = returnState.snapshot;
		if (!restorePublishedTimetableContext(saved, { setRunId, setTermFilter, setViewMode, setEntityFilter })) return;
		returnState.clear();
		setCenterView('schedule');
		navigate('/timetable');
	};

	return (
		<main>
			<TimetableRouteViewSync
				centerView={centerView}
				switchCenterViewWithGuard={(action) => action()}
				enterPolicyView={() => setCenterView('policy')}
				exitPolicyView={() => setCenterView('schedule')}
				enterPreGenerationView={() => setCenterView('pre-generation')}
				enterMapView={() => setCenterView('map')}
				enterManualEditView={() => setCenterView('manual-edit')}
				enterBuildingView={() => setCenterView('building')}
				enterRunsView={() => setCenterView('runs')}
				enterSetupView={() => setCenterView('setup')}
				leaveDialogOpen={false}
			/>
			<TimetableSubNav />
			<output data-testid="c05-route">{location.pathname}</output>
			<output data-testid="c05-center-view">{centerView}</output>
			<output data-testid="c05-context">{JSON.stringify(window.__c05State)}</output>
			<TimetablePublishedReturnAction visible={centerView === 'pre-generation' && returnState.snapshot != null} onReturn={returnToPublished} />
		</main>
	);
}

createRoot(document.getElementById('root')!).render(
	<MemoryRouter initialEntries={['/timetable']}>
		<Routes><Route path="*" element={<MountedTimetable />} /></Routes>
	</MemoryRouter>,
);
