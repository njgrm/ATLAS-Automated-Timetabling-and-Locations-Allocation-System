import {
	buildFacultyReconciliationSummary,
	reconcileAssignmentScopesToSections,
	type AssignmentScopeSnapshot,
	type FacultySyncMode,
} from '../services/faculty.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}

function runReconciliation(mode: FacultySyncMode) {
	return buildFacultyReconciliationSummary(
		[
			{ id: 101, firstName: 'Maria', lastName: 'Santos', department: 'English', specialization: null, contactInfo: null },
			{ id: 102, firstName: 'Juan', lastName: 'Dela Cruz', department: 'Math', specialization: null, contactInfo: null },
		],
		[
			{
				id: 1,
				externalId: 101,
				firstName: 'Maria',
				lastName: 'Santos',
				department: 'English',
				specialization: null,
				employmentStatus: 'PERMANENT',
				isClassAdviser: false,
				advisoryEquivalentHours: 0,
				canTeachOutsideDepartment: false,
				contactInfo: null,
				advisedSectionId: null,
				advisedSectionName: null,
				isStale: false,
			},
			{
				id: 2,
				externalId: 999,
				firstName: 'Old',
				lastName: 'Teacher',
				department: 'MAPEH',
				specialization: null,
				employmentStatus: 'PERMANENT',
				isClassAdviser: false,
				advisoryEquivalentHours: 0,
				canTeachOutsideDepartment: false,
				contactInfo: null,
				advisedSectionId: null,
				advisedSectionName: null,
				isStale: false,
			},
		],
		mode,
	);
}

function runAssignmentScopePrune() {
	const assignments: AssignmentScopeSnapshot[] = [
		{ id: 1, sectionIds: [100, 200], gradeLevels: [7, 8] },
		{ id: 2, sectionIds: [999], gradeLevels: [10] },
		{ id: 3, sectionIds: [300], gradeLevels: [9] },
	];
	const sectionMap = new Map<number, number>([
		[100, 7],
		[300, 9],
	]);
	return reconcileAssignmentScopesToSections(assignments, sectionMap);
}

function run() {
	section('SYNC-RECON-01 deterministic parity summary');
	const reconcile = runReconciliation('reconcile');
	assertEqual(reconcile.inserted, 1, 'One upstream faculty is new');
	assertEqual(reconcile.updated, 0, 'No local faculty requires update');
	assertEqual(reconcile.skipped, 1, 'One existing faculty remains unchanged');
	assertEqual(reconcile.deactivated, 1, 'One missing local faculty is deactivated in reconcile mode');
	assertEqual(reconcile.removed, 0, 'Reconcile mode does not hard-remove missing faculty');

	section('SYNC-RECON-02 prune mode switches deactivated to removed');
	const prune = runReconciliation('prune');
	assertEqual(prune.deactivated, 0, 'Prune mode does not report deactivations');
	assertEqual(prune.removed, 1, 'Prune mode reports one hard-removed faculty');

	section('SYNC-RECON-03 idempotent summary for same input');
	const first = JSON.stringify(runReconciliation('prune'));
	const second = JSON.stringify(runReconciliation('prune'));
	assertEqual(first, second, 'Parity summary remains deterministic for repeated inputs');

	section('SYNC-RECON-04 assignment scope cleanup decisions');
	const decisions = runAssignmentScopePrune();
	const updated = decisions.find((decision) => decision.id === 1);
	const removed = decisions.find((decision) => decision.id === 2);
	const skipped = decisions.find((decision) => decision.id === 3);
	assert(updated?.action === 'update', 'Mixed-valid assignment is updated');
	assertEqual(JSON.stringify(updated?.sectionIds ?? []), JSON.stringify([100]), 'Updated assignment keeps only valid section IDs');
	assert(removed?.action === 'remove', 'Invalid-only assignment is removed');
	assert(skipped?.action === 'skip', 'Already-valid assignment is unchanged');

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run();
