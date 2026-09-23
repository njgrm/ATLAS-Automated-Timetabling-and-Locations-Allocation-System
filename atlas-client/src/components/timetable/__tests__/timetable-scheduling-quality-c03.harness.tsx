import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { TimetableIssueRepairGuide } from '../TimetableIssueRepairGuide';

type HarnessState = { previewCalls: Array<Record<string, unknown>>; applyCalls: number };
const stateKey = 'atlas-c03-guide-state';
const state: HarnessState = JSON.parse(sessionStorage.getItem(stateKey) ?? '{"previewCalls":[],"applyCalls":0}');
const save = () => sessionStorage.setItem(stateKey, JSON.stringify(state));
(window as Window & { __c03State?: HarnessState }).__c03State = state;

const context = {
	selectedRunId: '316', runs: [{ id: 316 }], schoolYearId: 10, defaultSchoolId: 1,
	VIOLATION_LABELS: { FACULTY_TIME_CONFLICT: 'Teacher double-booked', ROOM_TIME_CONFLICT: 'Room double-booked' },
	sectionLabel: () => 'GR7 - Cedar', subjectLabel: () => 'Mathematics',
	formatConstraintMessage: () => 'A teacher has overlapping classes.',
	previewEdit: async (proposal: Record<string, unknown>) => { state.previewCalls.push(proposal); save(); return null; },
} as never;
const code: 'ROOM_TIME_CONFLICT' | 'FACULTY_TIME_CONFLICT' = new URLSearchParams(location.search).get('next') ? 'ROOM_TIME_CONFLICT' : 'FACULTY_TIME_CONFLICT';
const violation = {
	code, severity: 'HARD' as const, message: 'The saved schedule has a conflict.', schoolId: 1, schoolYearId: 10, runId: 316,
	entities: { facultyId: 12, roomId: 30, sectionId: 7, subjectId: 4, entryIds: ['entry-a', 'entry-b'], day: 'MONDAY', startTime: '08:00', endTime: '08:45' }, meta: { termIndex: 1 },
};

createRoot(document.getElementById('root')!).render(createElement(TimetableIssueRepairGuide, { context, violation }));
