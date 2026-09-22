import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type InboxCursor = { createdAt: string; id: number };

/**
 * NOTIFICATION-INBOX-C01 (D2) — actor-scoped persisted inbox.
 *
 * Authority: the actor and the actor school resolve ONLY from the
 * authenticated token. `actorId`/`schoolId` are never accepted from the body
 * or the query string. Every read and every write is constrained by
 * `actorId = <resolved account id>`, so another actor's or another school's row is
 * never readable and never mutable. Unresolvable actor/school fails closed
 * with a typed 403 and writes nothing.
 *
 * The inbox actor id is `AtlasAuthAccount.id` (`req.user.accountId`) — never
 * the session's `userId`. A faculty-shaped session carries the FacultyMirror
 * `externalId` in `userId`, so resolving `userId` would read/mutate the wrong
 * actor's rows on a numeric collision.
 */
function resolveActorId(req: Request): number | null {
	const raw = req.user?.accountId;
	const actorId = Number(raw);
	return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

function resolveActorSchoolId(req: Request): number | null {
	const schoolId = Number(req.user?.schoolId);
	return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

function requireInboxActor(req: Request, res: Response): { actorId: number; schoolId: number } | null {
	const actorId = resolveActorId(req);
	const schoolId = resolveActorSchoolId(req);
	if (actorId == null || schoolId == null) {
		res.status(403).json({
			code: 'NOTIFICATION_ACTOR_UNRESOLVED',
			message: 'The authenticated session is missing a usable account or school; no notifications were read or written.',
		});
		return null;
	}
	return { actorId, schoolId };
}

function parseLimit(raw: unknown): number | string {
	if (raw == null) return DEFAULT_LIMIT;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
		return `limit must be an integer between 1 and ${MAX_LIMIT}.`;
	}
	return n;
}

function parseCursor(raw: unknown): InboxCursor | null | string {
	if (raw == null || raw === '') return null;
	if (typeof raw !== 'string') return 'cursor must be an opaque string issued by this endpoint.';
	try {
		const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<InboxCursor>;
		if (typeof decoded.createdAt !== 'string' || !Number.isInteger(decoded.id) || (decoded.id as number) < 1) {
			return 'cursor must be an opaque string issued by this endpoint.';
		}
		const createdAt = new Date(decoded.createdAt);
		if (Number.isNaN(createdAt.getTime())) return 'cursor must be an opaque string issued by this endpoint.';
		return { createdAt: createdAt.toISOString(), id: decoded.id as number };
	} catch {
		return 'cursor must be an opaque string issued by this endpoint.';
	}
}

function encodeCursor(createdAt: Date, id: number): string {
	return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), 'utf8').toString('base64url');
}

/** GET / — newest first, keyset on (createdAt, id). */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actor = requireInboxActor(req, res);
		if (!actor) return;
		const limit = parseLimit(req.query.limit);
		if (typeof limit === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: limit });
			return;
		}
		const cursor = parseCursor(req.query.cursor);
		if (typeof cursor === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: cursor });
			return;
		}
		const items = await prisma.notification.findMany({
			where: {
				actorId: actor.actorId,
				...(cursor
					? {
							OR: [
								{ createdAt: { lt: new Date(cursor.createdAt) } },
								{ createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
							],
						}
					: {}),
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: limit + 1,
		});
		const page = items.slice(0, limit);
		const last = page[page.length - 1];
		res.json({
			items: page,
			nextCursor: items.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
		});
	} catch (error) {
		next(error);
	}
});

/** GET /unread-count */
router.get('/unread-count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actor = requireInboxActor(req, res);
		if (!actor) return;
		const count = await prisma.notification.count({
			where: { actorId: actor.actorId, read: false },
		});
		res.json({ count });
	} catch (error) {
		next(error);
	}
});

/** POST /read-all — marks the actor's own rows read. */
router.post('/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actor = requireInboxActor(req, res);
		if (!actor) return;
		const result = await prisma.notification.updateMany({
			where: { actorId: actor.actorId, read: false },
			data: { read: true },
		});
		res.json({ marked: result.count });
	} catch (error) {
		next(error);
	}
});

/** POST /:id/read — idempotent; 404 when the id is not the actor's. */
router.post('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actor = requireInboxActor(req, res);
		if (!actor) return;
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id < 1) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a positive integer.' });
			return;
		}
		const result = await prisma.notification.updateMany({
			where: { id, actorId: actor.actorId },
			data: { read: true },
		});
		if (result.count === 0) {
			res.status(404).json({
				code: 'NOTIFICATION_NOT_FOUND',
				message: 'No notification with that id belongs to the authenticated actor.',
			});
			return;
		}
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

export default router;
