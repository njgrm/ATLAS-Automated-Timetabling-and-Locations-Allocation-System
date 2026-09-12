import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { resolveCanonicalFacultyMirror, type CanonicalFacultyResolution } from './faculty-identity.service.js';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';
const MAX_FAILED_ATTEMPTS = Number(process.env.ATLAS_AUTH_MAX_FAILED_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.ATLAS_AUTH_LOCKOUT_MINUTES ?? 15);
const MEMORY_WINDOW_MS = Number(process.env.ATLAS_AUTH_MEMORY_WINDOW_MS ?? 10 * 60 * 1000);
// Set ATLAS_AUTH_DISABLE_RATE_LIMIT=true in .env to bypass all login rate limiting.
// Remove or set to false to re-enable enforcement.
const isRateLimitDisabled = () => process.env.ATLAS_AUTH_DISABLE_RATE_LIMIT === 'true';

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

// ─── Companion SSO additive session/audit surface (COMPANION-SSO-C01) ─────────
//
// Minimal additive exports so the companion SSO path creates a local session
// with EXACTLY the same JWT mechanics and audit contract as a local login.
// Existing login functions above/below are untouched.

/** Issue a local ATLAS JWT for a companion SSO session using the same signer. */
export function issueCompanionSsoToken(user: LocalAuthUser): string | null {
	return createToken(user);
}

/**
 * Write one companion SSO audit row. Mirrors the private local-login audit
 * writer. Callers must pass metadata containing no code, secret, or identity
 * payload.
 */
export async function writeCompanionSsoAudit(params: {
	schoolId: number;
	actorId: number;
	action: string;
	targetIds: number[];
	metadata?: Prisma.InputJsonObject;
}): Promise<void> {
	await writeAuditLog(params);
}

// ─── EnrollPro credential delegation ──────────────────────────────────────────

type EnrollProRole = 'SYSTEM_ADMIN' | 'HEAD_REGISTRAR' | 'GRADE_LEVEL_COORDINATOR' | 'CLASS_ADVISER' | 'TEACHER' | string;

type EnrollProVerifiedUser = {
	id: number;
	firstName: string;
	lastName: string;
	email: string | null;
	employeeId: string | null;
	accountName: string | null;
	role?: EnrollProRole;
	roles?: EnrollProRole[];
	mustChangePassword: boolean;
	teacherId?: number | null;
	externalTeacherId?: number | null;
	facultyExternalId?: number | null;
};

type EnrollProFacultyFeedRow = {
	teacherId: number;
	employeeId?: string | null;
	firstName: string;
	lastName: string;
	email?: string | null;
	contactNumber?: string | null;
	department?: string | null;
	departmentCode?: string | null;
	departmentName?: string | null;
	specialization?: string | null;
	isActive?: boolean;
};

const ALLOWED_ENROLLPRO_ROLES = new Set(['SYSTEM_ADMIN', 'HEAD_REGISTRAR', 'GRADE_LEVEL_COORDINATOR', 'CLASS_ADVISER', 'TEACHER']);

function mapEnrollProRoles(roles: EnrollProRole[]): 'officer' | 'faculty' | null {
	const normalized = roles.map(r => r.trim().toUpperCase()).filter(r => ALLOWED_ENROLLPRO_ROLES.has(r));
	if (normalized.length === 0) return null;
	const hasFaculty = normalized.some(r => r === 'TEACHER' || r === 'CLASS_ADVISER');
	const hasOfficer = normalized.some(r => r === 'SYSTEM_ADMIN' || r === 'HEAD_REGISTRAR' || r === 'GRADE_LEVEL_COORDINATOR');
	if (hasFaculty && hasOfficer) return 'officer';
	if (hasFaculty) return 'faculty';
	if (hasOfficer) return 'officer';
	return null;
}

function resolveEnrollProRole(user: EnrollProVerifiedUser): 'officer' | 'faculty' | null {
	if (Array.isArray(user.roles) && user.roles.length > 0) {
		return mapEnrollProRoles(user.roles);
	}
	if (user.role) {
		return mapEnrollProRoles([user.role]);
	}
	return null;
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

function normalizedIdentity(value: string | null | undefined): string {
	return (value ?? '').trim().toLowerCase();
}

/**
 * Build the identity fields for an EnrollPro-provisioned account using ONLY
 * values actually returned by EnrollPro. Never derive an account name from an
 * email address, and never derive an employee ID from a row/external ID.
 * Missing upstream values stay absent (null) instead of being fabricated.
 */
export function buildEnrollProIdentityFields(user: EnrollProVerifiedUser): {
  employeeId: string | null;
  accountName: string | null;
} {
  const employeeId = typeof user.employeeId === 'string' && user.employeeId.trim()
    ? user.employeeId.trim()
    : null;
  const accountName = typeof user.accountName === 'string' && user.accountName.trim()
    ? user.accountName.trim()
    : null;
  return { employeeId, accountName };
}

function isDerivedAtlasEmail(email: string): boolean {
  return email.endsWith('@atlas.local');
}

function toSafeIdentifierSlug(value: string | number | null | undefined): string {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return normalized || 'unknown';
}

function resolveEnrollProAccountEmail(user: EnrollProVerifiedUser): string {
	const upstreamEmail = user.email?.trim().toLowerCase() ?? '';
	if (upstreamEmail && isValidEmail(upstreamEmail)) {
		return upstreamEmail;
	}

	const stableKey = user.employeeId?.trim()
		|| user.accountName?.trim()
		|| String(user.id);
	return `enrollpro-${toSafeIdentifierSlug(stableKey)}@atlas.local`;
}

export function selectExactEnrollProFacultyMatch(
	rows: EnrollProFacultyFeedRow[],
	identity: { employeeId: string | null; email: string },
): EnrollProFacultyFeedRow | null {
	const uniqueRows = [...new Map(rows
		.filter((row) => Number.isInteger(row.teacherId) && row.teacherId > 0 && row.isActive !== false)
		.map((row) => [row.teacherId, row])).values()];
	const employeeId = normalizedIdentity(identity.employeeId);
	if (employeeId) {
		const employeeMatches = uniqueRows.filter((row) => normalizedIdentity(row.employeeId) === employeeId);
		if (employeeMatches.length === 1) return employeeMatches[0];
		if (employeeMatches.length > 1) return null;
	}
	const email = normalizedIdentity(identity.email);
	if (!email) return null;
	const emailMatches = uniqueRows.filter((row) => normalizedIdentity(row.email) === email);
	return emailMatches.length === 1 ? emailMatches[0] : null;
}

async function hydrateFacultyMirrorFromEnrollProFeed(params: {
	schoolId: number;
	employeeId: string | null;
	email: string;
}): Promise<{ id: number; externalId: number } | null> {
	const enrollProApi = (process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/$/, '');
	const rows: EnrollProFacultyFeedRow[] = [];
	const cachedSnapshot = await prisma.facultySnapshot.findFirst({
		where: { schoolId: params.schoolId },
		orderBy: { fetchedAt: 'desc' },
		select: { payload: true },
	});
	if (Array.isArray(cachedSnapshot?.payload)) {
		for (const raw of cachedSnapshot.payload as Array<Record<string, unknown>>) {
			const teacherId = Number(raw.id ?? raw.teacherId ?? 0);
			if (!Number.isInteger(teacherId) || teacherId < 1) continue;
			rows.push({
				teacherId,
				employeeId: typeof raw.employeeId === 'string' ? raw.employeeId : null,
				firstName: typeof raw.firstName === 'string' ? raw.firstName : '',
				lastName: typeof raw.lastName === 'string' ? raw.lastName : '',
				email: typeof raw.contactInfo === 'string' && raw.contactInfo.includes('@') ? raw.contactInfo : null,
				contactNumber: typeof raw.contactInfo === 'string' && !raw.contactInfo.includes('@') ? raw.contactInfo : null,
				department: typeof raw.department === 'string' ? raw.department : null,
				specialization: typeof raw.specialization === 'string' ? raw.specialization : null,
				isActive: true,
			});
		}
	}
	let match = selectExactEnrollProFacultyMatch(rows, params);
	const pageSize = 200;
	let page = 1;
	let totalPages = 1;

	try {
		if (match) totalPages = 0;
		while (page <= totalPages) {
			const serviceToken = process.env.ENROLLPRO_SERVICE_TOKEN;
			const headers: Record<string, string> = {};
			if (serviceToken) {
				headers['Authorization'] = `Bearer ${serviceToken}`;
			}
			const response = await fetch(`${enrollProApi}/integration/v1/faculty?page=${page}&limit=${pageSize}`, {
				headers,
				signal: AbortSignal.timeout(5000),
			});
			if (!response.ok) return null;
			const payload = await response.json() as {
				data?: EnrollProFacultyFeedRow[];
				meta?: { totalPages?: number };
			};
			rows.push(...(Array.isArray(payload.data) ? payload.data : []));
			const reportedTotalPages = Number(payload.meta?.totalPages ?? 1);
			totalPages = Number.isInteger(reportedTotalPages) && reportedTotalPages > 0 ? reportedTotalPages : 1;
			page += 1;
		}
	} catch {
		if (!match) return null;
	}

	match ??= selectExactEnrollProFacultyMatch(rows, params);
	if (!match) return null;
	const firstName = match.firstName?.trim();
	const lastName = match.lastName?.trim();
	if (!firstName || !lastName) return null;

	// Hydrate ONLY values actually returned by EnrollPro (feed row or verified
	// response). A derived enrollpro-*@atlas.local placeholder is never written
	// into the mirror, and absent values never wipe existing mirror identity.
	const authoritativeEmployeeId = match.employeeId?.trim() || params.employeeId?.trim() || null;
	const upstreamContact = match.email?.trim().toLowerCase()
		|| match.contactNumber?.trim()
		|| (!isDerivedAtlasEmail(params.email) ? params.email : '')
		|| null;

	const mirror = await prisma.facultyMirror.upsert({
		where: { schoolId_externalId: { schoolId: params.schoolId, externalId: match.teacherId } },
		update: {
			...(authoritativeEmployeeId ? { employeeId: authoritativeEmployeeId } : {}),
			firstName,
			lastName,
			...(upstreamContact ? { contactInfo: upstreamContact } : {}),
			department: match.departmentCode ?? match.department ?? match.departmentName ?? null,
			specialization: match.specialization ?? null,
			isStale: false,
			staleReason: null,
			staleAt: null,
			lastSyncedAt: new Date(),
		},
		create: {
			schoolId: params.schoolId,
			externalId: match.teacherId,
			employeeId: authoritativeEmployeeId,
			firstName,
			lastName,
			contactInfo: upstreamContact,
			department: match.departmentCode ?? match.department ?? match.departmentName ?? null,
			specialization: match.specialization ?? null,
			isActiveForScheduling: true,
			isStale: false,
			lastSyncedAt: new Date(),
		},
		select: { id: true, externalId: true },
	});
	return mirror;
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

	if (resolution) return { id: resolution.faculty.id, externalId: resolution.faculty.externalId };
	return hydrateFacultyMirrorFromEnrollProFeed({
		schoolId: params.schoolId,
		employeeId: params.employeeId,
		email: params.email,
	});
}

/**
 * Provision (create or update) an ATLAS auth account from a verified EnrollPro identity.
 * Maps EnrollPro roles to ATLAS roles and links to FacultyMirror when applicable.
 */
async function provisionFromEnrollPro(params: {
	enrollProUser: EnrollProVerifiedUser;
	password: string;
	schoolId: number;
	resolvedRole: 'officer' | 'faculty';
}): Promise<{ account: { id: number; role: string; schoolId: number; facultyId: number | null; facultyExternalId: number | null; mustChangePassword: boolean; email: string; employeeId: string | null; accountName: string | null } }> {
	const role = params.resolvedRole;
	const hash = await bcrypt.hash(params.password, 12);
	const email = resolveEnrollProAccountEmail(params.enrollProUser);
	const { employeeId, accountName } = buildEnrollProIdentityFields(params.enrollProUser);

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
				...(employeeId ? { employeeId } : {}),
				...(accountName ? { accountName } : {}),
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
			...(employeeId ? { employeeId } : {}),
			...(accountName ? { accountName } : {}),
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

// ─── Mirror-mediated identifier resolution (Prompt 06, DBR-06.11) ────────────

export type LoginEligibleMirror = {
  id: number;
  schoolId: number;
  employeeId: string | null;
  isActiveForScheduling: boolean;
  isStale: boolean;
};

/** A mirror can back a login only when active for scheduling and not stale. */
export function isMirrorLoginEligible(mirror: LoginEligibleMirror): boolean {
  return mirror.isActiveForScheduling === true && mirror.isStale === false;
}

/**
 * Select exactly one eligible mirror. Rejects zero matches, ambiguous
 * multi-matches, and cross-school duplicates by returning null — the caller
 * then falls through to EnrollPro delegation or invalid credentials.
 */
export function selectSingleEligibleMirror(mirrors: LoginEligibleMirror[]): LoginEligibleMirror | null {
  const eligible = mirrors.filter(isMirrorLoginEligible);
  if (eligible.length !== 1) return null;
  return eligible[0] as LoginEligibleMirror;
}

export type FacultyLoginEligibility =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * F-06-03 fail-closed gate for the real `login()` path. A faculty account
 * receives a token only when exactly one canonical faculty mirror is resolved
 * and that mirror is in the same school, active for scheduling, and not
 * stale. Direct email, employee-ID, and account-name matches must not bypass
 * these checks — the gate runs after account lookup regardless of match path.
 * Officer/admin accounts are never subject to this gate.
 */
export function classifyFacultyLoginEligibility(
  resolution: CanonicalFacultyResolution | null,
  schoolId: number,
): FacultyLoginEligibility {
  if (!resolution) {
    return {
      ok: false,
      code: 'FACULTY_IDENTITY_UNRESOLVED',
      message: 'No active faculty record matches this account. Contact your scheduling officer.',
    };
  }
  if (resolution.duplicateCandidateIds.length !== 1) {
    return {
      ok: false,
      code: 'FACULTY_IDENTITY_AMBIGUOUS',
      message: 'This identifier matches multiple faculty records. Contact your scheduling officer.',
    };
  }
  if (resolution.faculty.schoolId !== schoolId) {
    return {
      ok: false,
      code: 'FACULTY_CROSS_SCHOOL_DENIED',
      message: 'This faculty record belongs to another school.',
    };
  }
  if (resolution.faculty.isActiveForScheduling !== true) {
    return {
      ok: false,
      code: 'FACULTY_IDENTITY_INACTIVE',
      message: 'This faculty record is inactive for scheduling. Contact your scheduling officer.',
    };
  }
  if (resolution.faculty.isStale !== false) {
    return {
      ok: false,
      code: 'FACULTY_IDENTITY_STALE',
      message: 'This faculty record is stale. Contact your scheduling officer.',
    };
  }
  return { ok: true };
}

type ResolvedAuthAccount = {
  id: number;
  schoolId: number;
  role: string;
  email: string;
  employeeId: string | null;
  accountName: string | null;
  passwordHash: string;
  isActive: boolean;
  lockedUntil: Date | null;
  failedLoginCount: number;
  mustChangePassword: boolean;
  facultyId: number | null;
  faculty: { id: number; externalId: number; employeeId: string | null; contactInfo: string | null } | null;
};

/**
 * Resolve an auth account by direct identity (email/employeeId/accountName)
 * or, when the auth duplicate is null, through its already linked canonical
 * mirror's authoritative employeeId. Read-only. Returns null when the
 * identifier is unknown, ambiguous, cross-school, inactive, or stale.
 */
export async function resolveAuthAccountByIdentifier(identifier: string): Promise<ResolvedAuthAccount | null> {
  const direct = await prisma.atlasAuthAccount.findFirst({
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
  if (direct) return direct as ResolvedAuthAccount;

  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const mirrors = await prisma.facultyMirror.findMany({
    where: { employeeId: trimmed },
    select: { id: true, schoolId: true, employeeId: true, isActiveForScheduling: true, isStale: true },
  });
  const selected = selectSingleEligibleMirror(mirrors);
  if (!selected) return null;
  const linked = await prisma.atlasAuthAccount.findFirst({
    where: { facultyId: selected.id, schoolId: selected.schoolId, isActive: true },
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
  return (linked as ResolvedAuthAccount | null) ?? null;
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
	if (!isRateLimitDisabled() && memoryRetryAfter > 0) {
		return {
			ok: false,
			status: 429,
			code: 'AUTH_RATE_LIMITED',
			message: 'Too many login attempts. Please try again later.',
			retryAfterSeconds: memoryRetryAfter,
		};
	}

	// Find local account by email, accountName, or employeeId — falling back to
	// the already linked canonical mirror when the auth duplicate is null.
	const account = await resolveAuthAccountByIdentifier(identifier);

	// No local ATLAS account — try EnrollPro delegation first before rejecting
	if (!account) {
		const enrollProResult = await tryEnrollProVerify(identifier, params.password);
		if (enrollProResult) {
			const resolvedRole = resolveEnrollProRole(enrollProResult.user);
			if (!resolvedRole) {
				return {
					ok: false,
					status: 403,
					code: 'AUTH_INVALID_ROLE',
					message: 'Your EnrollPro account does not have a recognized role for ATLAS access.',
				};
			}

			const resolvedSchool = await prisma.school.findFirst({ select: { id: true } });
			if (!resolvedSchool) {
				return {
					ok: false,
					status: 503,
					code: 'AUTH_SCHOOL_NOT_READY',
					message: 'No school has been bootstrapped yet. Contact an administrator to initialize the system.',
				};
			}

			const { account: provisioned } = await provisionFromEnrollPro({
				enrollProUser: enrollProResult.user,
				password: params.password,
				schoolId: resolvedSchool.id,
				resolvedRole,
			});

			// F-06-03 fail-closed: a newly provisioned faculty account receives
			// a token only for exactly one school-scoped active non-stale
			// canonical mirror. No token, no success audit on rejection.
			if (provisioned.role === 'faculty') {
				const provisionedCanonical = await resolveCanonicalFacultyMirror({
					schoolId: provisioned.schoolId,
					accountId: provisioned.id,
					linkedFacultyId: provisioned.facultyId,
					tokenUserId: provisioned.facultyExternalId,
					email: provisioned.email,
					employeeId: provisioned.employeeId,
					accountName: provisioned.accountName,
				});
				const provisionedEligibility = classifyFacultyLoginEligibility(provisionedCanonical, provisioned.schoolId);
				if (!provisionedEligibility.ok) {
					return {
						ok: false,
						status: 403,
						code: provisionedEligibility.code,
						message: provisionedEligibility.message,
					};
				}
			}
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

	if (!isRateLimitDisabled() && account.lockedUntil && account.lockedUntil.getTime() > now) {
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
			const resolvedRole = resolveEnrollProRole(enrollProResult.user);
			if (!resolvedRole) {
				registerMemoryFailure(identifier, params.ipAddress, now);
				return {
					ok: false,
					status: 403,
					code: 'AUTH_INVALID_ROLE',
					message: 'Your EnrollPro account does not have a recognized role for ATLAS access.',
				};
			}
			const { account: provisioned } = await provisionFromEnrollPro({
				enrollProUser: enrollProResult.user,
				password: params.password,
				schoolId: account.schoolId,
				resolvedRole,
			});
			// F-06-03 fail-closed: delegation success for faculty still requires
			// exactly one school-scoped active non-stale canonical mirror.
			if (provisioned.role === 'faculty') {
				const delegatedCanonical = await resolveCanonicalFacultyMirror({
					schoolId: provisioned.schoolId,
					accountId: provisioned.id,
					linkedFacultyId: provisioned.facultyId,
					tokenUserId: provisioned.facultyExternalId,
					email: provisioned.email,
					employeeId: provisioned.employeeId,
					accountName: provisioned.accountName,
				});
				const delegatedEligibility = classifyFacultyLoginEligibility(delegatedCanonical, provisioned.schoolId);
				if (!delegatedEligibility.ok) {
					return {
						ok: false,
						status: 403,
						code: delegatedEligibility.code,
						message: delegatedEligibility.message,
					};
				}
			}
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

	let canonicalFaculty = account.role === 'faculty'
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

	if (account.role === 'faculty' && !canonicalFaculty) {
		const hydratedMirror = await hydrateFacultyMirrorFromEnrollProFeed({
			schoolId: account.schoolId,
			employeeId: account.employeeId,
			email: account.email,
		});
		if (hydratedMirror) {
			canonicalFaculty = await resolveCanonicalFacultyMirror({
				schoolId: account.schoolId,
				accountId: account.id,
				linkedFacultyId: hydratedMirror.id,
				tokenUserId: hydratedMirror.externalId,
				email: account.email,
				employeeId: account.employeeId,
				accountName: account.accountName,
			});
		}

		const enrollProResult = canonicalFaculty ? null : await tryEnrollProVerify(identifier, params.password);
		if (!canonicalFaculty && enrollProResult) {
			const resolvedRole = resolveEnrollProRole(enrollProResult.user);
			if (!resolvedRole) {
				registerMemoryFailure(identifier, params.ipAddress, now);
				return {
					ok: false,
					status: 403,
					code: 'AUTH_INVALID_ROLE',
					message: 'Your EnrollPro account does not have a recognized role for ATLAS access.',
				};
			}
			const { account: reprovisioned } = await provisionFromEnrollPro({
				enrollProUser: enrollProResult.user,
				password: params.password,
				schoolId: account.schoolId,
				resolvedRole,
			});
			canonicalFaculty = await resolveCanonicalFacultyMirror({
				schoolId: reprovisioned.schoolId,
				accountId: reprovisioned.id,
				linkedFacultyId: reprovisioned.facultyId,
				tokenUserId: reprovisioned.facultyExternalId,
				email: reprovisioned.email,
				employeeId: reprovisioned.employeeId,
				accountName: reprovisioned.accountName,
			});
		}
	}
	if (account.role === 'faculty') {
		// F-06-03 fail-closed: a directly matched faculty account (email,
		// employee ID, or account name) must not bypass canonical mirror
		// eligibility. A token is issued only for exactly one school-scoped
		// active non-stale mirror. Rejection issues no token and performs no
		// success side effects (no lastLoginAt, no lock-counter reset, no
		// success audit). Officer/admin behavior is unchanged.
		if (account.facultyId !== null && account.facultyId !== undefined) {
			const linkedMirrorSchool = await prisma.facultyMirror.findUnique({
				where: { id: account.facultyId },
				select: { schoolId: true },
			});
			if (linkedMirrorSchool && linkedMirrorSchool.schoolId !== account.schoolId) {
				return {
					ok: false,
					status: 403,
					code: 'FACULTY_CROSS_SCHOOL_DENIED',
					message: 'This faculty record belongs to another school.',
				};
			}
		}
		const eligibility = classifyFacultyLoginEligibility(canonicalFaculty, account.schoolId);
		if (!eligibility.ok) {
			return {
				ok: false,
				status: 403,
				code: eligibility.code,
				message: eligibility.message,
			};
		}
	}
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
	if (!isValidEmail(params.email)) {
		return {
			ok: false,
			status: 400,
			code: 'INVALID_EMAIL',
			message: 'Invalid email address format.',
		};
	}
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
			employeeId: true,
		},
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
	});

	const accounts = [
		{
			email: process.env.ATLAS_SEEDED_OFFICER_EMAIL ?? 'officer@deped.edu.ph',
			role: 'officer',
			facultyId: null,
			employeeId: null,
			accountName: null,
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

		// School-scoped idempotency: an email owned by another school is never
		// stolen or rewritten here (cross-school guard).
		const existing = await prisma.atlasAuthAccount.findFirst({
			where: { email: account.email, schoolId: params.schoolId },
		});
		if (!existing) {
			const foreignOwner = await prisma.atlasAuthAccount.findFirst({
				where: { email: account.email },
				select: { id: true, schoolId: true },
			});
			if (foreignOwner) continue;
		}
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
				// Preserve authoritative identity: fill a null employeeId or
				// accountName from the source-supplied seed value, never wipe
				// an existing non-null operator/source value, and never
				// fabricate one when the source did not supply it.
				...(!existing.employeeId && account.employeeId ? { employeeId: account.employeeId } : {}),
				...(!existing.accountName && account.accountName ? { accountName: account.accountName } : {}),
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
				...(account.employeeId ? { employeeId: account.employeeId } : {}),
				...(account.accountName ? { accountName: account.accountName } : {}),
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
	employeeId?: string | null;
	accountName?: string | null;
};

export type FacultySeedAccount = {
	email: string;
	role: 'faculty';
	facultyId: number;
	employeeId: string | null;
	accountName: string | null;
	mustChangePassword: true;
};

/**
 * Normalize a source-supplied account name: trim a genuinely supplied value,
 * otherwise null. Never derive an account name from an email, employee ID,
 * or person's name — absent stays absent.
 */
function normalizeSeedAccountName(value: string | null | undefined): string | null {
	const trimmed = value?.trim() ?? '';
	return trimmed ? trimmed : null;
}

function tryNormalizeEmail(value: string | null | undefined): string | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	return isValidEmail(normalized) ? normalized : null;
}

export function buildFacultySeedAccounts(facultyRows: FacultySeedIdentity[]): FacultySeedAccount[] {
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

	const result: FacultySeedAccount[] = [];

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
				employeeId: row.employeeId?.trim() || null,
				accountName: normalizeSeedAccountName(row.accountName),
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
					employeeId: row.employeeId?.trim() || null,
					accountName: normalizeSeedAccountName(row.accountName),
					mustChangePassword: true,
				});
				continue;
			}

			usedEmails.add(email);
			result.push({
				email,
				role: 'faculty',
				facultyId: unresolvedRows[0].id,
				employeeId: unresolvedRows[0].employeeId?.trim() || null,
				accountName: normalizeSeedAccountName(unresolvedRows[0].accountName),
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
				employeeId: row.employeeId?.trim() || null,
				accountName: normalizeSeedAccountName(row.accountName),
				mustChangePassword: true,
			});
		}
	}

	return result;
}
