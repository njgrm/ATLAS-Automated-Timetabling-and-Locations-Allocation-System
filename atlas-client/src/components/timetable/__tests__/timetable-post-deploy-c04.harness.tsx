import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TimetableFacultyIssuePivotDialog } from '../TimetableFacultyIssuePivotDialog';
import { requiresFacultyIssueConfirmation, resolveViolationFacultyTarget } from '@/lib/timetable-entry-pivot';

declare global {
	interface Window {
		__c04State?: { viewMode: string; entityFilter: string; selectedEntry: string; selectedViolation: string; confirmCount: number };
	}
}

function Harness() {
	const [state, setState] = useState({ viewMode: 'section', entityFilter: '7', selectedEntry: 'existing', selectedViolation: 'existing-issue', confirmCount: 0 });
	const [pending, setPending] = useState<{ facultyId: number; teacherLabel: string; entryId: string | null; violationCode: string } | null>(null);
	const violation = { code: 'FACULTY_CONSECUTIVE_MINUTES', entities: { facultyId: 12, entryIds: ['unrelated-first', 'affected-second'] } } as any;
	const entries = [{ entryId: 'unrelated-first', facultyId: 9 }, { entryId: 'affected-second', facultyId: 12 }] as any;
	const facultyById = new Map([[12, { firstName: 'Luz', lastName: 'Fernandez' }]]);
	const publish = (next: typeof state) => {
		setState(next);
		window.__c04State = next;
	};
	window.__c04State = state;
	return (
		<main>
			<button type="button" onClick={() => publish({ ...state, confirmCount: state.confirmCount + 1 })}>Underlying timetable cell</button>
			<button type="button" onClick={() => {
				const target = resolveViolationFacultyTarget({ violation, entries, facultyIds: new Set(facultyById.keys()) });
				const faculty = target.facultyId == null ? null : facultyById.get(target.facultyId) ?? null;
				if (target.facultyId != null && faculty && requiresFacultyIssueConfirmation({ viewMode: state.viewMode as 'section' | 'faculty' | 'room', entityFilter: state.entityFilter, facultyId: target.facultyId, canonicalFacultyExists: true })) {
					setPending({ facultyId: target.facultyId, teacherLabel: `${faculty.lastName}, ${faculty.firstName}`, entryId: target.entry?.entryId ?? null, violationCode: violation.code });
				}
			}}>Select Fernandez issue</button>
			<output data-testid="c04-state">{JSON.stringify(state)}</output>
			<TimetableFacultyIssuePivotDialog
				open={pending != null}
				teacherLabel={pending?.teacherLabel ?? null}
				onOpenChange={(open) => { if (!open) setPending(null); }}
				onCancel={() => setPending(null)}
				onConfirm={() => {
					if (!pending) return;
					publish({ viewMode: 'faculty', entityFilter: String(pending.facultyId), selectedEntry: pending.entryId ?? '', selectedViolation: pending.violationCode, confirmCount: state.confirmCount + 1 });
					setPending(null);
				}}
			/>
		</main>
	);
}

createRoot(document.getElementById('root')!).render(<Harness />);
