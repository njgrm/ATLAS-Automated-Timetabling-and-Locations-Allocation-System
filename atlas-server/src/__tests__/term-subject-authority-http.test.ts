import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { ensureDefaultSubjects } from '../services/subject.service.js';

const SCHOOL_ID = 9_100_041;
const SCHOOL_YEAR_ID = 77;

test('mounted Subject scheduling authority route returns verified EnrollPro terms and explicit demand disposition', {
	skip: process.env.TERM_SUBJECT_HTTP_PROOF !== '1',
}, async () => {
	assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for the disposable HTTP proof');
	assert.ok(process.env.JWT_SECRET, 'JWT_SECRET is required for the disposable HTTP proof');

	const enrollPro = createServer((req, res) => {
		res.setHeader('content-type', 'application/json');
		if (req.url === '/integration/v1/school-year') {
			res.end(JSON.stringify({ data: {
				id: SCHOOL_YEAR_ID,
				schoolId: SCHOOL_ID,
				yearLabel: '2030-2031',
				termFormat: 'TRIMESTER',
				terms: [
					{ identity: 'Term-A', displayLabel: 'Launch / Foundations', startDate: '2030-06-03', endDate: '2030-09-13' },
					{ identity: 'term-b', displayLabel: 'Studio Cycle β', startDate: '2030-09-16', endDate: '2031-01-10' },
					{ identity: 'term_C', displayLabel: 'Capstone + Defense', startDate: '2031-01-13', endDate: '2031-04-04' },
				],
			} }));
			return;
		}
		if (req.url === '/integration/v1/active-term') {
			res.end(JSON.stringify({ data: { schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, activeTerm: 'TERM-B' } }));
			return;
		}
		res.statusCode = 404;
		res.end(JSON.stringify({ error: 'not found' }));
	});
	await new Promise<void>((resolve) => enrollPro.listen(0, '127.0.0.1', resolve));
	const enrollProAddress = enrollPro.address();
	assert.ok(enrollProAddress && typeof enrollProAddress === 'object');

	const previousApi = process.env.ENROLLPRO_API;
	const previousServiceToken = process.env.ENROLLPRO_SERVICE_TOKEN;
	process.env.ENROLLPRO_API = `http://127.0.0.1:${enrollProAddress.port}`;
	process.env.ENROLLPRO_SERVICE_TOKEN = 'term-subject-http-fixture-token';
	const server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');

	try {
		await prisma.school.create({ data: { id: SCHOOL_ID, name: 'TERM-SUBJ HTTP Proof', shortName: 'TSC01' } });
		await prisma.enrollProSchoolYearMirror.create({ data: {
			schoolId: SCHOOL_ID,
			enrollProSchoolYearId: SCHOOL_YEAR_ID,
			yearLabel: '2030-2031',
			isActive: true,
			syncStatus: 'synced',
		} });
		// Controlled bootstrap authority: the exact code `HG` is reference-only;
		// every other default stays scheduled teaching.
		await ensureDefaultSubjects(SCHOOL_ID);
		const bootstrappedHg = await prisma.subject.findFirst({ where: { schoolId: SCHOOL_ID, code: 'HG' } });
		const bootstrappedMath = await prisma.subject.findFirst({ where: { schoolId: SCHOOL_ID, code: 'MATH' } });
		assert.equal(bootstrappedHg?.schedulingDisposition, 'REFERENCE_ONLY');
		assert.equal(bootstrappedMath?.schedulingDisposition, 'SCHEDULED_TEACHING');

		const token = jwt.sign({ userId: 41, role: 'admin', authSource: 'local', schoolId: SCHOOL_ID }, process.env.JWT_SECRET!, { expiresIn: '5m' });
		const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
		const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects/scheduling-authority?schoolYearId=${SCHOOL_YEAR_ID}`, {
			headers: authHeaders,
		});
		assert.equal(response.status, 200);
		const body = await response.json() as any;
		assert.equal(body.termAuthority.state, 'VERIFIED_LIVE');
		assert.deepEqual(body.termAuthority.contract.terms.map((term: any) => term.identity), [
			'Term-A', 'term-b', 'term_C',
		]);
		assert.deepEqual(body.termAuthority.contract.terms.map((term: any) => term.displayLabel), [
			'Launch / Foundations', 'Studio Cycle β', 'Capstone + Defense',
		]);
		assert.equal(body.termAuthority.contract.activeTerm.identity, 'term-b');
		// The route exposes readable disposition/rotation metadata but must make
		// no operative demand or Teaching Load claim.
		assert.ok(!('demandProjection' in body), 'route must not expose demandProjection');
		const hgRow = body.subjects.find((subject: any) => subject.code === 'HG');
		const mathRow = body.subjects.find((subject: any) => subject.code === 'MATH');
		assert.equal(hgRow.schedulingDisposition, 'REFERENCE_ONLY');
		assert.equal(mathRow.schedulingDisposition, 'SCHEDULED_TEACHING');
		for (const row of body.subjects) {
			assert.ok(!('createsTimetableDemand' in row), `subject ${row.code} must not claim timetable demand`);
			assert.ok(!('createsTeachingLoad' in row), `subject ${row.code} must not claim Teaching Load`);
		}

		const subjectCount = () => prisma.subject.count({ where: { schoolId: SCHOOL_ID } });
		const countBeforeReject = await subjectCount();

		const deferredCreate = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects`, {
			method: 'POST', headers: authHeaders, body: JSON.stringify({
				code: 'REF_NOTE', name: 'Reference note', minMinutesPerWeek: 60,
				preferredRoomType: 'CLASSROOM', gradeLevels: [7], schedulingDisposition: 'REFERENCE_ONLY',
			}),
		});
		assert.equal(deferredCreate.status, 400);
		assert.equal((await deferredCreate.json() as any).code, 'PROTECTED_SCHEDULING_DISPOSITION');
		assert.equal(await subjectCount(), countBeforeReject, 'rejected create must write zero rows');

		const invalidDispositionCreate = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects`, {
			method: 'POST', headers: authHeaders, body: JSON.stringify({
				code: 'BAD_DISP', name: 'Bad disposition', minMinutesPerWeek: 60,
				preferredRoomType: 'CLASSROOM', gradeLevels: [7], schedulingDisposition: 'SOMETIMES',
			}),
		});
		assert.equal(invalidDispositionCreate.status, 400);
		assert.equal((await invalidDispositionCreate.json() as any).code, 'PROTECTED_SCHEDULING_DISPOSITION');
		assert.equal(await subjectCount(), countBeforeReject, 'invalid disposition must write zero rows');

		const protectedCreate = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects`, {
			method: 'POST', headers: authHeaders, body: JSON.stringify({
				code: 'BAD_TERM', name: 'Bad term', minMinutesPerWeek: 60,
				preferredRoomType: 'CLASSROOM', gradeLevels: [7], termCount: 4,
			}),
		});
		assert.equal(protectedCreate.status, 400);
		assert.equal((await protectedCreate.json() as any).code, 'PROTECTED_TERM_AUTHORITY');

		// A non-HG code named "Homeroom Guidance" is an ordinary create and stays
		// scheduled teaching — exact code authority, not name matching.
		const altHgCreate = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects`, {
			method: 'POST', headers: authHeaders, body: JSON.stringify({
				code: 'HG_ALT', name: 'Homeroom Guidance', minMinutesPerWeek: 60,
				preferredRoomType: 'CLASSROOM', gradeLevels: [7],
			}),
		});
		assert.equal(altHgCreate.status, 201);
		assert.equal((await altHgCreate.json() as any).subject.schedulingDisposition, 'SCHEDULED_TEACHING');

		const mathBefore = await prisma.subject.findUniqueOrThrow({ where: { id: mathRow.id } });
		const patchResponse = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects/${mathRow.id}`, {
			method: 'PATCH', headers: authHeaders, body: JSON.stringify({
				expectedUpdatedAt: mathRow.updatedAt,
				schedulingDisposition: 'REFERENCE_ONLY',
			}),
		});
		assert.equal(patchResponse.status, 400);
		assert.equal((await patchResponse.json() as any).code, 'PROTECTED_SCHEDULING_DISPOSITION');
		const mathAfter = await prisma.subject.findUniqueOrThrow({ where: { id: mathRow.id } });
		assert.equal(mathAfter.schedulingDisposition, 'SCHEDULED_TEACHING');
		assert.equal(mathAfter.updatedAt.getTime(), mathBefore.updatedAt.getTime(), 'rejected patch must not bump updatedAt');

		// TERM-CONSUME-C02: the passive scheduling-authority read must be
		// zero-write. It may use a verified live structure, but it must never
		// create, repair, or update the mirror cache.
		const cached = await prisma.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
		});
		assert.equal(cached?.termContractCache ?? null, null, 'passive read must not write the term contract cache');
		assert.equal(cached?.termContractCachedAt ?? null, null, 'passive read must not write the cache verification time');
	} finally {
		await prisma.subject.deleteMany({ where: { schoolId: SCHOOL_ID } });
		await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: SCHOOL_ID } });
		await prisma.school.deleteMany({ where: { id: SCHOOL_ID } });
		await prisma.$disconnect();
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		await new Promise<void>((resolve, reject) => enrollPro.close((error) => error ? reject(error) : resolve()));
		if (previousApi === undefined) delete process.env.ENROLLPRO_API; else process.env.ENROLLPRO_API = previousApi;
		if (previousServiceToken === undefined) delete process.env.ENROLLPRO_SERVICE_TOKEN; else process.env.ENROLLPRO_SERVICE_TOKEN = previousServiceToken;
	}
});
