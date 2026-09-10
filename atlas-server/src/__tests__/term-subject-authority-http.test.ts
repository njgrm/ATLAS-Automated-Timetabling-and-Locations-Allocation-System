import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';

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
		await prisma.subject.createMany({ data: [
			{ schoolId: SCHOOL_ID, code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 60, schedulingDisposition: 'REFERENCE_ONLY' },
			{ schoolId: SCHOOL_ID, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 300, schedulingDisposition: 'SCHEDULED_TEACHING' },
		] });

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
		assert.equal(body.subjects.find((subject: any) => subject.code === 'HG').createsTimetableDemand, false);
		assert.equal(body.subjects.find((subject: any) => subject.code === 'HG').createsTeachingLoad, false);
		assert.equal(body.subjects.find((subject: any) => subject.code === 'MATH').createsTimetableDemand, true);

		const createResponse = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects`, {
			method: 'POST', headers: authHeaders, body: JSON.stringify({
				code: 'REF_NOTE', name: 'Reference note', minMinutesPerWeek: 60,
				preferredRoomType: 'CLASSROOM', gradeLevels: [7], schedulingDisposition: 'REFERENCE_ONLY',
			}),
		});
		assert.equal(createResponse.status, 201);
		const createdBody = await createResponse.json() as any;
		assert.equal(createdBody.subject.schedulingDisposition, 'REFERENCE_ONLY');

		const invalidCreate = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects`, {
			method: 'POST', headers: authHeaders, body: JSON.stringify({
				code: 'BAD_DISP', name: 'Bad disposition', minMinutesPerWeek: 60,
				preferredRoomType: 'CLASSROOM', gradeLevels: [7], schedulingDisposition: 'SOMETIMES',
			}),
		});
		assert.equal(invalidCreate.status, 400);
		assert.equal((await invalidCreate.json() as any).code, 'INVALID_SCHEDULING_DISPOSITION');

		const protectedCreate = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects`, {
			method: 'POST', headers: authHeaders, body: JSON.stringify({
				code: 'BAD_TERM', name: 'Bad term', minMinutesPerWeek: 60,
				preferredRoomType: 'CLASSROOM', gradeLevels: [7], termCount: 4,
			}),
		});
		assert.equal(protectedCreate.status, 400);
		assert.equal((await protectedCreate.json() as any).code, 'PROTECTED_TERM_AUTHORITY');

		const math = body.subjects.find((subject: any) => subject.code === 'MATH');
		const patchResponse = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects/${math.id}`, {
			method: 'PATCH', headers: authHeaders, body: JSON.stringify({
				expectedUpdatedAt: math.updatedAt,
				schedulingDisposition: 'REFERENCE_ONLY',
			}),
		});
		assert.equal(patchResponse.status, 200);
		assert.equal((await patchResponse.json() as any).subject.schedulingDisposition, 'REFERENCE_ONLY');

		const cached = await prisma.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
		});
		assert.ok(cached?.termContractCache);
		assert.ok(cached?.termContractCachedAt);
		assert.deepEqual((cached?.termContractCache as any).terms.map((term: any) => term.identity), [
			'Term-A', 'term-b', 'term_C',
		]);
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
