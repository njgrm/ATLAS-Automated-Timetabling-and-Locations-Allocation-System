import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanonicalDisplayGrid, buildDayScopedEventWindows } from '../services/schedule-constructor.js';
import { resolveBreakWindowsForScope } from '../services/warning-window-authority.service.js';
import { upsertSpecialEvents } from '../services/policy-special-event.service.js';
import { withDataContext } from '../lib/data-context.js';
import { upsertPolicy } from '../services/scheduling-policy.service.js';

const classRows = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:45', endTime: '07:30', rowKind: 'CLASS' },
	{ gradeLevel: 9, programType: 'REGULAR', startTime: '12:15', endTime: '13:00', rowKind: 'CLASS' },
];
const scopedEvents = [
	{ eventType: 'FLAG_OR_HGP', label: 'Legacy Global Flag', gradeGroup: null, programType: null, startTime: '07:00', endTime: '07:30', enabled: true },
	{ eventType: 'FLAG_OR_HGP', label: 'Flag / HGP', gradeGroup: '7-8', programType: null, startTime: '06:50', endTime: '07:20', enabled: true },
	{ eventType: 'FLAG_OR_HGP', label: 'Flag / HGP', gradeGroup: '9-10', programType: null, startTime: '12:20', endTime: '12:50', enabled: true },
];
const policyBase = {
	maxConsecutiveTeachingMinutesBeforeBreak: 120,
	minBreakMinutesAfterConsecutiveBlock: 15,
	maxTeachingMinutesPerDay: 420,
	earliestStartTime: '06:00',
	latestEndTime: '17:00',
};

test('P07 keeps both scoped overlays in the canonical union, on Monday and within their own class rows', () => {
	const grid = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, enableFlagCeremony: true, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30', specialEvents: scopedEvents } });
	const overlays = grid.specialEventSlots.filter((slot) => slot.isSpecialEvent);
	assert.deepEqual(overlays.map(({ startTime, endTime, dayOfWeek }) => ({ startTime, endTime, dayOfWeek })), [
		{ startTime: '06:45', endTime: '07:30', dayOfWeek: 'MONDAY' },
		{ startTime: '12:15', endTime: '13:00', dayOfWeek: 'MONDAY' },
	]);
	assert.deepEqual(grid.specialEventWindowScopes, [
		{ appliesToAll: false, gradeLevels: [7, 8], programTypes: [] },
		{ appliesToAll: false, gradeLevels: [9, 10], programTypes: [] },
	]);
	assert.deepEqual(buildDayScopedEventWindows({ ...policyBase, specialEvents: scopedEvents }, classRows), [], 'overlays do not become capacity blocks');
});

test('P07 rejects non-containing overlays and scoped authority suppresses the global warning fallback', () => {
	const invalid = [{ ...scopedEvents[0], startTime: '08:00', endTime: '08:30' }];
	const grid = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, specialEvents: invalid } });
	assert.equal(grid.specialEventSlots.some((slot) => slot.isSpecialEvent), false);
	const warnings = resolveBreakWindowsForScope({
		policyRow: { enableFlagCeremony: true, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30' },
		specialEvents: scopedEvents,
		gradeLevel: 7,
		programType: 'REGULAR',
	});
	assert.equal(warnings.some((window) => window.eventType === 'FLAG_OR_HGP'), false);
});

test('P07 scoped save retires persisted global Flag authority; disabled scopes stay disabled and re-enable independently', async () => {
	const persistedEvents: Array<Record<string, any>> = [
		{ id: 1, schoolId: 1, schoolYearId: 2, eventType: 'FLAG_OR_HGP', label: 'Legacy Global Flag', gradeGroup: null, programType: null, startTime: '07:00', endTime: '07:30', enabled: true, sortOrder: 1 },
		{ id: 2, schoolId: 1, schoolYearId: 2, eventType: 'LUNCH_BREAK', label: 'Lunch', gradeGroup: '7-8', programType: null, startTime: '12:15', endTime: '13:00', enabled: true, sortOrder: 2 },
		{ id: 3, schoolId: 99, schoolYearId: 2, eventType: 'FLAG_OR_HGP', label: 'Other School Flag', gradeGroup: null, programType: null, startTime: '07:00', endTime: '07:30', enabled: true, sortOrder: 1 },
	];
	const persistedPolicy = { enableFlagCeremony: true };
	const db = {
		policySpecialEvent: {
			findMany: async ({ where }: any) => persistedEvents.filter((row) => row.schoolId === where.schoolId && row.schoolYearId === where.schoolYearId && (where.gradeGroup === undefined || row.gradeGroup === where.gradeGroup || (where.gradeGroup?.not === null && row.gradeGroup !== null))),
			updateMany: async ({ where, data }: any) => {
				let count = 0;
				for (const row of persistedEvents) {
					if (where.id.in.includes(row.id)) { Object.assign(row, data); count += 1; }
				}
				return { count };
			},
			findFirst: async ({ where }: any) => persistedEvents.find((row) => row.schoolId === where.schoolId && row.schoolYearId === where.schoolYearId && row.eventType === where.eventType && row.gradeGroup === where.gradeGroup && row.programType === where.programType) ?? null,
			update: async ({ where, data }: any) => {
				const row = persistedEvents.find((item) => item.id === where.id)!;
				Object.assign(row, data);
				return row;
			},
			create: async ({ data }: any) => {
				const row = { ...data, id: persistedEvents.length + 1, schoolId: 1, schoolYearId: 2 };
				persistedEvents.push(row);
				return row;
			},
		},
		schedulingPolicy: {
			updateMany: async ({ data }: any) => { Object.assign(persistedPolicy, data); return { count: 1 }; },
			upsert: async ({ create, update }: any) => { Object.assign(persistedPolicy, { ...create, ...update }); return { id: 1, schoolId: 1, schoolYearId: 2, ...persistedPolicy }; },
		},
		gradeShiftWindow: { findMany: async () => [] },
		$executeRawUnsafe: async () => 1,
	} as any;
	const currentSchoolEvents = () => persistedEvents.filter((row) => row.schoolId === 1 && row.schoolYearId === 2);
	const morning = { eventType: 'FLAG_OR_HGP' as const, label: 'Flag / HGP', gradeGroup: '7-8' as const, programType: null, startTime: '06:50', endTime: '07:20', enabled: false, sortOrder: 1 };
	const afternoon = { ...morning, gradeGroup: '9-10' as const, startTime: '12:20', endTime: '12:50', sortOrder: 2 };

	await upsertSpecialEvents(1, 2, [morning, afternoon], db);
	assert.equal(persistedPolicy.enableFlagCeremony, false, 'scoped save retires the old policy-row global fallback');
	assert.equal(persistedEvents.find((row) => row.id === 1)?.enabled, false, 'scoped save disables the persisted global special-event fallback');
	assert.deepEqual(persistedEvents.filter((row) => row.eventType === 'FLAG_OR_HGP' && row.gradeGroup != null).map((row) => [row.gradeGroup, row.enabled]), [['7-8', false], ['9-10', false]]);
	const disabledGrid = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, ...persistedPolicy, specialEvents: currentSchoolEvents() as any } });
	assert.equal(disabledGrid.specialEventSlots.some((slot) => slot.isSpecialEvent && /FLAG|HGP/i.test(slot.eventName ?? '')), false, 'a disabled scoped row does not borrow the retired global window');
	const disabledWarnings = resolveBreakWindowsForScope({ policyRow: { ...persistedPolicy, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30' }, specialEvents: currentSchoolEvents() as any, gradeLevel: 7, programType: 'REGULAR' });
	assert.equal(disabledWarnings.some((window) => window.eventType === 'FLAG_OR_HGP'), false, 'warning authority has no global fallback');
	assert.equal(persistedEvents.find((row) => row.id === 2)?.enabled, true, 'unrelated special events are preserved');
	assert.equal(persistedEvents.find((row) => row.id === 3)?.enabled, true, 'another school’s global row is untouched');

	// Failing-first persistence regression: an old caller writes the global row
	// after scoped controls were saved. The durable scope must win on reads.
	await upsertSpecialEvents(1, 2, [{ eventType: 'FLAG_OR_HGP', label: 'Legacy Global Flag', gradeGroup: null, programType: null, startTime: '07:00', endTime: '07:30', enabled: true }], db);
	const afterLegacyWrite = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, ...persistedPolicy, specialEvents: currentSchoolEvents() as any } });
	assert.equal(persistedEvents.find((row) => row.id === 1)?.enabled, false, 'later global writes cannot re-enable the retired global event');
	assert.equal(afterLegacyWrite.specialEventSlots.some((slot) => slot.isSpecialEvent && /FLAG|HGP/i.test(slot.eventName ?? '')), false, 'resolver output remains empty while both scopes are disabled');
	await withDataContext(db, () => upsertPolicy(1, 2, { enableFlagCeremony: true }));
	assert.equal(persistedPolicy.enableFlagCeremony, false, 'the scheduling-policy route cannot restore the legacy global switch');
	const afterPolicyWrite = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, ...persistedPolicy, specialEvents: currentSchoolEvents() as any } });
	assert.equal(afterPolicyWrite.specialEventSlots.some((slot) => slot.isSpecialEvent && /FLAG|HGP/i.test(slot.eventName ?? '')), false, 'resolver output remains empty after a later global policy write');

	await upsertSpecialEvents(1, 2, [{ ...morning, enabled: true }, afternoon], db);
	const enabledGrid = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, ...persistedPolicy, specialEvents: currentSchoolEvents() as any } });
	assert.deepEqual(enabledGrid.specialEventSlots.filter((slot) => slot.isSpecialEvent).map(({ startTime, endTime, dayOfWeek }) => ({ startTime, endTime, dayOfWeek })), [
		{ startTime: '06:45', endTime: '07:30', dayOfWeek: 'MONDAY' },
	]);
	assert.equal(persistedEvents.find((row) => row.id === 1)?.enabled, false, 're-enabling one scope never re-enables the legacy global row');
});
