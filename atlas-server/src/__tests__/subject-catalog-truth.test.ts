/**
 * SCA-01 — Subjects catalog truth focused verification.
 *
 * Proves through production service/route paths on a disposable school:
 * 1. create/patch/archive/reactivate/delete-preview/delete-apply full cycle;
 * 2. invalid enum/array/minute/scope/term inputs return stable typed 4xx;
 * 3. a conflicting body schoolId is rejected (never silently accepted);
 * 4. passive GET + bootstrap reconciliation perform zero writes to existing rows;
 * 5. catalog reads order by name (no isSeedable priority).
 *
 * Negative controls: stale versions (STALE_WRITE), cross-school actors
 * (CROSS_SCHOOL_DENIED), and fingerprint-less deletes prove the guards are
 * live — these assertions fail if the guards are bypassed.
 *
 * Run with: npx tsx src/__tests__/subject-catalog-truth.test.ts
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import {
	createSubject,
	updateSubjectAtomic,
	transitionSubjectActiveStateAtomic,
	previewSubjectDeletion,
	applySubjectDeletion,
	validateAndFilterPatchFields,
	getSubjectsBySchool,
	getSubjectById,
	ensureDefaultSubjects,
} from '../services/subject.service.js';

// Disposable fixture school — NEVER canonical school 1.
const SCHOOL = 99994;
const PORT = 5996;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string) {
	if (condition) { passed += 1; console.log(`  OK ${label}`); return; }
	failed += 1; console.error(`  FAIL ${label}`);
}

async function expectCode(action: () => Promise<unknown>, code: string, label: string) {
	try {
		await action();
		ok(false, `${label} — expected ${code}, got success`);
	} catch (error) {
		ok((error as { code?: string }).code === code, `${label} — expected ${code}, got ${(error as { code?: string }).code ?? (error as Error).message}`);
	}
}

function expectPatchError(raw: Record<string, unknown>, code: string, label: string) {
	const result = validateAndFilterPatchFields(raw);
	if (result.ok) {
		ok(false, `${label} — expected ${code}, got ok`);
		return;
	}
	ok(result.error.code === code, `${label} — expected ${code}, got ${result.error.code}`);
}

async function fetchJson(path: string, options?: RequestInit): Promise<{ status: number; body: any }> {
	const res = await fetch(`${BASE}${path}`, {
		...options,
		headers: { 'Content-Type': 'application/json', ...options?.headers },
	});
	const body = await res.json().catch(() => null);
	return { status: res.status, body };
}

function officerToken(schoolId: number): string {
	const secret = process.env.JWT_SECRET || 'test-secret';
	return jwt.sign({ userId: 1, role: 'officer', schoolId, authSource: 'local' }, secret, { expiresIn: '1h' });
}

async function cleanup() {
	await prisma.subject.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.school.deleteMany({ where: { id: SCHOOL } });
}

async function main() {
	await prisma.school.upsert({
		where: { id: SCHOOL },
		create: { id: SCHOOL, name: 'SCA-01 Truth School', shortName: 'SCA1' },
		update: {},
	});
	await prisma.subject.deleteMany({ where: { schoolId: SCHOOL } });

	console.log('=== 1. create validation parity (typed 4xx, never Prisma 500) ===');
	{
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_ROOM', name: 'Bad Room', minMinutesPerWeek: 225, preferredRoomType: 'SWIMMING_POOL', gradeLevels: [7] }),
			'INVALID_ROOM_TYPE', 'unknown room type rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_SCOPE', name: 'Bad Scope', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['HOGWARTS'] as any }),
			'INVALID_PROGRAM_SCOPES', 'unknown program scope rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'DUPE_GRADES', name: 'Dupe Grades', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 7] }),
			'DUPLICATE_VALUES', 'duplicate grades rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_TERM', name: 'Bad Term', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], termCount: 0 }),
			'PROTECTED_TERM_AUTHORITY', 'Subject CRUD cannot write EnrollPro term authority',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: '   ', name: 'Blank Code', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7] }),
			'INVALID_SUBJECT_CODE', 'blank code rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_MIN', name: 'Bad Min', minMinutesPerWeek: -5, preferredRoomType: 'CLASSROOM', gradeLevels: [7] }),
			'INVALID_MIN_MINUTES_PER_WEEK', 'negative minutes rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_INTER', name: 'Bad Inter', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], interSectionGradeLevels: [8] }),
			'INVALID_INTER_SECTION_GRADES', 'inter-section outside grade scope rejected',
		);
		// SCA-01.3 review F1: malformed types must return typed 4xx, never Prisma 500.
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_OWNER', name: 'Bad Owner', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], ownerDepartment: 123 as any }),
			'INVALID_FIELD_TYPE', 'numeric ownerDepartment rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_LABEL', name: 'Bad Label', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], outputLabel: 123 as any }),
			'INVALID_FIELD_TYPE', 'numeric outputLabel rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'BAD_ACTIVE', name: 'Bad Active', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], isActive: 'yes' as any }),
			'INVALID_FIELD_TYPE', 'string isActive rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'HUGE_MIN', name: 'Huge Min', minMinutesPerWeek: 9999999999, preferredRoomType: 'CLASSROOM', gradeLevels: [7] }),
			'INVALID_MIN_MINUTES_PER_WEEK', 'Int32-overflow minutes rejected',
		);
		// SCA-01R3: protected bootstrap metadata on create fails closed
		// before any write — forged classifications must never persist.
		await expectCode(
			() => createSubject(SCHOOL, { code: 'HOST_SEED', name: 'Hostile Seed', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], isSeedable: true } as any),
			'PROTECTED_FIELD', 'explicit isSeedable on create rejected',
		);
		await expectCode(
			() => createSubject(SCHOOL, { code: 'HOST_SYS', name: 'Hostile Sys', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], isSystemManaged: true } as any),
			'PROTECTED_FIELD', 'explicit isSystemManaged on create rejected',
		);
		const rows = await prisma.subject.count({ where: { schoolId: SCHOOL } });
		ok(rows === 0, `rejected creates wrote zero rows (${rows})`);
	}

	console.log('=== 2. patch validation parity (allowlist + typed values) ===');
	{
		expectPatchError({ schoolId: 1 }, 'PROTECTED_FIELD', 'body schoolId is protected on patch');
		expectPatchError({ code: 'X' }, 'PROTECTED_FIELD', 'code is immutable on patch');
		expectPatchError({ bogusField: 1 }, 'UNKNOWN_FIELD', 'unknown field rejected');
		expectPatchError({ preferredRoomType: 'NOPE' }, 'INVALID_ROOM_TYPE', 'patch room enum enforced');
		expectPatchError({ programScopes: ['NOPE'] }, 'INVALID_PROGRAM_SCOPES', 'patch scope enum enforced');
		expectPatchError({ gradeLevels: [7, 7] }, 'DUPLICATE_VALUES', 'patch duplicate grades rejected');
		expectPatchError({ gradeLevels: ['7' as any] }, 'INVALID_GRADE_LEVELS', 'patch string grade rejected');
		expectPatchError({ termCount: -1 }, 'PROTECTED_TERM_AUTHORITY', 'patch cannot write EnrollPro term authority');
		// SCA-01R3: bootstrap metadata is protected on patch — rejected
		// before any value check, so even a wrong-typed value reports
		// PROTECTED_FIELD (never INVALID_FIELD_TYPE, never applied).
		expectPatchError({ isSeedable: 'yes' as any }, 'PROTECTED_FIELD', 'patch isSeedable protected');
		expectPatchError({ isSeedable: false }, 'PROTECTED_FIELD', 'patch isSeedable:false still protected');
		expectPatchError({ isSystemManaged: true }, 'PROTECTED_FIELD', 'patch isSystemManaged protected');
		expectPatchError({ qualificationPriority: 'ANYTHING' }, 'INVALID_QUALIFICATION_PRIORITY', 'patch qualification enum enforced');
		expectPatchError({ requiredFeatures: ['OK', 'OK'] }, 'DUPLICATE_VALUES', 'patch duplicate features rejected');
		expectPatchError({ requiredFeatures: 'LAB' as any }, 'INVALID_REQUIRED_FEATURES', 'patch non-array features rejected');
		// TERM-SUBJ-C01: termCount is EnrollPro-owned regardless of supplied value.
		expectPatchError({ termCount: null }, 'PROTECTED_TERM_AUTHORITY', 'patch null termCount rejected as protected');
		expectPatchError({ programScopes: [] }, 'INVALID_PROGRAM_SCOPES', 'patch empty programScopes rejected');
		// SCA-01.3 review F1: Number() coercion previously let strings/booleans
		// through validation into a Prisma 500.
		expectPatchError({ minMinutesPerWeek: '300' as any }, 'INVALID_MIN_MINUTES_PER_WEEK', 'patch string minutes rejected');
		expectPatchError({ minMinutesPerWeek: true as any }, 'INVALID_MIN_MINUTES_PER_WEEK', 'patch boolean minutes rejected');
		expectPatchError({ minMinutesPerWeek: 9999999999 }, 'INVALID_MIN_MINUTES_PER_WEEK', 'patch overflow minutes rejected');
	}

	console.log('=== 3. atomic patch guards (version + scope negative controls) ===');
	const probe = await createSubject(SCHOOL, {
		code: 'SCA01_PROBE', name: 'SCA-01 Probe', minMinutesPerWeek: 225,
		preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8], programScopes: ['REGULAR'],
	});
	{
		const renamed = await updateSubjectAtomic({
			id: probe.id, actorSchoolId: SCHOOL,
			expectedUpdatedAt: probe.updatedAt.toISOString(),
			changes: { name: 'SCA-01 Probe Renamed' },
		});
		ok(renamed.ok, 'valid versioned patch applies');
		const fresh = await prisma.subject.findUniqueOrThrow({ where: { id: probe.id } });
		// Stale version must fail: negative control for the version guard.
		const stale = await updateSubjectAtomic({
			id: probe.id, actorSchoolId: SCHOOL,
			expectedUpdatedAt: probe.updatedAt.toISOString(), changes: { name: 'Stale' },
		});
		ok(!stale.ok && stale.error.code === 'STALE_WRITE', 'stale version rejected (STALE_WRITE)');
		// Cross-school actor must fail: negative control for scope.
		const cross = await updateSubjectAtomic({
			id: probe.id, actorSchoolId: SCHOOL + 1,
			expectedUpdatedAt: fresh.updatedAt.toISOString(), changes: { name: 'Cross' },
		});
		ok(!cross.ok && cross.error.code === 'CROSS_SCHOOL_DENIED', 'cross-school patch rejected');
		// Missing version must fail.
		const noVersion = await updateSubjectAtomic({
			id: probe.id, actorSchoolId: SCHOOL, expectedUpdatedAt: '', changes: { name: 'NoVer' },
		});
		ok(!noVersion.ok && noVersion.error.code === 'VERSION_REQUIRED', 'missing version rejected');
		// Inter-section outside the (stored) grade scope must fail.
		const inter = await updateSubjectAtomic({
			id: probe.id, actorSchoolId: SCHOOL,
			expectedUpdatedAt: fresh.updatedAt.toISOString(), changes: { interSectionGradeLevels: [9] },
		});
		ok(!inter.ok && inter.error.code === 'INVALID_INTER_SECTION_GRADES', 'inter-section outside scope rejected');
		const unchanged = await prisma.subject.findUniqueOrThrow({ where: { id: probe.id } });
		ok(unchanged.name === 'SCA-01 Probe Renamed', 'rejected patches wrote nothing');
	}

	console.log('=== 4. ordering + passive-read zero-write + create-missing-only bootstrap ===');
	{
		await ensureDefaultSubjects(SCHOOL);
		const seededCount = await prisma.subject.count({ where: { schoolId: SCHOOL } });
		ok(seededCount > 20, `bootstrap seeds defaults (${seededCount} rows)`);
		// Operator edit must survive a second bootstrap (negative control for reconcile-overwrite).
		const research = await prisma.subject.findFirstOrThrow({ where: { schoolId: SCHOOL, code: 'STE_RESEARCH' } });
		await prisma.subject.update({ where: { id: research.id }, data: { gradeLevels: [7, 8, 9] } });
		await ensureDefaultSubjects(SCHOOL);
		const after = await prisma.subject.findUniqueOrThrow({ where: { id: research.id } });
		ok(JSON.stringify(after.gradeLevels) === JSON.stringify([7, 8, 9]), 'operator grade edit survives bootstrap');
		const stableCount = await prisma.subject.count({ where: { schoolId: SCHOOL } });
		ok(stableCount === seededCount, `bootstrap is create-missing-only (${stableCount} rows)`);

		// Ordering: a non-seedable AAA row must sort before seedable ZZZ rows.
		// SCA-01R3: no isSeedable key on ordinary creates — the server
		// default (false) applies and the stored row proves it.
		const aaa = await createSubject(SCHOOL, {
			code: 'AAA_NON_SEED', name: 'AAA Non-Seed Subject', minMinutesPerWeek: 60,
			preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'],
		});
		ok(aaa.isSeedable === false, 'ordinary create defaults isSeedable=false');
		const listed = await getSubjectsBySchool(SCHOOL);
		const names = listed.map((s) => s.name);
		const sorted = [...names].sort((a, b) => a.localeCompare(b));
		ok(JSON.stringify(names) === JSON.stringify(sorted), 'catalog reads order by name (no seed priority)');
		ok(names[0] === 'AAA Non-Seed Subject', 'non-seedable AAA row sorts first');

		// Passive reads must not touch updatedAt on any row.
		const before = await prisma.subject.findMany({ where: { schoolId: SCHOOL }, select: { id: true, updatedAt: true } });
		await getSubjectsBySchool(SCHOOL);
		await getSubjectById(probe.id);
		await ensureDefaultSubjects(SCHOOL);
		const afterReads = await prisma.subject.findMany({ where: { schoolId: SCHOOL }, select: { id: true, updatedAt: true } });
		const untouched = before.every((b) => {
			const match = afterReads.find((a) => a.id === b.id);
			return match != null && match.updatedAt.getTime() === b.updatedAt.getTime();
		}) && before.length === afterReads.length;
		ok(untouched, `passive GET + bootstrap updated zero rows (${before.length} rows compared)`);
	}

	console.log('=== 5. archive/reactivate + fingerprinted delete cycle (service) ===');
	{
		const target = await createSubject(SCHOOL, {
			code: 'SCA01_DOOMED', name: 'SCA-01 Doomed', minMinutesPerWeek: 60,
			preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'],
		});
		const archived = await transitionSubjectActiveStateAtomic({
			id: target.id, actorSchoolId: SCHOOL,
			expectedUpdatedAt: target.updatedAt.toISOString(), targetActive: false,
		});
		ok(archived.ok && archived.subject.isActive === false, 'archive applies');
		const archivedRow = await prisma.subject.findUniqueOrThrow({ where: { id: target.id } });
		const reArchive = await transitionSubjectActiveStateAtomic({
			id: target.id, actorSchoolId: SCHOOL,
			expectedUpdatedAt: archivedRow.updatedAt.toISOString(), targetActive: false,
		});
		ok(!reArchive.ok && reArchive.error.code === 'ALREADY_ARCHIVED', 'repeat archive conflicts (no-op)');
		const reactivated = await transitionSubjectActiveStateAtomic({
			id: target.id, actorSchoolId: SCHOOL,
			expectedUpdatedAt: archivedRow.updatedAt.toISOString(), targetActive: true,
		});
		ok(reactivated.ok && reactivated.subject.isActive === true, 'reactivate applies');
		const live = await prisma.subject.findUniqueOrThrow({ where: { id: target.id } });
		const preview = await previewSubjectDeletion(target.id, SCHOOL);
		ok(preview.ok && preview.preview.summary.deletable, 'clean subject previews as deletable');
		if (preview.ok) {
			const applied = await applySubjectDeletion({
				subjectId: target.id, actorSchoolId: SCHOOL,
				expectedUpdatedAt: live.updatedAt.toISOString(), fingerprint: preview.preview.fingerprint,
			});
			ok(applied.ok, 'fingerprinted delete applies');
		}
		ok((await getSubjectById(target.id)) === null, 'deleted subject reads as gone');
		// Fingerprint mismatch must fail: negative control for the delete guard.
		const second = await createSubject(SCHOOL, {
			code: 'SCA01_DOOMED2', name: 'SCA-01 Doomed 2', minMinutesPerWeek: 60,
			preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'],
		});
		const live2 = await prisma.subject.findUniqueOrThrow({ where: { id: second.id } });
		const forged = await applySubjectDeletion({
			subjectId: second.id, actorSchoolId: SCHOOL,
			expectedUpdatedAt: live2.updatedAt.toISOString(), fingerprint: 'forged-fingerprint',
		});
		ok(!forged.ok, 'forged fingerprint rejected');
	}

	console.log('=== 6. production HTTP route: schoolId conflict + typed patch + full cycle ===');
	const { default: app } = await import('../app.js');
	const server = app.listen(PORT, () => {});
	await new Promise((resolve) => setTimeout(resolve, 800));
	const token = officerToken(SCHOOL);
	try {
		// Conflicting body schoolId must be rejected, never silently accepted.
		{
			const { status, body } = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					schoolId: SCHOOL + 1, code: 'SCA01_X', name: 'Cross School',
					minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
				}),
			});
			ok(status === 403 && body?.code === 'CROSS_SCHOOL_DENIED', `conflicting body schoolId rejected (${status}/${body?.code})`);
			ok((await prisma.subject.count({ where: { schoolId: SCHOOL + 1 } })) === 0, 'rejected cross-school create wrote nothing');
		}
		// SCA-01.3 review F1: malformed-type create through the real route must
		// return a typed 4xx via the errorHandler mapping, never a Prisma 500.
		{
			const { status, body } = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					code: 'SCA01_BADTYPE', name: 'Bad Type', minMinutesPerWeek: 225,
					preferredRoomType: 'CLASSROOM', gradeLevels: [7], outputLabel: 123,
				}),
			});
			ok(status === 400 && body?.code === 'INVALID_FIELD_TYPE', `malformed-type create typed through route (${status}/${body?.code})`);
		}
		// TERM-SUBJ-C01: null termCount remains a typed 400 because the entire
		// term authority surface is protected from Subject CRUD.
		{
			const probe = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					code: 'SCA01R_PROBE', name: 'SCA-01R Probe',
					minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
				}),
			});
			ok(probe.status === 201, `R-probe create works (${probe.status})`);
			const pid = probe.body?.subject?.id as number;
			const version = probe.body?.subject?.updatedAt as string;
			const nullTerm = await fetchJson(`/api/v1/subjects/${pid}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ termCount: null, expectedUpdatedAt: version }),
			});
			ok(nullTerm.status === 400 && nullTerm.body?.code === 'PROTECTED_TERM_AUTHORITY', `route null termCount typed (${nullTerm.status}/${nullTerm.body?.code})`);
			const emptyScopes = await fetchJson(`/api/v1/subjects/${pid}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ programScopes: [], expectedUpdatedAt: version }),
			});
			ok(emptyScopes.status === 400 && emptyScopes.body?.code === 'INVALID_PROGRAM_SCOPES', `route empty programScopes typed (${emptyScopes.status}/${emptyScopes.body?.code})`);
			const reread = await prisma.subject.findUniqueOrThrow({ where: { id: pid } });
			ok(reread.updatedAt.toISOString() === version, 'rejected R-probes wrote nothing');
			ok(JSON.stringify(reread.programScopes) === JSON.stringify(['REGULAR']), 'programScopes untouched by empty patch');
		}
		// Typed patch error through the real route (not a Prisma 500).
		{
			const created = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					schoolId: SCHOOL, code: 'SCA01_HTTP', name: 'SCA-01 HTTP',
					minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
				}),
			});
			ok(created.status === 201, `route create works (${created.status})`);
			const id = created.body?.subject?.id as number;
			const badPatch = await fetchJson(`/api/v1/subjects/${id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ preferredRoomType: 'NOPE', expectedUpdatedAt: created.body?.subject?.updatedAt }),
			});
			ok(badPatch.status === 400 && badPatch.body?.code === 'INVALID_ROOM_TYPE', `route patch enum enforced (${badPatch.status}/${badPatch.body?.code})`);
			// Full cycle through routes.
			const patched = await fetchJson(`/api/v1/subjects/${id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ name: 'SCA-01 HTTP Renamed', expectedUpdatedAt: created.body?.subject?.updatedAt }),
			});
			ok(patched.status === 200, `route patch works (${patched.status})`);
			const arch = await fetchJson(`/api/v1/subjects/${id}/archive`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ expectedUpdatedAt: patched.body?.subject?.updatedAt }),
			});
			ok(arch.status === 200 && arch.body?.archived === true, `route archive works (${arch.status})`);
			const react = await fetchJson(`/api/v1/subjects/${id}/reactivate`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ expectedUpdatedAt: arch.body?.subject?.updatedAt }),
			});
			ok(react.status === 200 && react.body?.reactivated === true, `route reactivate works (${react.status})`);
			const preview = await fetchJson(`/api/v1/subjects/${id}/delete-preview`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({}),
			});
			ok(preview.status === 200 && preview.body?.preview?.summary?.deletable === true, `route delete-preview works (${preview.status})`);
			const applied = await fetchJson(`/api/v1/subjects/${id}/delete-apply`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					expectedUpdatedAt: react.body?.subject?.updatedAt,
					fingerprint: preview.body?.preview?.fingerprint,
				}),
			});
			ok(applied.status === 200, `route delete-apply works (${applied.status})`);
			const gone = await fetchJson(`/api/v1/subjects/${id}`);
			ok(gone.status === 404, `deleted subject returns 404 (${gone.status})`);
		}
		console.log('=== 7. SCA-01R2: operator-create seed classification (route, key omitted) ===');
		{
			// The Subjects page builds create bodies through
			// buildOperatorSubjectCreatePayload, which omits the internal
			// isSeedable field — send that exact key-omitted shape here and
			// prove the stored row is false via the server default.
			const created = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					code: 'SCA01R2_OP', name: 'SCA-01R2 Operator',
					minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
					isActive: true,
				}),
			});
			ok(created.status === 201, `operator create works (${created.status})`);
			ok(created.body?.subject?.isSeedable === false, 'operator create responds isSeedable=false');
			const opId = created.body?.subject?.id as number;
			const opVersion = created.body?.subject?.updatedAt as string;
			const stored = await prisma.subject.findUniqueOrThrow({ where: { id: opId } });
			ok(stored.isSeedable === false, 'operator-created subject stored with isSeedable=false');
			// Controlled bootstrap rows retain their intended classification.
			await ensureDefaultSubjects(SCHOOL);
			const fil = await prisma.subject.findFirstOrThrow({ where: { schoolId: SCHOOL, code: 'FIL' } });
			ok(fil.isSeedable === true, 'bootstrap FIL retains isSeedable=true');
			const hg = await prisma.subject.findFirstOrThrow({ where: { schoolId: SCHOOL, code: 'HG' } });
			ok(hg.isSeedable === false, 'bootstrap HG retains isSeedable=false');
			// Existing operator records are NOT rewritten by bootstrap.
			const afterSeed = await prisma.subject.findUniqueOrThrow({ where: { id: opId } });
			ok(afterSeed.isSeedable === false, 'bootstrap does not rewrite operator isSeedable=false');
			// Remove the probe row through the fingerprinted route path.
			const preview = await fetchJson(`/api/v1/subjects/${opId}/delete-preview`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({}),
			});
			ok(preview.status === 200 && preview.body?.preview?.summary?.deletable === true, `probe delete-preview works (${preview.status})`);
			const applied = await fetchJson(`/api/v1/subjects/${opId}/delete-apply`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					expectedUpdatedAt: opVersion,
					fingerprint: preview.body?.preview?.fingerprint,
				}),
			});
			ok(applied.status === 200, `probe delete-apply works (${applied.status})`);
			const gone = await fetchJson(`/api/v1/subjects/${opId}`);
			ok(gone.status === 404, `probe row removed, zero residue (${gone.status})`);
		}
		console.log('=== 8. SCA-01R3: bootstrap-metadata authority (protected fields fail closed) ===');
		{
			const before = await prisma.subject.count({ where: { schoolId: SCHOOL } });
			// POST carrying either protected flag → 400 PROTECTED_FIELD.
			const hostileSeed = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					code: 'SCA01R3_X1', name: 'Hostile Seed',
					minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
					isSeedable: true,
				}),
			});
			ok(hostileSeed.status === 400 && hostileSeed.body?.code === 'PROTECTED_FIELD', `POST isSeedable:true rejected (${hostileSeed.status}/${hostileSeed.body?.code})`);
			const hostileSys = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					code: 'SCA01R3_X2', name: 'Hostile Sys',
					minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
					isSystemManaged: true,
				}),
			});
			ok(hostileSys.status === 400 && hostileSys.body?.code === 'PROTECTED_FIELD', `POST isSystemManaged:true rejected (${hostileSys.status}/${hostileSys.body?.code})`);
			const afterHostile = await prisma.subject.count({ where: { schoolId: SCHOOL } });
			ok(afterHostile === before, `rejected hostile creates wrote zero rows (${afterHostile - before})`);
			// PATCH containing either protected flag → 400, updatedAt untouched.
			const fil = await prisma.subject.findFirstOrThrow({ where: { schoolId: SCHOOL, code: 'FIL' } });
			const filVersion = fil.updatedAt.toISOString();
			const patchSeed = await fetchJson(`/api/v1/subjects/${fil.id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ isSeedable: false, expectedUpdatedAt: filVersion }),
			});
			ok(patchSeed.status === 400 && patchSeed.body?.code === 'PROTECTED_FIELD', `PATCH isSeedable rejected (${patchSeed.status}/${patchSeed.body?.code})`);
			const patchSys = await fetchJson(`/api/v1/subjects/${fil.id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ isSystemManaged: true, expectedUpdatedAt: filVersion }),
			});
			ok(patchSys.status === 400 && patchSys.body?.code === 'PROTECTED_FIELD', `PATCH isSystemManaged rejected (${patchSys.status}/${patchSys.body?.code})`);
			const filAfter = await prisma.subject.findUniqueOrThrow({ where: { id: fil.id } });
			ok(filAfter.updatedAt.toISOString() === filVersion, 'rejected protected patches changed nothing');
			ok(filAfter.isSeedable === true && filAfter.isSystemManaged === false, 'seed row flags intact after rejected patches');
			// A valid edit to another field on the seed row still succeeds —
			// protection covers the metadata fields, not the whole row.
			const renamed = await fetchJson(`/api/v1/subjects/${fil.id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ name: 'Filipino (R3 probe)', expectedUpdatedAt: filVersion }),
			});
			ok(renamed.status === 200, `valid edit on seed row applies (${renamed.status})`);
			const filRenamed = await prisma.subject.findUniqueOrThrow({ where: { id: fil.id } });
			ok(filRenamed.name === 'Filipino (R3 probe)' && filRenamed.isSeedable === true, 'seed row edit applies without touching flags');
			// Revert the probe edit so no semantic residue remains.
			const reverted = await fetchJson(`/api/v1/subjects/${fil.id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ name: 'Filipino', expectedUpdatedAt: filRenamed.updatedAt.toISOString() }),
			});
			ok(reverted.status === 200 && (await prisma.subject.findUniqueOrThrow({ where: { id: fil.id } })).name === 'Filipino', 'probe edit reverted');
		}
		console.log('=== 9. SCA-01R4: no implicit system-managed classification on ordinary create ===');
		{
			// Key-omitted ordinary creates must persist BOTH flags false even
			// when the code resembles a managed pattern. This section FAILS
			// against `isSystemManaged: contract.isSystemManaged` (which
			// derives true from `_EXP` / `TLE_SPEC_` codes).
			const codes = ['SCA01R4_CTL', 'SCA01R4_EXP', 'TLE_SPEC_R4X'];
			for (const code of codes) {
				const created = await fetchJson('/api/v1/subjects', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
					body: JSON.stringify({
						code, name: `SCA-01R4 ${code}`,
						minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
					}),
				});
				ok(created.status === 201, `ordinary create ${code} works (${created.status})`);
			}
			const rows = await prisma.subject.findMany({
				where: { schoolId: SCHOOL, code: { in: codes } },
				select: { code: true, isSeedable: true, isSystemManaged: true },
			});
			ok(rows.length === 3, `all three probe rows stored (${rows.length})`);
			for (const row of rows) {
				ok(row.isSeedable === false, `${row.code} stored isSeedable=false`);
				ok(row.isSeedable === false && row.isSystemManaged === false, `${row.code} stored isSystemManaged=false (no implicit classification)`);
			}
			// Explicit protected flags still fail closed.
			const hostile = await fetchJson('/api/v1/subjects', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					code: 'SCA01R4_X', name: 'Hostile R4',
					minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
					isSystemManaged: true,
				}),
			});
			ok(hostile.status === 400 && hostile.body?.code === 'PROTECTED_FIELD', `explicit flag still rejected (${hostile.status}/${hostile.body?.code})`);
			// Controlled bootstrap still writes managed rows with true.
			const managed = await prisma.subject.findFirstOrThrow({ where: { schoolId: SCHOOL, code: 'TLE_ICT_EXP' } });
			ok(managed.isSystemManaged === true, 'bootstrap TLE_ICT_EXP retains isSystemManaged=true');
			// Valid edit on the managed row applies without touching flags.
			const edited = await fetchJson(`/api/v1/subjects/${managed.id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ name: 'TLE Exploratory - ICT (R4 probe)', expectedUpdatedAt: managed.updatedAt.toISOString() }),
			});
			ok(edited.status === 200, `valid edit on managed row applies (${edited.status})`);
			const managedAfter = await prisma.subject.findUniqueOrThrow({ where: { id: managed.id } });
			ok(managedAfter.isSystemManaged === true && managedAfter.isSeedable === false, 'managed row flags unchanged by valid edit');
			const restored = await fetchJson(`/api/v1/subjects/${managed.id}`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({ name: 'TLE Exploratory - ICT', expectedUpdatedAt: managedAfter.updatedAt.toISOString() }),
			});
			ok(restored.status === 200, 'managed row probe edit reverted');
			// Remove all disposable probe rows; the final cleanup asserts zero.
			await prisma.subject.deleteMany({ where: { schoolId: SCHOOL, code: { in: codes } } });
			ok((await prisma.subject.count({ where: { schoolId: SCHOOL, code: { in: codes } } })) === 0, 'probe rows removed');
		}
	} finally {
		server.close();
	}

	// Exact cleanup — zero residue on the disposable school.
	await cleanup();
	const residue = await prisma.subject.count({ where: { schoolId: SCHOOL } });
	ok(residue === 0, `zero residue on disposable school (${residue})`);
	ok((await prisma.school.count({ where: { id: SCHOOL } })) === 0, 'fixture school removed');

	console.log(`\nsubject-catalog-truth: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exitCode = 1;
}

main()
	.catch((error) => { console.error(error); process.exitCode = 1; })
	.finally(async () => { await prisma.$disconnect(); });
