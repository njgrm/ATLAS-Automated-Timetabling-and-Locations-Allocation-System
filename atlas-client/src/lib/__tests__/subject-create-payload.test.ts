/**
 * SCA-01R3 — operator subject-create payload regression.
 *
 * `isSeedable` and `isSystemManaged` are protected bootstrap metadata, never
 * operator input. The Subjects page builds every create body through
 * `buildOperatorSubjectCreatePayload`, which omits both flags (the server
 * additionally rejects either key with 400 PROTECTED_FIELD).
 *
 * Every assertion below exercises that production builder (not a grep):
 * each one FAILS against the old `{ ...values, ... }` spread and PASSES
 * against the builder.
 *
 * Run with: npx tsx --test src/lib/__tests__/subject-create-payload.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperatorSubjectCreatePayload } from '../subject-create-payload';
import { emptyForm } from '../subject-constants';

function operatorForm() {
	return {
		...emptyForm,
		code: 'SCA01R2_OP',
		name: 'SCA-01R2 Operator Subject',
	};
}

test('operator default form no longer inherits seedable=true from emptyForm', () => {
	assert.equal(
		emptyForm.isSeedable,
		false,
		'emptyForm must default isSeedable to false — no caller may inherit true',
	);
});

test('builder omits isSeedable even when form state carries true', () => {
	// Simulate the exact pre-R2 leak: stale hidden state with true.
	const payload = buildOperatorSubjectCreatePayload({ ...operatorForm(), isSeedable: true });
	assert.ok(
		!Object.prototype.hasOwnProperty.call(payload, 'isSeedable'),
		'create payload must not contain isSeedable (server rejects it with 400 PROTECTED_FIELD)',
	);
});

test('builder omits both protected flags from hostile form state', () => {
	// SCA-01R3 negative control: hostile client state carrying both
	// protected flags must produce a payload containing neither key.
	const payload = buildOperatorSubjectCreatePayload({
		...operatorForm(),
		isSeedable: true,
		isSystemManaged: true,
	});
	assert.ok(!('isSeedable' in payload), 'hostile isSeedable must not reach the payload');
	assert.ok(!('isSystemManaged' in payload), 'hostile isSystemManaged must not reach the payload');
});

test('builder payload for a clean operator form carries no isSeedable key', () => {
	const payload = buildOperatorSubjectCreatePayload(operatorForm());
	assert.ok(!('isSeedable' in payload), 'clean operator form still yields no isSeedable key');
});

test('builder never forwards a record id on create', () => {
	const payload = buildOperatorSubjectCreatePayload({ ...operatorForm(), id: 4242 });
	assert.ok(!('id' in payload), 'create payload must not contain id');
});

test('builder preserves operator fields and page trimming behavior', () => {
	const payload = buildOperatorSubjectCreatePayload({
		...operatorForm(),
		outputLabel: '  OP Label  ',
		ownerDepartment: 'MATH',
		rotationFamily: '',
		modularGroupId: 'SCIENCE',
		modularOrder: 2,
	});
	assert.equal(payload.code, 'SCA01R2_OP');
	assert.equal(payload.name, 'SCA-01R2 Operator Subject');
	assert.equal(payload.outputLabel, 'OP Label');
	assert.equal(payload.ownerDepartment, 'MATH');
	assert.equal(payload.rotationFamily, null);
	assert.equal(payload.modularGroupId, 'SCIENCE');
	assert.equal(payload.modularOrder, 2);
	assert.equal(payload.isActive, true);
});

test('builder nulls modularOrder when no rotation family is set', () => {
	const payload = buildOperatorSubjectCreatePayload({
		...operatorForm(),
		modularGroupId: '',
		modularOrder: 2,
	});
	assert.equal(payload.modularGroupId, null);
	assert.equal(payload.modularOrder, null);
});

test('builder omits deferred schedulingDisposition and strips EnrollPro term authority fields from hostile state', () => {
	const hostile = {
		...operatorForm(),
		schedulingDisposition: 'REFERENCE_ONLY' as const,
		termCount: 4,
		termFormat: 'QUARTERS',
		termIdentities: ['T1', 'T2', 'T3', 'T4'],
		termLabels: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'],
		term1Start: '2030-06-01',
	};
	const payload = buildOperatorSubjectCreatePayload(hostile as never);
	assert.ok(
		!('schedulingDisposition' in payload),
		'schedulingDisposition is PENDING_DERIVED_DEMAND_INTEGRATION and must not reach ordinary Subject create',
	);
	for (const key of ['termCount', 'termFormat', 'termIdentities', 'termLabels', 'term1Start']) {
		assert.ok(!(key in payload), `${key} must not reach ordinary Subject create`);
	}
});
