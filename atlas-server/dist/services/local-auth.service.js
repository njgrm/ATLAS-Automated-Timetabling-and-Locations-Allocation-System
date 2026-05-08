import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';
const MAX_FAILED_ATTEMPTS = Number(process.env.ATLAS_AUTH_MAX_FAILED_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.ATLAS_AUTH_LOCKOUT_MINUTES ?? 15);
const MEMORY_WINDOW_MS = Number(process.env.ATLAS_AUTH_MEMORY_WINDOW_MS ?? 10 * 60 * 1000);
const memoryRateLimit = new Map();
function normalizeEmail(value) {
    return value.trim().toLowerCase();
}
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function rateLimitKey(email, ip) {
    return `${ip}::${email}`;
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
function registerMemoryFailure(email, ip, now) {
    const key = rateLimitKey(email, ip);
    const entry = getOrCreateMemoryEntry(key, now);
    entry.count += 1;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
        entry.lockedUntil = now + LOCKOUT_MINUTES * 60_000;
        entry.count = 0;
        entry.windowStart = now;
    }
    memoryRateLimit.set(key, entry);
}
function getMemoryLockRemainingSeconds(email, ip, now) {
    const key = rateLimitKey(email, ip);
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
export async function loginWithEmailPassword(params) {
    const email = normalizeEmail(params.email);
    const now = Date.now();
    if (!isValidEmail(email)) {
        return {
            ok: false,
            status: 400,
            code: 'INVALID_EMAIL',
            message: 'A valid email address is required.',
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
    const memoryRetryAfter = getMemoryLockRemainingSeconds(email, params.ipAddress, now);
    if (memoryRetryAfter > 0) {
        return {
            ok: false,
            status: 429,
            code: 'AUTH_RATE_LIMITED',
            message: 'Too many login attempts. Please try again later.',
            retryAfterSeconds: memoryRetryAfter,
        };
    }
    const account = await prisma.atlasAuthAccount.findUnique({
        where: { email },
        include: {
            faculty: {
                select: {
                    externalId: true,
                },
            },
        },
    });
    if (!account || !account.isActive) {
        registerMemoryFailure(email, params.ipAddress, now);
        return {
            ok: false,
            status: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
        };
    }
    if (account.lockedUntil && account.lockedUntil.getTime() > now) {
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
        registerMemoryFailure(email, params.ipAddress, now);
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
                email,
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
            message: 'Invalid email or password.',
        };
    }
    const userId = account.role === 'faculty' && account.faculty?.externalId
        ? account.faculty.externalId
        : account.id;
    const user = {
        userId,
        role: account.role,
        mustChangePassword: account.mustChangePassword,
        authSource: 'local',
        schoolId: account.schoolId,
        accountId: account.id,
        email: account.email,
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
            email,
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