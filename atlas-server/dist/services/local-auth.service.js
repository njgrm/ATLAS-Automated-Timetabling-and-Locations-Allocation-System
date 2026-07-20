import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { resolveCanonicalFacultyMirror } from './faculty-identity.service.js';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';
const MAX_FAILED_ATTEMPTS = Number(process.env.ATLAS_AUTH_MAX_FAILED_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.ATLAS_AUTH_LOCKOUT_MINUTES ?? 15);
const MEMORY_WINDOW_MS = Number(process.env.ATLAS_AUTH_MEMORY_WINDOW_MS ?? 10 * 60 * 1000);
// Set ATLAS_AUTH_DISABLE_RATE_LIMIT=true in .env to bypass all login rate limiting.
// Remove or set to false to re-enable enforcement.
const isRateLimitDisabled = () => process.env.ATLAS_AUTH_DISABLE_RATE_LIMIT === 'true';
const memoryRateLimit = new Map();
function normalizeIdentifier(value) {
    return value.trim().toLowerCase();
}
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function rateLimitKey(identifier, ip) {
    return `${ip}::${identifier}`;
}
function getOrCreateMemoryEntry(key, now) {
    const current = memoryRateLimit.get(key);
    if (!current || now - current.windowStart > MEMORY_WINDOW_MS) {
        const fresh = { count: 0, windowStart: now, lockedUntil: null };
        memoryRateLimit.set(key, fresh);
        return fresh;
    }
    return current;
}
function registerMemoryFailure(identifier, ip, now) {
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
function getMemoryLockRemainingSeconds(identifier, ip, now) {
    const key = rateLimitKey(identifier, ip);
    const entry = getOrCreateMemoryEntry(key, now);
    if (!entry.lockedUntil || entry.lockedUntil <= now) {
        entry.lockedUntil = null;
        memoryRateLimit.set(key, entry);
        return 0;
    }
    return Math.ceil((entry.lockedUntil - now) / 1000);
}
function createToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        return null;
    return jwt.sign(user, secret, { expiresIn: JWT_EXPIRES_IN });
}
async function writeAuditLog(params) {
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
function mapEnrollProRole(role) {
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
async function tryEnrollProVerify(accountName, password) {
    const enrollProApi = (process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/$/, '');
    try {
        const resp = await fetch(`${enrollProApi}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountName, password }),
            signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok)
            return null;
        const data = await resp.json();
        if (!data?.valid || !data.user)
            return null;
        return { valid: true, user: data.user };
    }
    catch {
        return null;
    }
}
function getEnrollProFacultyExternalId(user) {
    const candidate = user.externalTeacherId ?? user.facultyExternalId ?? user.teacherId ?? null;
    return typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}
function normalizedIdentity(value) {
    return (value ?? '').trim().toLowerCase();
}
export function selectExactEnrollProFacultyMatch(rows, identity) {
    const uniqueRows = [...new Map(rows
            .filter((row) => Number.isInteger(row.teacherId) && row.teacherId > 0 && row.isActive !== false)
            .map((row) => [row.teacherId, row])).values()];
    const employeeId = normalizedIdentity(identity.employeeId);
    if (employeeId) {
        const employeeMatches = uniqueRows.filter((row) => normalizedIdentity(row.employeeId) === employeeId);
        if (employeeMatches.length === 1)
            return employeeMatches[0];
        if (employeeMatches.length > 1)
            return null;
    }
    const email = normalizedIdentity(identity.email);
    if (!email)
        return null;
    const emailMatches = uniqueRows.filter((row) => normalizedIdentity(row.email) === email);
    return emailMatches.length === 1 ? emailMatches[0] : null;
}
async function hydrateFacultyMirrorFromEnrollProFeed(params) {
    const enrollProApi = (process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/$/, '');
    const rows = [];
    const cachedSnapshot = await prisma.facultySnapshot.findFirst({
        where: { schoolId: params.schoolId },
        orderBy: { fetchedAt: 'desc' },
        select: { payload: true },
    });
    if (Array.isArray(cachedSnapshot?.payload)) {
        for (const raw of cachedSnapshot.payload) {
            const teacherId = Number(raw.id ?? raw.teacherId ?? 0);
            if (!Number.isInteger(teacherId) || teacherId < 1)
                continue;
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
        if (match)
            totalPages = 0;
        while (page <= totalPages) {
            const response = await fetch(`${enrollProApi}/integration/v1/faculty?page=${page}&limit=${pageSize}`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok)
                return null;
            const payload = await response.json();
            rows.push(...(Array.isArray(payload.data) ? payload.data : []));
            const reportedTotalPages = Number(payload.meta?.totalPages ?? 1);
            totalPages = Number.isInteger(reportedTotalPages) && reportedTotalPages > 0 ? reportedTotalPages : 1;
            page += 1;
        }
    }
    catch {
        if (!match)
            return null;
    }
    match ??= selectExactEnrollProFacultyMatch(rows, params);
    if (!match)
        return null;
    const firstName = match.firstName?.trim();
    const lastName = match.lastName?.trim();
    if (!firstName || !lastName)
        return null;
    const mirror = await prisma.facultyMirror.upsert({
        where: { schoolId_externalId: { schoolId: params.schoolId, externalId: match.teacherId } },
        update: {
            employeeId: match.employeeId?.trim() || params.employeeId,
            firstName,
            lastName,
            contactInfo: match.email?.trim().toLowerCase() || match.contactNumber?.trim() || params.email,
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
            employeeId: match.employeeId?.trim() || params.employeeId,
            firstName,
            lastName,
            contactInfo: match.email?.trim().toLowerCase() || match.contactNumber?.trim() || params.email,
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
async function findLinkedFacultyMirror(params) {
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
    if (resolution)
        return { id: resolution.faculty.id, externalId: resolution.faculty.externalId };
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
async function provisionFromEnrollPro(params) {
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
            ].filter(x => Object.keys(x).length > 0)
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
export async function login(params) {
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
            const user = {
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
            const { account: provisioned } = await provisionFromEnrollPro({
                enrollProUser: enrollProResult.user,
                password: params.password,
                schoolId: account.schoolId,
            });
            const linkedFacultyMirrorExternalId = provisioned.facultyExternalId ?? account.faculty?.externalId ?? null;
            const userId = provisioned.role === 'faculty' && linkedFacultyMirrorExternalId
                ? linkedFacultyMirrorExternalId
                : provisioned.id;
            const user = {
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
            const { account: reprovisioned } = await provisionFromEnrollPro({
                enrollProUser: enrollProResult.user,
                password: params.password,
                schoolId: account.schoolId,
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
    const userId = account.role === 'faculty' && canonicalFaculty
        ? canonicalFaculty.faculty.externalId
        : account.id;
    const facultyId = account.role === 'faculty'
        ? canonicalFaculty?.faculty.id ?? account.facultyId ?? null
        : null;
    const user = {
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
export async function loginWithEmailPassword(params) {
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
export async function seedLocalAuthAccounts(params) {
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
function normalizeNameToken(value) {
    const cleaned = value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned)
        return 'user';
    return cleaned.replace(/\s+/g, '-');
}
function extractPrimaryNamePart(value) {
    const normalized = normalizeNameToken(value);
    const parts = normalized.split(/[\s-]+/).filter(Boolean);
    return parts[0] ?? 'user';
}
function deriveMiddleInitial(firstName, externalId, offset = 0) {
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
function tryNormalizeEmail(value) {
    if (!value)
        return null;
    const normalized = value.trim().toLowerCase();
    return isValidEmail(normalized) ? normalized : null;
}
export function buildFacultySeedAccounts(facultyRows) {
    const usedEmails = new Set();
    const byBase = new Map();
    for (const row of facultyRows) {
        const first = extractPrimaryNamePart(row.firstName);
        const last = extractPrimaryNamePart(row.lastName);
        const base = `${first}.${last}`;
        const group = byBase.get(base) ?? [];
        group.push(row);
        byBase.set(base, group);
    }
    const result = [];
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
//# sourceMappingURL=local-auth.service.js.map