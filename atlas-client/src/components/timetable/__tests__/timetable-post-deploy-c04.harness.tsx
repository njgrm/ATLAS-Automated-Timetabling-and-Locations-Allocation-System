import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TimetableFacultyIssuePivotDialog } from '../TimetableFacultyIssuePivotDialog';

declare global {
	interface Window {
		__c04State?: { viewMode: string; entityFilter: string; selectedEntry: string; selectedViolation: string; confirmCount: number };
	}
}

function Harness() {
	const [open, setOpen] = useState(true);
	const [state, setState] = useState({ viewMode: 'section', entityFilter: '7', selectedEntry: 'existing', selectedViolation: 'existing-issue', confirmCount: 0 });
	const publish = (next: typeof state) => {
		setState(next);
		window.__c04State = next;
	};
	window.__c04State = state;
	return (
		<main>
			<button type="button" onClick={() => publish({ ...state, confirmCount: state.confirmCount + 1 })}>Underlying timetable cell</button>
			<button type="button" onClick={() => setOpen(true)}>Select faculty issue</button>
			<output data-testid="c04-state">{JSON.stringify(state)}</output>
			<TimetableFacultyIssuePivotDialog
				open={open}
				teacherLabel="Fernandez, Luz"
				onOpenChange={setOpen}
				onCancel={() => setOpen(false)}
				onConfirm={() => {
					publish({ viewMode: 'faculty', entityFilter: '12', selectedEntry: 'affected-session', selectedViolation: 'consecutive-minutes', confirmCount: state.confirmCount + 1 });
					setOpen(false);
				}}
			/>
		</main>
	);
}

createRoot(document.getElementById('root')!).render(<Harness />);
