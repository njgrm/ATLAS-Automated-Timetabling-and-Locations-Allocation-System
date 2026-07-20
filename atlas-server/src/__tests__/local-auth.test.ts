import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { prisma } from '../lib/prisma.js';
import { loginWithEmailPassword } from '../services/local-auth.service.js';

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

async function run() {
	process.env.ATLAS_AUTH_DISABLE_RATE_LIMIT = 'false';
	if (!process.env.JWT_SECRET) {
		process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
	}

	const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
	const seededOfficer = await prisma.atlasAuthAccount.findFirst({
		where: { role: 'officer', isActive: true },
		orderBy: { id: 'asc' },
	});
	const officerEmail = process.env.ATLAS_SEEDED_OFFICER_EMAIL ?? seededOfficer?.email ?? 'officer@deped.edu.ph';
	const seededFaculty = await prisma.atlasAuthAccount.findFirst({
		where: { role: 'faculty', isActive: true },
		orderBy: { id: 'asc' },
	});
	const facultyEmail = process.env.ATLAS_SEEDED_FACULTY_EMAIL ?? seededFaculty?.email ?? 'faculty@deped.edu.ph';

	let officerPassword = seededPassword;
	if (officerEmail === 'admin@deped.edu.ph') {
		officerPassword = 'AdminSY2026!';
	}
	let facultyPassword = seededPassword;
	if (facultyEmail === 'maria.santos@deped.edu.ph') {
		facultyPassword = 'DepEd2026!';
	}

	section('Seeded account availability');

	const officerAccount = await prisma.atlasAuthAccount.findUnique({ where: { email: officerEmail } });
	const facultyAccount = await prisma.atlasAuthAccount.findUnique({ where: { email: facultyEmail } });

	assert(Boolean(officerAccount), `Seeded officer account exists (${officerEmail})`);
	assert(Boolean(facultyAccount), `Seeded faculty account exists (${facultyEmail})`);

	if (!officerAccount || !facultyAccount) {
		console.error('\nSeeded local auth accounts are missing. Run the realistic seed first.');
		process.exitCode = 1;
		return;
	}

	section('TC-AUTH-01 officer login success');

	const officerLogin = await loginWithEmailPassword({
		email: officerEmail,
		password: officerPassword,
		ipAddress: '127.0.0.1',
		userAgent: 'local-auth-test',
	});

	assert(officerLogin.ok, 'Officer login returns success');
	if (officerLogin.ok) {
		assertEqual(officerLogin.user.role, 'officer', 'Officer role is returned');
		assertEqual(officerLogin.user.authSource, 'local', 'Officer auth source is local');
	}

	section('TC-AUTH-02 faculty login success');

	const facultyLogin = await loginWithEmailPassword({
		email: facultyEmail,
		password: facultyPassword,
		ipAddress: '127.0.0.1',
		userAgent: 'local-auth-test',
	});

	assert(facultyLogin.ok, 'Faculty login returns success');
	if (facultyLogin.ok) {
		assertEqual(facultyLogin.user.role, 'faculty', 'Faculty role is returned');
		assertEqual(facultyLogin.user.authSource, 'local', 'Faculty auth source is local');
	}

	section('TC-AUTH-03 token payload contains local metadata');

	if (officerLogin.ok) {
		const decoded = jwt.verify(officerLogin.token, process.env.JWT_SECRET!) as {
			userId: number;
			role: string;
			authSource?: string;
			schoolId?: number;
			accountId?: number;
			email?: string;
		};

		assertEqual(decoded.authSource, 'local', 'Decoded token authSource is local');
		assertEqual(decoded.role, 'officer', 'Decoded token role is officer');
		assertEqual(decoded.email, officerEmail, 'Decoded token email matches seeded officer email');
		assert(typeof decoded.schoolId === 'number', 'Decoded token includes schoolId');
		assert(typeof decoded.accountId === 'number', 'Decoded token includes accountId');
	} else {
		assert(false, 'Skipped token payload checks because officer login failed');
	}

	section('TC-AUTH-04 invalid email validation');

	const invalidEmailLogin = await loginWithEmailPassword({
		email: 'invalid-email-format',
		password: seededPassword,
		ipAddress: '127.0.0.1',
	});

	assert(!invalidEmailLogin.ok, 'Invalid email returns error');
	if (!invalidEmailLogin.ok) {
		assertEqual(invalidEmailLogin.status, 400, 'Invalid email returns HTTP 400 semantics');
		assertEqual(invalidEmailLogin.code, 'INVALID_EMAIL', 'Invalid email returns INVALID_EMAIL code');
	}

	section('TC-AUTH-05 empty password validation');

	const emptyPasswordLogin = await loginWithEmailPassword({
		email: officerEmail,
		password: '',
		ipAddress: '127.0.0.1',
	});

	assert(!emptyPasswordLogin.ok, 'Empty password returns error');
	if (!emptyPasswordLogin.ok) {
		assertEqual(emptyPasswordLogin.status, 400, 'Empty password returns HTTP 400 semantics');
		assertEqual(emptyPasswordLogin.code, 'INVALID_PASSWORD', 'Empty password returns INVALID_PASSWORD code');
	}

	section('TC-AUTH-06 invalid credential rejection');

	const wrongPasswordLogin = await loginWithEmailPassword({
		email: officerEmail,
		password: 'wrong-password',
		ipAddress: '127.0.0.1',
	});

	assert(!wrongPasswordLogin.ok, 'Wrong password returns error');
	if (!wrongPasswordLogin.ok) {
		assertEqual(wrongPasswordLogin.status, 401, 'Wrong password returns HTTP 401 semantics');
		assertEqual(wrongPasswordLogin.code, 'INVALID_CREDENTIALS', 'Wrong password returns INVALID_CREDENTIALS code');
	}

	section('TC-AUTH-07 missing JWT secret handling');

	const priorSecret = process.env.JWT_SECRET;
	delete process.env.JWT_SECRET;

	const missingSecretLogin = await loginWithEmailPassword({
		email: officerEmail,
		password: officerPassword,
		ipAddress: '127.0.0.1',
	});

	process.env.JWT_SECRET = priorSecret;

	assert(!missingSecretLogin.ok, 'Missing JWT secret returns error');
	if (!missingSecretLogin.ok) {
		assertEqual(missingSecretLogin.status, 500, 'Missing JWT secret returns HTTP 500 semantics');
		assertEqual(missingSecretLogin.code, 'SERVER_ERROR', 'Missing JWT secret returns SERVER_ERROR code');
	}

	section('TC-AUTH-08 locked account enforcement');

	const snapshot = await prisma.atlasAuthAccount.findUnique({ where: { id: officerAccount.id } });
	if (!snapshot) {
		assert(false, 'Unable to load officer account snapshot for lock test');
	} else {
		try {
			await prisma.atlasAuthAccount.update({
				where: { id: officerAccount.id },
				data: {
					lockedUntil: new Date(Date.now() + 120_000),
				},
			});

			const lockedLogin = await loginWithEmailPassword({
				email: officerEmail,
				password: officerPassword,
				ipAddress: '127.0.0.1',
			});

			assert(!lockedLogin.ok, 'Locked account returns error');
			if (!lockedLogin.ok) {
				assertEqual(lockedLogin.status, 429, 'Locked account returns HTTP 429 semantics');
				assertEqual(lockedLogin.code, 'AUTH_RATE_LIMITED', 'Locked account returns AUTH_RATE_LIMITED code');
				assert(typeof lockedLogin.retryAfterSeconds === 'number', 'Locked account includes retryAfterSeconds');
			}
		} finally {
			await prisma.atlasAuthAccount.update({
				where: { id: officerAccount.id },
				data: {
					failedLoginCount: snapshot.failedLoginCount,
					lockedUntil: snapshot.lockedUntil,
					lastLoginAt: snapshot.lastLoginAt,
				},
			});
		}
	}

	section('TC-AUTH-09 delegated faculty login prefers stable external faculty id');

	const delegatedFacultyEmail = 'delegated.faculty.external-id@deped.edu.ph';
	const delegatedFacultyExternalId = 942424;
	const delegatedSchoolId = officerAccount.schoolId;
	const originalFetch = globalThis.fetch;
	const originalEnrollProApi = process.env.ENROLLPRO_API;

	try {
		await prisma.atlasAuthAccount.deleteMany({ where: { email: delegatedFacultyEmail } });
		await prisma.facultyMirror.deleteMany({
			where: { schoolId: delegatedSchoolId, externalId: delegatedFacultyExternalId },
		});

		const delegatedMirror = await prisma.facultyMirror.create({
			data: {
				schoolId: delegatedSchoolId,
				externalId: delegatedFacultyExternalId,
				firstName: 'Delegated',
				lastName: 'Faculty',
				contactInfo: 'mismatched-linking-email@deped.edu.ph',
			},
		});

		globalThis.fetch = ((async () => ({
			ok: true,
			json: async () => ({
				valid: true,
				user: {
					id: 88001,
					teacherId: delegatedFacultyExternalId,
					firstName: 'Delegated',
					lastName: 'Faculty',
					email: delegatedFacultyEmail,
					role: 'TEACHER',
					mustChangePassword: false,
				},
			}),
		})) as unknown) as typeof globalThis.fetch;
		process.env.ENROLLPRO_API = 'http://delegated-auth-test/api';

		const delegatedLogin = await loginWithEmailPassword({
			email: delegatedFacultyEmail,
			password: 'Incorrect_404',
			ipAddress: '127.0.0.1',
			userAgent: 'local-auth-test',
		});

		assert(delegatedLogin.ok, 'Delegated faculty login returns success');
		if (delegatedLogin.ok) {
			assertEqual(delegatedLogin.user.role, 'faculty', 'Delegated user role is faculty');
			assertEqual(
				delegatedLogin.user.userId,
				delegatedFacultyExternalId,
				'Delegated faculty token uses FacultyMirror.externalId for userId',
			);

			const delegatedAccount = await prisma.atlasAuthAccount.findUnique({ where: { email: delegatedFacultyEmail } });
			assert(Boolean(delegatedAccount), 'Delegated ATLAS auth account is provisioned');
			assertEqual(
				delegatedAccount?.facultyId ?? null,
				delegatedMirror.id,
				'Delegated ATLAS auth account links to matching FacultyMirror by external id',
			);
		}
	} finally {
		globalThis.fetch = originalFetch;
		if (originalEnrollProApi === undefined) {
			delete process.env.ENROLLPRO_API;
		} else {
			process.env.ENROLLPRO_API = originalEnrollProApi;
		}
		await prisma.atlasAuthAccount.deleteMany({ where: { email: delegatedFacultyEmail } });
		await prisma.facultyMirror.deleteMany({
			where: { schoolId: delegatedSchoolId, externalId: delegatedFacultyExternalId },
		});
	}

	section('TC-AUTH-10 delegated faculty login hydrates a missing mirror from one exact faculty-feed match');

	const feedFacultyEmail = 'feed.faculty.exact@deped.edu.ph';
	const feedFacultyEmployeeId = `8${Date.now().toString().slice(-6)}`;
	const feedFacultyExternalId = 952525;

	try {
		await prisma.atlasAuthAccount.deleteMany({ where: { email: feedFacultyEmail } });
		await prisma.facultyMirror.deleteMany({ where: { schoolId: delegatedSchoolId, externalId: feedFacultyExternalId } });
		await prisma.atlasAuthAccount.create({
			data: {
				schoolId: delegatedSchoolId,
				email: feedFacultyEmail,
				employeeId: feedFacultyEmployeeId,
				accountName: feedFacultyEmployeeId,
				role: 'faculty',
				passwordHash: await bcrypt.hash('Delegated_2026!', 10),
				isActive: true,
			},
		});

		globalThis.fetch = ((async (input: string | URL | Request) => {
			const url = String(input);
			if (url.includes('/auth/verify')) {
				return new Response(JSON.stringify({
					valid: true,
					user: {
						id: 88002,
						firstName: 'Feed',
						lastName: 'Faculty',
						email: feedFacultyEmail,
						employeeId: feedFacultyEmployeeId,
						accountName: feedFacultyEmployeeId,
						role: 'TEACHER',
						mustChangePassword: false,
					},
				}), { status: 200, headers: { 'content-type': 'application/json' } });
			}
			if (url.includes('/integration/v1/faculty')) {
				return new Response(JSON.stringify({
					data: [{
						teacherId: feedFacultyExternalId,
						employeeId: feedFacultyEmployeeId,
						firstName: 'Feed',
						lastName: 'Faculty',
						email: feedFacultyEmail,
						departmentCode: 'SCIENCE',
						specialization: 'Science',
						isActive: true,
					}],
					meta: { page: 1, totalPages: 1, limit: 200 },
				}), { status: 200, headers: { 'content-type': 'application/json' } });
			}
			return new Response(null, { status: 404 });
		}) as unknown) as typeof globalThis.fetch;
		process.env.ENROLLPRO_API = 'http://delegated-auth-test/api';

		const feedLogin = await loginWithEmailPassword({
			email: feedFacultyEmail,
			password: 'Delegated_2026!',
			ipAddress: '127.0.0.1',
			userAgent: 'local-auth-feed-test',
		});

		assert(feedLogin.ok, 'Faculty-feed delegated login returns success');
		const feedMirror = await prisma.facultyMirror.findUnique({
			where: { schoolId_externalId: { schoolId: delegatedSchoolId, externalId: feedFacultyExternalId } },
		});
		assert(Boolean(feedMirror), 'Exact faculty-feed match creates the missing FacultyMirror');
		const feedAccount = await prisma.atlasAuthAccount.findUnique({ where: { email: feedFacultyEmail } });
		assertEqual(feedAccount?.facultyId ?? null, feedMirror?.id ?? null, 'Provisioned account links to the hydrated FacultyMirror');
		if (feedLogin.ok) assertEqual(feedLogin.user.userId, feedFacultyExternalId, 'Faculty token uses hydrated external teacher id');
	} finally {
		globalThis.fetch = originalFetch;
		if (originalEnrollProApi === undefined) delete process.env.ENROLLPRO_API;
		else process.env.ENROLLPRO_API = originalEnrollProApi;
		await prisma.atlasAuthAccount.deleteMany({ where: { email: feedFacultyEmail } });
		await prisma.facultyMirror.deleteMany({ where: { schoolId: delegatedSchoolId, externalId: feedFacultyExternalId } });
	}

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run().catch((error) => {
	console.error('\nUnhandled test error:', error);
	process.exit(1);
});
