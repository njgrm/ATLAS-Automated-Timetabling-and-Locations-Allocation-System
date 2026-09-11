/**
 * TL-UX-C01R2 — Teaching Load suggestion apply authority tests.
 *
 * Part A is hermetic: the canonical distribution summary measures hard-cap
 * breaches from actual teaching minutes only (advisory credit is neutral).
 *
 * Part B is a DISPOSABLE PostgreSQL-backed mounted-route/service suite. It
 * creates a unique fixture school/year, exercises the real suggestion
 * preview/apply path through the real service and the mounted router, and
 * removes everything in `finally` with a zero-residue assertion. A rolled-back
 * positive control proves the write detector observes real writes.
 *
 * Run with `npx tsx <this-file>`. Requires a reachable database for Part B.
 */

import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import facultyAssignmentRouter from '../routes/faculty-assignment.router.js';
import { withDataContext } from '../lib/data-context.js';
import {
	summarizeDistributionPlan,
	previewOrApplyOverCapRebalance,
	type AutoFillResult,
} from '../services/teaching-load-automation.service.js';
import {
	applyTeachingLoadSuggestionProposal,
	createTeachingLoadSuggestionProposal,
} from '../services/teaching-load-suggestion-proposal.service.js';

let passCount = 0;
let failCount = 0;

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
	assert(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function loadServerEnv() {
	const here = dirname(fileURLToPath(import.meta.url));
	try {
		const content = readFileSync(resolve(here, '../../.env'), 'utf8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed.slice(eq + 1).trim();
			if (!process.env[key]) process.env[key] = value;
		}
	} catch {}
}

// ─── Part A: hermetic advisory-neutral summary ──────────────────────────────

function runHermeticTests() {
	section('A1. hard-cap breaches use actual teaching minutes only');
	const summary = summarizeDistributionPlan({
		coveredRows: 10,
		uncoveredRows: 0,
		moves: [],
		// Credited total (teaching + advisory) exceeds the hard cap, but actual
		// teaching minutes do not: this must NOT be a hard-cap breach.
		overCapFaculty: [{ facultyId: 1, teachingMinutes: 1800, totalCreditedMinutes: 2400, overMinutes: 0 }],
		hardCapMinutes: 2400,
	});
	assertEqual(summary.hardCapBreaches, 0, 'advisory credit alone creates no hard-cap breach');

	const breach = summarizeDistributionPlan({
		coveredRows: 10,
		uncoveredRows: 0,
		moves: [],
		overCapFaculty: [{ facultyId: 1, teachingMinutes: 2700, totalCreditedMinutes: 2700, overMinutes: 900 }],
		hardCapMinutes: 2400,
	});
	assertEqual(breach.hardCapBreaches, 1, 'actual teaching over the hard cap is still a breach');

	const balanced = summarizeDistributionPlan({
		coveredRows: 10,
		uncoveredRows: 0,
		moves: [],
		overCapFaculty: [],
		hardCapMinutes: 2400,
	});
	assertEqual(balanced.balanced, true, 'no coverage gap / no move / no excess is balanced');
	assertEqual(
		summarizeDistributionPlan({
			coveredRows: 10, uncoveredRows: 0, moves: [], overCapFaculty: [], hardCapMinutes: 2400, distributionEvaluated: false,
		}).balanced,
		false,
		'unevaluated distribution is never balanced',
	);
}

// ─── Part B: disposable-fixture DB integration ──────────────────────────────

const WRITE_ACTIONS = new Set([
	'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
	'executeRaw', 'executeRawUnsafe', 'queryRaw', 'queryRawUnsafe',
]);

const recorded: Array<{ model?: string; action: string }> = [];

function writes() {
	return recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
}

function resetRecording() {
	recorded.length = 0;
}

const ACTOR = 1;

async function runFixtureTests() {
	const prismaModule = await import('../lib/prisma.js');
	const base = (prismaModule as any).createTestPrismaClient();
	const instrumented = base.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }: any) {
					recorded.push({ model, action: operation });
					return query(args);
				},
			},
		},
	});
	const run = <T>(fn: () => Promise<T>): Promise<T> => withDataContext(instrumented, fn);

	const FIXTURE_NAME = `TL-UX-C01R2 FIXTURE — SAFE TO DELETE — ${Date.now()}`;
	let fixtureSchoolId = 0;
	const fixtureYearId = 9400 + (Date.now() % 100);
	let donorId = 0;
	let receiverId = 0;
	let engTeacherId = 0;
	let donorFs = 0;
	let receiverFs = 0;
	let mathSubjectId = 0;
	let engSubjectId = 0;
	let policyId = 0;
	const moverOwnershipIds: number[] = [];

	const standard = 1800;
	const advisory = 300;
	const hardCap = 2400;
	const subjectMinutes = 240;

	async function withMountedRouter<T>(fn: (baseUrl: string, token: string) => Promise<T>): Promise<T> {
		const previousSecret = process.env.JWT_SECRET;
		process.env.JWT_SECRET = 'tl-ux-c01r2-hermetic-secret';
		let server: Server | undefined;
		try {
			return await withDataContext(instrumented, async () => {
				const app = express();
				app.use(express.json());
				app.use('/api/v1/faculty-assignments', facultyAssignmentRouter);
				app.use((error: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
					res.status(error.statusCode ?? 500).json({ code: error.code ?? 'SERVER_ERROR', message: error.message });
				});
				server = createServer(app);
				await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
				const address = server.address();
				assert(Boolean(address) && typeof address !== 'string', 'mounted router bound to an ephemeral TCP port');
				const token = jwt.sign({ userId: ACTOR, role: 'officer', authSource: 'local', schoolId: fixtureSchoolId }, process.env.JWT_SECRET!);
				return fn(`http://127.0.0.1:${(address as { port: number }).port}`, token);
			});
		} finally {
			if (server) await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
			if (previousSecret === undefined) delete process.env.JWT_SECRET;
			else process.env.JWT_SECRET = previousSecret;
		}
	}

	async function post(baseUrl: string, token: string, path: string, body: unknown) {
		return fetch(`${baseUrl}${path}`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});
	}

	async function createProposal(): Promise<{ id: number; preview: AutoFillResult }> {
		const result = await run(() => createTeachingLoadSuggestionProposal({
			schoolId: fixtureSchoolId,
			schoolYearId: fixtureYearId,
			actorId: ACTOR,
			actorSchoolId: fixtureSchoolId,
		}));
		return { id: result.proposal.id, preview: result.preview as AutoFillResult };
	}

	async function expectStaleZeroWrite(label: string, operation: () => Promise<unknown>): Promise<void> {
		const before = await snapshotScopedWrites();
		resetRecording();
		let code: string | undefined;
		try {
			await operation();
		} catch (error) {
			code = (error as { code?: string })?.code;
		}
		assertEqual(code, 'TEACHING_LOAD_PROPOSAL_STALE', `${label}: typed 409 STALE`);
		const after = await snapshotScopedWrites();
		assertEqual(JSON.stringify(after), JSON.stringify(before), `${label}: zero persisted writes`);
	}

	async function snapshotScopedWrites() {
		const [ownerships, facultySubjects, cycles, proposals, audits] = await Promise.all([
			instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			instrumented.facultySubject.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			instrumented.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			instrumented.teachingLoadSuggestionProposal.count({ where: { schoolId: fixtureSchoolId } }),
			instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId } }),
		]);
		const versions = await instrumented.facultyMirror.findMany({
			where: { id: { in: [donorId, receiverId, engTeacherId] } },
			select: { id: true, version: true },
		});
		return { ownerships, facultySubjects, cycles, proposals, audits, versions: versions.map((row: any) => `${row.id}:${row.version}`).sort().join(',') };
	}

	try {
		section('B1. fixture setup (disposable school/year, zero live impact)');
		const createdSchool = await instrumented.school.create({ data: { name: FIXTURE_NAME, shortName: 'TLR2FX' }, select: { id: true } });
		fixtureSchoolId = (createdSchool as any).id as number;
		assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);

		await instrumented.enrollProSchoolYearMirror.create({
			data: {
				schoolId: fixtureSchoolId,
				enrollProSchoolYearId: fixtureYearId,
				yearLabel: '2029-2030',
				isActive: true,
				isArchived: false,
				syncStatus: 'synced',
			},
		});

		const policy = await instrumented.schedulingPolicy.create({
			data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, teachingStandardMinutes: standard, advisoryCreditMinutes: advisory, hardCapMinutes: hardCap },
			select: { id: true },
		});
		policyId = (policy as any).id as number;

		const math = await instrumented.subject.create({
			data: { schoolId: fixtureSchoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: subjectMinutes, programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'MATH', isActive: true },
			select: { id: true },
		});
		mathSubjectId = (math as any).id as number;
		const eng = await instrumented.subject.create({
			data: { schoolId: fixtureSchoolId, code: 'ENG', name: 'English', minMinutesPerWeek: subjectMinutes, programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'ENG', isActive: true },
			select: { id: true },
		});
		engSubjectId = (eng as any).id as number;

		// 14 MATH sections (201..214) + 1 unowned ENG section (301).
		for (let externalId = 201; externalId <= 214; externalId++) {
			await instrumented.sectionMirror.create({
				data: {
					schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId, name: `Grade 7 - ${externalId}`,
					gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
					isActiveForScheduling: true, isStale: false,
				},
			});
		}
		await instrumented.sectionMirror.create({
			data: {
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 301, name: 'Grade 7 - ENG',
				gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
				isActiveForScheduling: true, isStale: false,
			},
		});

		const donor = await instrumented.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 8001, employeeId: 'R2DONOR', firstName: 'Dana', lastName: 'Donor', department: 'MATH', isActiveForScheduling: true, isClassAdviser: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		donorId = (donor as any).id as number;
		// Receiver carries advisory/ancillary credit that the retired logic would
		// have counted against teaching capacity and overload status.
		const receiver = await instrumented.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 8002, employeeId: 'R2RECV', firstName: 'Rita', lastName: 'Receiver', department: 'MATH', isActiveForScheduling: true, isClassAdviser: false, maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 600 },
			select: { id: true },
		});
		receiverId = (receiver as any).id as number;
		const engTeacher = await instrumented.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 8003, employeeId: 'R2ENG', firstName: 'Enzo', lastName: 'English', department: 'ENG', isActiveForScheduling: true, isClassAdviser: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		engTeacherId = (engTeacher as any).id as number;

		const donorFsRow = await instrumented.facultySubject.create({
			data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: donorId, subjectId: mathSubjectId, sectionIds: [201, 202, 203, 204, 205, 206, 207, 208], gradeLevels: [7], assignedBy: ACTOR },
			select: { id: true },
		});
		donorFs = (donorFsRow as any).id as number;
		const receiverFsRow = await instrumented.facultySubject.create({
			data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: receiverId, subjectId: mathSubjectId, sectionIds: [209, 210, 211, 212, 213, 214], gradeLevels: [7], assignedBy: ACTOR },
			select: { id: true },
		});
		receiverFs = (receiverFsRow as any).id as number;

		for (const externalId of [201, 202, 203, 204, 205, 206, 207, 208]) {
			const row = await instrumented.subjectSectionOwnership.create({
				data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: mathSubjectId, sectionId: externalId, facultyId: donorId, facultySubjectId: donorFs },
				select: { id: true },
			});
			moverOwnershipIds.push((row as any).id as number);
		}
		for (const externalId of [209, 210, 211, 212, 213, 214]) {
			await instrumented.subjectSectionOwnership.create({
				data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: mathSubjectId, sectionId: externalId, facultyId: receiverId, facultySubjectId: receiverFs },
			});
		}
		resetRecording();

		section('B2. rolled-back positive control proves the write detector');
		{
			const before = await instrumented.facultyMirror.findUnique({ where: { id: donorId }, select: { version: true } });
			const beforeVersion = (before as any).version as number;
			resetRecording();
			let caught = false;
			try {
				await run(() => instrumented.$transaction(async (tx: any) => {
					await tx.facultyMirror.update({ where: { id: donorId }, data: { version: { increment: 1 } } });
					throw new Error('rolled-back positive control');
				}));
			} catch {
				caught = true;
			}
			assert(caught, 'positive control transaction rolled back');
			assert(
				writes().some((write) => write.model === 'FacultyMirror' && write.action === 'update'),
				'write detector observed the rolled-back write',
			);
			const after = await instrumented.facultyMirror.findUnique({ where: { id: donorId }, select: { version: true } });
			assertEqual((after as any).version, beforeVersion, 'rolled-back write left zero residue');
			resetRecording();
		}

		section('B3. advisory credit is neutral for overload and receiver capacity');
		{
			resetRecording();
			const rebalance = await run(() => previewOrApplyOverCapRebalance({
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, actorId: ACTOR, actorSchoolId: fixtureSchoolId, previewOnly: true,
			}));
			assert(rebalance.evaluated === true, 'evaluator resolved the effective policy');
			assertEqual(rebalance.sectionsResolved, 15, 'evaluator resolved all fixture sections');
			const overIds = rebalance.overCapFaculty.map((row) => row.facultyId);
			assert(overIds.includes(donorId), 'donor above the teaching standard is flagged');
			assert(!overIds.includes(receiverId), 'receiver with advisory credit but teaching under standard is NOT flagged');
			const receiverMove = rebalance.proposedMoves.find((move) => move.toFacultyId === receiverId);
			assert(!!receiverMove, 'receiver stays capacity-eligible despite advisory credit');
			assertEqual(receiverMove?.toQualificationAuthority, 'DEPARTMENT', 'move binds the receiver qualification authority');
			assertEqual(receiverMove?.toQualificationTier, 2, 'move binds the receiver qualification tier');
			assertEqual(writes().length, 0, 'preview evaluator performed zero writes');
		}

		section('B4. the plan is deterministic and never falsely balanced');
		{
			const first = await run(() => previewOrApplyOverCapRebalance({
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, actorId: ACTOR, actorSchoolId: fixtureSchoolId, previewOnly: true,
			}));
			const second = await run(() => previewOrApplyOverCapRebalance({
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, actorId: ACTOR, actorSchoolId: fixtureSchoolId, previewOnly: true,
			}));
			assertEqual(JSON.stringify(first.proposedMoves), JSON.stringify(second.proposedMoves), 'two previews produce an identical move plan');
			const proposalResult = await createProposal();
			const plan = proposalResult.preview.distribution;
			assert(!!plan, 'proposal preview carries a distribution plan');
			assertEqual(plan?.summary.distributionEvaluated, true, 'plan evaluated');
			assertEqual(plan?.summary.balanced, false, 'above-standard teachers must not report balanced');
			assertEqual(Array.isArray(plan?.policy?.revision), false, 'policy binding is not an array');
			assert(typeof plan?.policy?.revision === 'string', 'plan binds the effective policy revision');
			resetRecording();
		}

		section('B5. legacy stored proposal without a distribution contract is rejected');
		{
			const { id, preview } = await createProposal();
			const legacy = { ...(preview as unknown as Record<string, unknown>) };
			delete legacy.distribution;
			await instrumented.teachingLoadSuggestionProposal.update({ where: { id }, data: { previewPayload: legacy as any } });
			await expectStaleZeroWrite('legacy proposal', () => run(() => applyTeachingLoadSuggestionProposal({ proposalId: id, actorId: ACTOR, actorSchoolId: fixtureSchoolId })));
		}

		section('B6. missing/unevaluated refreshed distribution is rejected');
		{
			const { id, preview } = await createProposal();
			const stored = structuredClone(preview);
			const unevaluated = structuredClone(preview);
			if (unevaluated.distribution) {
				(unevaluated.distribution as any).summary = { ...unevaluated.distribution.summary, distributionEvaluated: false };
			}
			await expectStaleZeroWrite('unevaluated refreshed plan', () => run(() => applyTeachingLoadSuggestionProposal(
				{ proposalId: id, actorId: ACTOR, actorSchoolId: fixtureSchoolId },
				{ preview: async () => structuredClone(unevaluated) },
			)));
			void stored;
		}

		section('B7. policy change after preview invalidates apply (no default fallback)');
		{
			const { id } = await createProposal();
			await instrumented.schedulingPolicy.update({ where: { id: policyId }, data: { teachingStandardMinutes: 1500 } });
			await expectStaleZeroWrite('policy standard change', () => run(() => applyTeachingLoadSuggestionProposal({ proposalId: id, actorId: ACTOR, actorSchoolId: fixtureSchoolId })));
			await instrumented.schedulingPolicy.update({ where: { id: policyId }, data: { teachingStandardMinutes: standard } });

			const second = await createProposal();
			await instrumented.schedulingPolicy.delete({ where: { id: policyId } });
			await expectStaleZeroWrite('policy removed', () => run(() => applyTeachingLoadSuggestionProposal({ proposalId: second.id, actorId: ACTOR, actorSchoolId: fixtureSchoolId })));
			const recreated = await instrumented.schedulingPolicy.create({
				data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, teachingStandardMinutes: standard, advisoryCreditMinutes: advisory, hardCapMinutes: hardCap },
				select: { id: true },
			});
			policyId = (recreated as any).id as number;
		}

		section('B8. receiver department authority change is rejected inside the transaction');
		{
			const { id, preview } = await createProposal();
			await instrumented.facultyMirror.update({ where: { id: receiverId }, data: { department: 'SCI' } });
			await expectStaleZeroWrite('receiver department change', () => run(() => applyTeachingLoadSuggestionProposal(
				{ proposalId: id, actorId: ACTOR, actorSchoolId: fixtureSchoolId },
				{ preview: async () => structuredClone(preview) },
			)));
			await instrumented.facultyMirror.update({ where: { id: receiverId }, data: { department: 'MATH' } });
		}

		section('B9. subject-minutes change invalidates the stale move.minutes');
		{
			const { id, preview } = await createProposal();
			await instrumented.subject.update({ where: { id: mathSubjectId }, data: { minMinutesPerWeek: 300 } });
			await expectStaleZeroWrite('subject minutes change', () => run(() => applyTeachingLoadSuggestionProposal(
				{ proposalId: id, actorId: ACTOR, actorSchoolId: fixtureSchoolId },
				{ preview: async () => structuredClone(preview) },
			)));
			await instrumented.subject.update({ where: { id: mathSubjectId }, data: { minMinutesPerWeek: subjectMinutes } });
		}

		section('B10. concurrent ownership change is rejected with zero partial writes');
		{
			const { id, preview } = await createProposal();
			const plan = storedPlan(preview);
			const move = plan.moves[0];
			const before = await snapshotScopedWrites();
			const targetOwnership = move.ownershipId;
			await instrumented.subjectSectionOwnership.update({ where: { id: targetOwnership }, data: { facultyId: engTeacherId } });
			await expectStaleZeroWrite('ownership change', () => run(() => applyTeachingLoadSuggestionProposal(
				{ proposalId: id, actorId: ACTOR, actorSchoolId: fixtureSchoolId },
				{ preview: async () => structuredClone(preview) },
			)));
			await instrumented.subjectSectionOwnership.update({ where: { id: targetOwnership }, data: { facultyId: donorId } });
			const after = await snapshotScopedWrites();
			assertEqual(JSON.stringify(after), JSON.stringify(before), 'rejected ownership change left zero partial writes');
		}

		section('B11. valid unchanged reviewed plan applies atomically through the mounted route');
		{
			const proposal = await createProposal();
			const plan = storedPlan(proposal.preview);
			const expectedMove = plan.moves[0];
			const expectedInsert = plan.inserts[0];
			assert(!!expectedMove && !!expectedInsert, 'reviewed plan contains at least one move and one insert');

			const before = await snapshotScopedWrites();
			const donorVersionBefore = await versionOf(donorId);
			const receiverVersionBefore = await versionOf(receiverId);
			const engVersionBefore = await versionOf(engTeacherId);

			resetRecording();
			let applyStatus = 0;
			let applyBody: any = null;
			await withMountedRouter(async (baseUrl, token) => {
				const response = await post(baseUrl, token, `/api/v1/faculty-assignments/suggestion-proposals/${proposal.id}/apply`, {});
				applyStatus = response.status;
				applyBody = await response.json();
			});
			assertEqual(applyStatus, 200, 'mounted apply returned 200');
			assertEqual(applyBody?.proposal?.status, 'APPLIED', 'proposal status APPLIED');
			assertEqual(applyBody?.applyResult?.movesApplied, plan.moves.length, 'every reviewed move applied');
			assertEqual(applyBody?.applyResult?.created, plan.inserts.length, 'every reviewed coverage insert applied');

			const cycleWrites = writes().filter((write) => write.model === 'TeachingLoadCycle');
			assert(cycleWrites.length >= 1, 'cycle refreshed during apply');
			const auditWrites = writes().filter((write) => write.model === 'AuditLog' && write.action === 'create');
			assertEqual(auditWrites.length, 1, 'exactly one audit written');

			const movedOwnership = await instrumented.subjectSectionOwnership.findUnique({ where: { id: expectedMove.ownershipId }, select: { facultyId: true } });
			assertEqual((movedOwnership as any).facultyId, expectedMove.toFacultyId, 'moved ownership now belongs to the reviewed receiver');

			const donorFsAfter = await instrumented.facultySubject.findUnique({ where: { id: donorFs }, select: { sectionIds: true, gradeLevels: true } });
			assertEqual((donorFsAfter as any).sectionIds.includes(expectedMove.sectionId), false, 'donor FacultySubject no longer lists the moved section');
			assertEqual(JSON.stringify((donorFsAfter as any).gradeLevels), JSON.stringify([7]), 'donor gradeLevels preserved/recomputed');

			const receiverFsAfter = await instrumented.facultySubject.findUnique({ where: { id: receiverFs }, select: { sectionIds: true, gradeLevels: true } });
			assertEqual((receiverFsAfter as any).sectionIds.includes(expectedMove.sectionId), true, 'receiver FacultySubject lists the moved section');
			assertEqual(JSON.stringify((receiverFsAfter as any).gradeLevels), JSON.stringify([7]), 'receiver gradeLevels consistent');

			const engFs = await instrumented.facultySubject.findFirst({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: engTeacherId, subjectId: engSubjectId }, select: { sectionIds: true } });
			assert(!!engFs, 'ENG coverage insert created the FacultySubject');
			assertEqual((engFs as any)?.sectionIds.includes(expectedInsert.sectionId), true, 'ENG insert ownership present');

			assertEqual(await versionOf(donorId), donorVersionBefore + 1, 'donor version bumped once');
			assertEqual(await versionOf(receiverId), receiverVersionBefore + 1, 'receiver version bumped once');
			assertEqual(await versionOf(engTeacherId), engVersionBefore + 1, 'insert receiver version bumped once');

			const after = await snapshotScopedWrites();
			assertEqual(after.audits, before.audits + 1, 'exactly one durable audit added');

			section('B12. idempotent replay adds no writes');
			{
				const ownershipAfterApply = await instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
				const auditsAfterApply = await instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId } });
				resetRecording();
				const replay = await run(() => applyTeachingLoadSuggestionProposal({ proposalId: proposal.id, actorId: ACTOR, actorSchoolId: fixtureSchoolId }));
				assertEqual(replay.proposal.status, 'APPLIED', 'replay reports APPLIED');
				assertEqual(writes().length, 0, 'replay performed zero writes');
				assertEqual(
					await instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
					ownershipAfterApply,
					'replay created no additional ownerships',
				);
				assertEqual(await instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId } }), auditsAfterApply, 'replay created no additional audit');
			}
		}
	} finally {
		section('B13. fixture cleanup (zero residue)');
		await instrumented.$transaction(async (tx: any) => {
			await tx.subjectSectionOwnership.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
			await tx.facultySubject.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
			await tx.teachingLoadCycle.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
			await tx.teachingLoadSuggestionProposal.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.auditLog.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.sectionMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.facultyMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.specializationAlias.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.schedulingPolicy.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.subject.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.school.delete({ where: { id: fixtureSchoolId } });
		});

		const residue = await instrumented.$transaction(async (tx: any) => {
			const [schools, ownerships, facultySubjects, sections, faculty, subjects, cycles, proposals, audits, policies] = await Promise.all([
				tx.school.count({ where: { id: fixtureSchoolId } }),
				tx.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId } }),
				tx.facultySubject.count({ where: { schoolId: fixtureSchoolId } }),
				tx.sectionMirror.count({ where: { schoolId: fixtureSchoolId } }),
				tx.facultyMirror.count({ where: { schoolId: fixtureSchoolId } }),
				tx.subject.count({ where: { schoolId: fixtureSchoolId } }),
				tx.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId } }),
				tx.teachingLoadSuggestionProposal.count({ where: { schoolId: fixtureSchoolId } }),
				tx.auditLog.count({ where: { schoolId: fixtureSchoolId } }),
				tx.schedulingPolicy.count({ where: { schoolId: fixtureSchoolId } }),
			]);
			return [schools, ownerships, facultySubjects, sections, faculty, subjects, cycles, proposals, audits, policies];
		});
		assertEqual(residue.reduce((sum: number, value: number) => sum + value, 0), 0, 'zero residue across all fixture-scoped models');

		await base.$disconnect();
	}

	function storedPlan(preview: AutoFillResult) {
		const plan = preview.distribution;
		if (!plan) throw new Error('fixture preview must carry a distribution plan');
		return plan;
	}

	async function versionOf(facultyId: number): Promise<number> {
		const row = await instrumented.facultyMirror.findUnique({ where: { id: facultyId }, select: { version: true } });
		return (row as any).version as number;
	}
}

async function main() {
	loadServerEnv();
	runHermeticTests();
	if (process.env.DATABASE_URL) {
		await runFixtureTests();
	} else {
		console.warn('[SKIP] Part B fixture tests require DATABASE_URL.');
	}
	console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
	process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exit(2);
});
