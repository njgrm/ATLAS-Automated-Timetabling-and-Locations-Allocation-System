import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { capabilitiesForRole, resolveEnrollProSessionAuthority } from '../services/scheduler-capabilities.js';
import { assertRequestSchoolScope } from '../middleware/authorize.js';

test('application role claims cannot grant scheduler capability without a verified ancillary grant', () => {
	assert.equal(resolveEnrollProSessionAuthority(['TEACHER', 'GRADE_LEVEL_COORDINATOR'], false).role, 'faculty');
	assert.equal(resolveEnrollProSessionAuthority(['TEACHER', 'GRADE_LEVEL_COORDINATOR'], true).role, 'scheduler');
	assert.equal(resolveEnrollProSessionAuthority(['GRADE_LEVEL_COORDINATOR'], false).role, null);
	assert.ok(capabilitiesForRole('admin', []).includes('system:admin'), 'local admin capability behavior remains unchanged');
});

test('route school guard fails closed for malformed or unresolved actor scope and passes only exact scope', () => {
	const invoke = (actorSchoolId: unknown, pathSchoolId: string) => {
		let status = 200;
		const accepted = assertRequestSchoolScope(
			{ user: { schoolId: actorSchoolId } as never, params: { schoolId: pathSchoolId } } as never,
			{ status: (value: number) => { status = value; return { json: () => undefined }; } } as never,
			Number(pathSchoolId),
		);
		return { status, accepted };
	};
	assert.deepEqual(invoke(7, '7'), { status: 200, accepted: true });
	assert.deepEqual(invoke(8, '7'), { status: 403, accepted: false });
	assert.deepEqual(invoke(undefined, '7'), { status: 403, accepted: false });
	assert.deepEqual(invoke('7', '7'), { status: 403, accepted: false });
	assert.deepEqual(invoke(7, 'invalid'), { status: 400, accepted: false });
});

test('publication approval schema and SQL bind actors, school, and immutable run scope', () => {
	const root = resolve(import.meta.dirname, '../../../');
	const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
	const migration = readFileSync(resolve(root, 'prisma/migrations/20260923000000_publication_approval_requests/migration.sql'), 'utf8');
	const requestModel = schema.slice(schema.indexOf('model PublicationApprovalRequest'), schema.indexOf('// ─── Manual Schedule Edit ───'));
	assert.match(requestModel, /requester\s+AtlasAuthAccount\s+@relation/);
	assert.match(requestModel, /approver\s+AtlasAuthAccount\?\s+@relation/);
	assert.match(requestModel, /school\s+School\s+@relation/);
	assert.match(requestModel, /references:\s*\[id,\s*schoolId,\s*schoolYearId\]/);
	assert.match(schema, /@@unique\(\[id,\s*schoolId,\s*schoolYearId\]/);
	assert.match(migration, /FOREIGN KEY \(run_id, school_id, school_year_id\)\s+REFERENCES generation_runs\(id, school_id, school_year_id\)/);
	assert.match(migration, /FOREIGN KEY \(requester_id\)\s+REFERENCES atlas_auth_accounts\(id\)/);
	assert.match(migration, /FOREIGN KEY \(approver_id\)\s+REFERENCES atlas_auth_accounts\(id\) ON DELETE SET NULL/);
	assert.match(migration, /FOREIGN KEY \(school_id\)\s+REFERENCES schools\(id\)/);
});

test('scheduler-admitted routes check actor school before service dispatch', () => {
	const root = resolve(import.meta.dirname, '../../../');
	for (const file of [
		'generation.router.ts', 'scheduling-policy.router.ts', 'pre-generation-draft.router.ts', 'manual-edit.router.ts',
		'locked-session.router.ts', 'timetable-quick-place.router.ts',
	]) {
		const source = readFileSync(resolve(root, 'atlas-server/src/routes', file), 'utf8');
		assert.match(source, /assertRequestSchoolScope/, `${file} must bind actor school`);
	}
});

test('local and companion SSO resolve scheduler authority from the current active-year ancillary feed', () => {
	const root = resolve(import.meta.dirname, '../../../');
	const local = readFileSync(resolve(root, 'atlas-server/src/services/local-auth.service.ts'), 'utf8');
	const companion = readFileSync(resolve(root, 'atlas-server/src/services/companion-sso.service.ts'), 'utf8');
	assert.match(local, /tryEnrollProVerify\(identifier, params\.password\)/);
	assert.match(local, /resolveSchedulerAncillaryAuthority\(user\.employeeId\)/);
	assert.match(local, /resolveEnrollProSessionAuthority\(roles, ancillary\.verified && ancillary\.eligible\)/);
	assert.match(local, /data:\s*\{ role: effectiveRole \}/);
	assert.match(local, /AUTH_SCHEDULER_VERIFICATION_REQUIRED/);
	assert.match(local, /Your current EnrollPro roles do not grant ATLAS scheduler access\./);
	assert.match(companion, /resolveSchedulerAncillaryAuthority\(identity\.employeeId, \{\}, identity\.activeSchoolYearId\)/);
	assert.match(companion, /resolveEnrollProSessionAuthority\(identity\.roles, ancillary\?\.verified === true && ancillary\.eligible\)/);
	assert.match(companion, /data:\s*\{ facultyId: canonicalFacultyId, role: effectiveRole/);
	assert.match(companion, /COMPANION_SSO_ROLE_DENIED/);
});
