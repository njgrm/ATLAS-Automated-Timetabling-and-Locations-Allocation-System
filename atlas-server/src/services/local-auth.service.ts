import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { resolveCanonicalFacultyMirror } from './faculty-identity.service.js';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';
const MAX_FAILED_ATTEMPTS = Number(process.env.ATLAS_AUTH_MAX_FAILED_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.ATLAS_AUTH_LOCKOUT_MINUTES ?? 15);
const MEMORY_WINDOW_MS = Number(process.env.ATLAS_AUTH_MEMORY_WINDOW_MS ?? 10 * 60 * 1000);
// Set ATLAS_AUTH_DISABLE_RATE_LIMIT=true in .env to bypass all login rate limiting.
// Remove or set to false to re-enable enforcement.
const DISABLE_RATE_LIMIT = process.env.ATLAS_AUTH_DISABLE_RATE_LIMIT === 'true';

type RateEntry = {
	count: number;
	windowStart: number;
	lockedUntil: number | null;
};

const memoryRateLimit = new Map<string, RateEntry>();

export type LocalAuthUser = {
	userId: number;
	role: string;
	mustChangePassword: boolean;
	authSource: 'local';
	schoolId: number;
	accountId: number;
	facultyId?: number | null;
	email: string;
	employeeId?: string | null;
	accountName?: string | null;
};

export type LocalLoginResult =
	| {
			ok: true;
			token: string;
			user: LocalAuthUser;
	  }
	| {
			ok: false;
			status: number;
			code: string;
			message: string;
			retryAfterSeconds?: number;
	  };

function normalizeIdentifier(value: string): string {
	return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function rateLimitKey(identifier: string, ip: string): string {
	return `${ip}::${identifier}`;
}

function getOrCreateMemoryEntry(key: string, now: number): RateEntry {
	const current = memoryRateLimit.get(key);
	if (!current || now - current.windowStart > MEMORY_WINDOW_MS) {
		const fresh = { count: 0, windowStart: now, lockedUntil: null };
		memoryRateLimit.set(key, fresh);
		return fresh;
	}
	return current;
}

function registerMemoryFailure(identifier: string, ip: string, now: number): void {
	const key = rateLimitKey(identifier, ip);
	const entry = getOrCreateMemoryEntry(key, now);
	entry.count += 1;
	if (entry.count >= MAX_FAILED_ATTEMPTS) {
		entry.lockedUntil = now + LOCKOUT_MINUTES * 60_000;
		entry.count = 0;
		entry.windowStart = now;
	}
	memoryRateLimit.set(key, entry);
}

function getMemoryLockRemainingSeconds(identifier: string, ip: string, now: number): number {
	const key = rateLimitKey(identifier, ip);
	const entry = getOrCreateMemoryEntry(key, now);
	if (!entry.lockedUntil || entry.lockedUntil <= now) {
		entry.lockedUntil = null;
		memoryRateLimit.set(key, entry);
		return 0;
	}
	return Math.ceil((entry.lockedUntil - now) / 1000);
}

function createToken(user: LocalAuthUser): string | null {
	const secret = process.env.JWT_SECRET;
	if (!secret) return null;
	return jwt.sign(user, secret, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

async function writeAuditLog(params: {
	schoolId: number;
	actorId: number;
	action: string;
	targetIds: number[];
	metadata?: Prisma.InputJsonObject;
}): Promise<void> {
	await prisma.auditLog.create({
		data: {
			schoolId: params.schoolId,
			action: params.action,
			actorId: params.actorId,
			targetIds: params.targetIds,
			metadata: params.metadata,
		},
	});
}

// ─── EnrollPro credential delegation ──────────────────────────────────────────

type EnrollProRole = 'SYSTEM_ADMIN' | 'HEAD_REGISTRAR' | 'GRADE_LEVEL_COORDINATOR' | 'CLASS_ADVISER' | 'TEACHER' | string;

type EnrollProVerifiedUser = {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	employeeId: string | null;
	accountName: string | null;
	role: EnrollProRole;
	mustChangePassword: boolean;
	teacherId?: number | null;
	externalTeacherId?: number | null;
	facultyExternalId?: number | null;
};

function mapEnrollProRole(role: EnrollProRole): 'officer' | 'faculty' {
	switch (role) {
		case 'TEACHER':
		case 'CLASS_ADVISER':
			return 'faculty';
		default:
			return 'officer';
	}
}

/**
 * Try to validate credentials against EnrollPro's /api/auth/verify endpoint.
 * Returns null when EnrollPro is unreachable or the credentials are invalid.
 */
async function tryEnrollProVerify(accountName: string, password: string): Promise<{
	valid: true;
	user: EnrollProVerifiedUser;
} | null> {
	const enrollProApi = (process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/$/, '');
	try {
		const resp = await fetch(`${enrollProApi}/auth/verify`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accountName, password }),
			signal: AbortSignal.timeout(5000),
		});
		if (!resp.ok) return null;
		const data = await resp.json() as { valid?: boolean; user?: EnrollProVerifiedUser };
		if (!data?.valid || !data.user) return null;
		return { valid: true, user: data.user };
	} catch {
		return null;
	}
}

function getEnrollProFacultyExternalId(user: EnrollProVerifiedUser): number | null {
	const candidate = user.externalTeacherId ?? user.facultyExternalId ?? user.teacherId ?? null;
	return typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

async function findLinkedFacultyMirror(params: {
	schoolId: number;
	role: 'officer' | 'faculty';
	email: string;
	employeeId: string | null;
	enrollProUser: EnrollProVerifiedUser;
}): Promise<{ id: number; externalId: number } | null> {
	if (params.role !== 'faculty') {
		return null;
	}

	const externalId = getEnrollProFacultyExternalId(params.enrollProUser);
	const resolution = await resolveCanonicalFacultyMirror({
		schoolId: params.schoolId,
		sourceExternalId: externalId,
		employeeId: params.employeeId,
		email: params.email,
	});

	return resolution ? { id: resolution.faculty.id, externalId: resolution.faculty.externalId } : null;
}

/**
 * Provision (create or update) an ATLAS auth account from a verified EnrollPro identity.
 * Maps EnrollPro roles to ATLAS roles and links to FacultyMirror when applicable.
 */
async function provisionFromEnrollPro(params: {
	enrollProUser: EnrollProVerifiedUser;
	password: string;
	schoolId: number;
}): Promise<{ account: { id: number; role: string; schoolId: number; facultyId: number | null; facultyExternalId: number | null; mustChangePassword: boolean; email: string; employeeId: string | null; accountName: string | null } }> {
	const role = mapEnrollProRole(params.enrollProUser.role);
	const hash = await bcrypt.hash(params.password, 12);
	const email = params.enrollProUser.email.trim().toLowerCase();
	const employeeId = params.enrollProUser.employeeId;
	const accountName = params.enrollProUser.accountName;

	const linkedMirror = await findLinkedFacultyMirror({
		schoolId: params.schoolId,
		role,
		email,
		employeeId,
		enrollProUser: params.enrollProUser,
	});
	const facultyId = linkedMirror?.id ?? null;
	const facultyExternalId = linkedMirror?.externalId ?? null;

	// Try finding by accountName or employeeId if email doesn't match
	const existing = await prisma.atlasAuthAccount.findFirst({
		where: {
			OR: [
				{ email },
				employeeId ? { employeeId } : {},
				accountName ? { accountName } : {},
			].filter(x => Object.keys(x).length > 0) as Prisma.AtlasAuthAccountWhereInput[]
		}
	});

	if (existing) {
		const updated = await prisma.atlasAuthAccount.update({
			where: { id: existing.id },
			data: {
				email,
				employeeId,
				accountName,
				passwordHash: hash,
				role,
				schoolId: params.schoolId,
				facultyId,
				isActive: true,
				mustChangePassword: params.enrollProUser.mustChangePassword,
				failedLoginCount: 0,
				lockedUntil: null,
			},
		});
		return { account: { id: updated.id, role: updated.role, schoolId: updated.schoolId, facultyId: updated.facultyId, facultyExternalId, mustChangePassword: updated.mustChangePassword, email: updated.email, employeeId: updated.employeeId, accountName: updated.accountName } };
	}

	const created = await prisma.atlasAuthAccount.create({
		data: {
			email,
			employeeId,
			accountName,
			passwordHash: hash,
			role,
			schoolId: params.schoolId,
			facultyId,
			isActive: true,
			mustChangePassword: params.enrollProUser.mustChangePassword,
		},
	});
	return { account: { id: created.id, role: created.role, schoolId: created.schoolId, facultyId: created.facultyId, facultyExternalId, mustChangePassword: created.mustChangePassword, email: created.email, employeeId: created.employeeId, accountName: created.accountName } };
}

// ──────────────────────────────────────────────────────────────────────────────

export async function login(params: {
	identifier: string;
	password: string;
	ipAddress: string;
	userAgent?: string;
}): Promise<LocalLoginResult> {
	const identifier = normalizeIdentifier(params.identifier);
	const now = Date.now();

	if (!identifier) {
		return {
			ok: false,
			status: 400,
			code: 'INVALID_IDENTIFIER',
			message: 'An identifier (Employee ID or Email) is required.',
		};
	}

	if (!params.password || params.password.length < 1) {
		return {
			ok: false,
			status: 400,
			code: 'INVALID_PASSWORD',
			message: 'Password is required.',
		};
	}

	if (!params.ipAddress || params.ipAddress.trim().length === 0) {
		return {
			ok: false,
			status: 400,
			code: 'INVALID_IP',
			message: 'ipAddress is required.',
		};
	}

	const memoryRetryAfter = getMemoryLockRemainingSeconds(identifier, params.ipAddress, now);
	if (!DISABLE_RATE_LIMIT && memoryRetryAfter > 0) {
		return {
			ok: false,
			status: 429,
			code: 'AUTH_RATE_LIMITED',
			message: 'Too many login attempts. Please try again later.',
			retryAfterSeconds: memoryRetryAfter,
		};
	}

	// Find local account by email, accountName, or employeeId
	const account = await prisma.atlasAuthAccount.findFirst({
		where: {
			OR: [
				{ email: identifier },
				{ employeeId: identifier },
				{ accountName: identifier },
			],
		},
		include: {
			faculty: {
				select: {
					id: true,
					externalId: true,
					employeeId: true,
					contactInfo: true,
				},
			},
		},
	});

	// No local ATLAS account — try EnrollPro delegation first before rejecting
	if (!account) {
		const enrollProResult = await tryEnrollProVerify(identifier, params.password);
		if (enrollProResult) {
			const defaultSchoolId = Number(process.env.ATLAS_DEFAULT_SCHOOL_ID ?? 1);
			const { account: provisioned } = await provisionFromEnrollPro({
				enrollProUser: enrollProResult.user,
				password: params.password,
				schoolId: defaultSchoolId,
			});
			
			const linkedFacultyMirrorExternalId = provisioned.facultyExternalId;
			const userId = provisioned.role === 'faculty' && linkedFacultyMirrorExternalId
				? linkedFacultyMirrorExternalId
				: provisioned.id;
			
			const user: LocalAuthUser = {
				userId,
				role: provisioned.role,
				mustChangePassword: provisioned.mustChangePassword,
				authSource: 'local',
				schoolId: provisioned.schoolId,
				accountId: provisioned.id,
				facultyId: provisioned.facultyId,
				email: provisioned.email,
				employeeId: provisioned.employeeId,
				accountName: provisioned.accountName,
			};
			
			const token = createToken(user);
			if (!token) {
				return { ok: false, status: 500, code: 'SERVER_ERROR', message: 'JWT secret not configured.' };
			}
			return { ok: true, token, user };
		}
		registerMemoryFailure(identifier, params.ipAddress, now);
		return {
			ok: false,
			status: 401,
			code: 'INVALID_CREDENTIALS',
			message: 'Invalid Employee ID/Email or password.',
		};
	}

	if (!account.isActive) {
		registerMemoryFailure(identifier, params.ipAddress, now);
		return {
			ok: false,
			status: 401,
			code: 'INVALID_CREDENTIALS',
			message: 'Account is inactive.',
		};
	}

	if (!DISABLE_RATE_LIMIT && account.lockedUntil && account.lockedUntil.getTime() > now) {
		const seconds = Math.ceil((account.lockedUntil.getTime() - now) / 1000);
		return {
			ok: false,
			status: 429,
			code: 'AUTH_RATE_LIMITED',
			message: 'Too many login attempts. Please try again later.',
			retryAfterSeconds: seconds,
		};
	}

	const validPassword = await bcrypt.compare(params.password, account.passwordHash);
	if (!validPassword) {
		// Local password check failed — try EnrollPro delegation (user may have changed
		// their EnrollPro password or Employee ID since the last sync).
		const enrollProResult = await tryEnrollProVerify(identifier, params.password);
		if (enrollProResult) {
			const { account: provisioned } = await provisionFromEnrollPro({
				enrollProUser: enrollProResult.user,
				password: params.password,
				schoolId: account.schoolId,
			});
			const linkedFacultyMirrorExternalId = provisioned.facultyExternalId ?? account.faculty?.externalId ?? null;
			const userId = provisioned.role === 'faculty' && linkedFacultyMirrorExternalId
				? linkedFacultyMirrorExternalId
				: provisioned.id;
			
			const user: LocalAuthUser = {
				userId,
				role: provisioned.role,
				mustChangePassword: provisioned.mustChangePassword,
				authSource: 'local',
				schoolId: provisioned.schoolId,
				accountId: provisioned.id,
				facultyId: provisioned.facultyId,
				email: provisioned.email,
				employeeId: provisioned.employeeId,
				accountName: provisioned.accountName,
			};
			const token = createToken(user);
			if (!token) {
				return { ok: false, status: 500, code: 'SERVER_ERROR', message: 'JWT secret not configured.' };
			}
			await writeAuditLog({
				schoolId: provisioned.schoolId,
				actorId: provisioned.id,
				action: 'LOCAL_LOGIN_SUCCESS',
				targetIds: [provisioned.id],
				metadata: { identifier, ipAddress: params.ipAddress, userAgent: params.userAgent ?? null, role: provisioned.role, via: 'enrollpro-delegation' },
			});
			return { ok: true, token, user };
		}

		registerMemoryFailure(identifier, params.ipAddress, now);
		const nextFailedCount = account.failedLoginCount + 1;
		const shouldLock = nextFailedCount >= MAX_FAILED_ATTEMPTS;
		const lockedUntil = shouldLock ? new Date(now + LOCKOUT_MINUTES * 60_000) : null;

		await prisma.atlasAuthAccount.update({
			where: { id: account.id },
			data: {
				failedLoginCount: shouldLock ? 0 : nextFailedCount,
				lockedUntil,
			},
		});

		await writeAuditLog({
			schoolId: account.schoolId,
			actorId: account.id,
			action: 'LOCAL_LOGIN_FAILED',
			targetIds: [account.id],
			metadata: {
				identifier,
				ipAddress: params.ipAddress,
				userAgent: params.userAgent ?? null,
				attempt: nextFailedCount,
				locked: shouldLock,
			},
		});

		if (shouldLock) {
			return {
				ok: false,
				status: 429,
				code: 'AUTH_RATE_LIMITED',
				message: 'Too many login attempts. Please try again later.',
				retryAfterSeconds: LOCKOUT_MINUTES * 60,
			};
		}

		return {
			ok: false,
			status: 401,
			code: 'INVALID_CREDENTIALS',
			message: 'Invalid Employee ID/Email or password.',
		};
	}

	const canonicalFaculty = account.role === 'faculty'
		? await resolveCanonicalFacultyMirror({
			schoolId: account.schoolId,
			accountId: account.id,
			linkedFacultyId: account.facultyId,
			tokenUserId: account.faculty?.externalId ?? null,
			email: account.email,
			employeeId: account.employeeId,
			accountName: account.accountName,
		})
		: null;
	const userId = account.role === 'faculty' && canonicalFaculty
		? canonicalFaculty.faculty.externalId
		: account.id;
	const facultyId = account.role === 'faculty'
		? canonicalFaculty?.faculty.id ?? account.facultyId ?? null
		: null;

	const user: LocalAuthUser = {
		userId,
		role: account.role,
		mustChangePassword: account.mustChangePassword,
		authSource: 'local',
		schoolId: account.schoolId,
		accountId: account.id,
		facultyId,
		email: account.email,
		employeeId: account.employeeId,
		accountName: account.accountName,
	};

	const token = createToken(user);
	if (!token) {
		return {
			ok: false,
			status: 500,
			code: 'SERVER_ERROR',
			message: 'JWT secret not configured.',
		};
	}

	await prisma.atlasAuthAccount.update({
		where: { id: account.id },
		data: {
			facultyId,
			failedLoginCount: 0,
			lockedUntil: null,
			lastLoginAt: new Date(now),
		},
	});

	await writeAuditLog({
		schoolId: account.schoolId,
		actorId: account.id,
		action: 'LOCAL_LOGIN_SUCCESS',
		targetIds: [account.id],
		metadata: {
			identifier,
			ipAddress: params.ipAddress,
			userAgent: params.userAgent ?? null,
			role: account.role,
		},
	});

	return {
		ok: true,
		token,
		user,
	};
}

export async function loginWithEmailPassword(params: {
	email: string;
	password: string;
	ipAddress: string;
	userAgent?: string;
}): Promise<LocalLoginResult> {
	return login({
		identifier: params.email,
		password: params.password,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
	});
}

export async function seedLocalAuthAccounts(params: {
	schoolId: number;
}): Promise<{ created: number; updated: number }> {
	const defaultPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
	const hash = await bcrypt.hash(defaultPassword, 12);

	const activeFaculty = await prisma.facultyMirror.findMany({
		where: {
			schoolId: params.schoolId,
			isActiveForScheduling: true,
		},
		select: {
			id: true,
			externalId: true,
			firstName: true,
			lastName: true,
			contactInfo: true,
		},
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
	});

	const accounts = [
		{
			email: process.env.ATLAS_SEEDED_OFFICER_EMAIL ?? 'officer@deped.edu.ph',
			role: 'officer',
			facultyId: null,
			mustChangePassword: true,
		},
		...buildFacultySeedAccounts(activeFaculty),
	];

	let created = 0;
	let updated = 0;
	for (const account of accounts) {
		if (account.role === 'faculty' && !account.facultyId) {
			continue;
		}

		const existing = await prisma.atlasAuthAccount.findUnique({ where: { email: account.email } });
		if (existing) {
			await prisma.atlasAuthAccount.update({
				where: { id: existing.id },
				data: {
					schoolId: params.schoolId,
					facultyId: account.facultyId,
					role: account.role,
					passwordHash: hash,
					isActive: true,
					mustChangePassword: account.mustChangePassword,
				},
			});
			updated += 1;
			continue;
		}

		await prisma.atlasAuthAccount.create({
			data: {
				schoolId: params.schoolId,
				facultyId: account.facultyId,
				email: account.email,
				role: account.role,
				passwordHash: hash,
				isActive: true,
				mustChangePassword: account.mustChangePassword,
			},
		});
		created += 1;
	}

	return { created, updated };
}

function normalizeNameToken(value: string): string {
	const cleaned = value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z\s-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return 'user';
	return cleaned.replace(/\s+/g, '-');
}

function extractPrimaryNamePart(value: string): string {
	const normalized = normalizeNameToken(value);
	const parts = normalized.split(/[\s-]+/).filter(Boolean);
	return parts[0] ?? 'user';
}

function deriveMiddleInitial(firstName: string, externalId: number, offset = 0): string {
	const parts = normalizeNameToken(firstName).split(/[\s-]+/).filter(Boolean);
	if (parts.length > 1 && parts[1][0]) {
		const initial = parts[1][0].toLowerCase();
		const code = initial.charCodeAt(0) - 97;
		const rotated = ((code + offset) % 26 + 26) % 26;
		return String.fromCharCode(97 + rotated);
	}
	const seed = Math.abs(externalId + offset);
	return String.fromCharCode(97 + (seed % 26));
}

export type FacultySeedIdentity = {
	id: number;
	externalId: number;
	firstName: string;
	lastName: string;
	contactInfo?: string | null;
};

function tryNormalizeEmail(value: string | null | undefined): string | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	return isValidEmail(normalized) ? normalized : null;
}

export function buildFacultySeedAccounts(facultyRows: FacultySeedIdentity[]): Array<{
	email: string;
	role: 'faculty';
	facultyId: number;
	mustChangePassword: true;
}> {
	const usedEmails = new Set<string>();
	const byBase = new Map<string, FacultySeedIdentity[]>();

	for (const row of facultyRows) {
		const first = extractPrimaryNamePart(row.firstName);
		const last = extractPrimaryNamePart(row.lastName);
		const base = `${first}.${last}`;
		const group = byBase.get(base) ?? [];
		group.push(row);
		byBase.set(base, group);
	}

	const result: Array<{
		email: string;
		role: 'faculty';
		facultyId: number;
		mustChangePassword: true;
	}> = [];

	const sortedBases = [...byBase.keys()].sort();
	for (const base of sortedBases) {
		const rows = (byBase.get(base) ?? []).sort((a, b) => a.externalId - b.externalId || a.id - b.id);

		for (const row of rows) {
			const upstreamEmail = tryNormalizeEmail(row.contactInfo);
			if (!upstreamEmail || usedEmails.has(upstreamEmail)) {
				continue;
			}
			usedEmails.add(upstreamEmail);
			result.push({
				email: upstreamEmail,
				role: 'faculty',
				facultyId: row.id,
				mustChangePassword: true,
			});
		}

		const unresolvedRows = rows.filter((row) => {
			const upstreamEmail = tryNormalizeEmail(row.contactInfo);
			return !upstreamEmail || !usedEmails.has(upstreamEmail) || result.every((entry) => entry.facultyId !== row.id);
		});

		if (unresolvedRows.length === 0) {
			continue;
		}

		if (unresolvedRows.length === 1) {
			const email = `${base}@deped.edu.ph`;
			if (usedEmails.has(email)) {
				const row = unresolvedRows[0];
				let offset = 0;
				const first = extractPrimaryNamePart(row.firstName);
				const last = extractPrimaryNamePart(row.lastName);
				let fallbackEmail = `${first}.${deriveMiddleInitial(row.firstName, row.externalId, offset)}.${last}@deped.edu.ph`;
				while (usedEmails.has(fallbackEmail) && offset < 52) {
					offset += 1;
					fallbackEmail = `${first}.${deriveMiddleInitial(row.firstName, row.externalId, offset)}.${last}@deped.edu.ph`;
				}
				usedEmails.add(fallbackEmail);
				result.push({
					email: fallbackEmail,
					role: 'faculty',
					facultyId: row.id,
					mustChangePassword: true,
				});
				continue;
			}

			usedEmails.add(email);
			result.push({
				email,
				role: 'faculty',
				facultyId: unresolvedRows[0].id,
				mustChangePassword: true,
			});
			continue;
		}

		for (const row of unresolvedRows) {
			const first = extractPrimaryNamePart(row.firstName);
			const last = extractPrimaryNamePart(row.lastName);
			let offset = 0;
			let email = `${first}.${deriveMiddleInitial(row.firstName, row.externalId, offset)}.${last}@deped.edu.ph`;
			while (usedEmails.has(email) && offset < 52) {
				offset += 1;
				email = `${first}.${deriveMiddleInitial(row.firstName, row.externalId, offset)}.${last}@deped.edu.ph`;
			}
			usedEmails.add(email);
			result.push({
				email,
				role: 'faculty',
				facultyId: row.id,
				mustChangePassword: true,
			});
		}
	}

	return result;
}
