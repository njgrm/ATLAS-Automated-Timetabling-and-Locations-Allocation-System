import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import jwt from 'jsonwebtoken';
import * as prefService from '../services/preference.service.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import { subscribePreferenceEvents, getPreferenceEventsSince } from '../services/preference-events.service.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
// ─── Helpers ───
/** Verify the authenticated user owns the faculty record or is an officer/admin. */
async function assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId, schoolYearId) {
    const role = req.user?.role;
    if (role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN')
        return true;
    const identity = await resolveCanonicalFacultyFromAuthPayload(req.user, { schoolId, schoolYearId });
    if (!identity) {
        res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
        return false;
    }
    if (identity.faculty.id !== facultyId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission to access this teacher preference.' });
        return false;
    }
    return true;
}
function positiveInt(value, name) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0)
        return `${name} must be a positive integer.`;
    return n;
}
const VALID_DAYS = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
const VALID_PREFS = new Set(['PREFERRED', 'AVAILABLE', 'UNAVAILABLE']);
const VALID_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'MISSING']);
function validateTimeSlots(slots) {
    if (slots == null)
        return [];
    if (!Array.isArray(slots))
        return 'timeSlots must be an array.';
    for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s || typeof s !== 'object')
            return `timeSlots[${i}] is invalid.`;
        if (!VALID_DAYS.has(s.day))
            return `timeSlots[${i}].day must be one of ${[...VALID_DAYS].join(', ')}.`;
        if (typeof s.startTime !== 'string' || !/^\d{2}:\d{2}$/.test(s.startTime))
            return `timeSlots[${i}].startTime must be HH:MM format.`;
        if (typeof s.endTime !== 'string' || !/^\d{2}:\d{2}$/.test(s.endTime))
            return `timeSlots[${i}].endTime must be HH:MM format.`;
        if (s.startTime >= s.endTime)
            return `timeSlots[${i}].startTime must be before endTime.`;
        if (s.preference && !VALID_PREFS.has(s.preference))
            return `timeSlots[${i}].preference must be one of ${[...VALID_PREFS].join(', ')}.`;
    }
    return slots.map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        preference: (s.preference ?? 'AVAILABLE'),
    }));
}
// v1 phase constant — will become dynamic per school+year in future
const CURRENT_PHASE = process.env.ATLAS_LIFECYCLE_PHASE ?? 'SETUP';
// ─── Faculty self: GET preference ───
router.get('/:schoolId/:schoolYearId/faculty/:facultyId', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        // Auth guard: faculty can only access own preference
        const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId, schoolYearId);
        if (!allowed)
            return;
        const pref = await prefService.getPreference(schoolId, schoolYearId, facultyId);
        res.json({ preference: pref });
    }
    catch (e) {
        next(e);
    }
});
// ─── Officer: get audit summary (teacher support requests) ───
router.get('/:schoolId/:schoolYearId/audit', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const faculty = await prisma.facultyMirror.findMany({
            where: { schoolId, isActiveForScheduling: true },
            select: { id: true, firstName: true, lastName: true, specialization: true, department: true }
        });
        const preferences = await prisma.facultyPreference.findMany({
            where: { schoolId, schoolYearId },
            select: {
                facultyId: true,
                status: true,
                pregnancySupport: true,
                physicalAilmentSupport: true,
                minimizeTravelTime: true,
                avoidUpperFloors: true,
                notes: true,
            }
        });
        const prefMap = new Map(preferences.map(p => [p.facultyId, p]));
        const audit = faculty.map(f => {
            const pref = prefMap.get(f.id);
            if (!pref)
                return { facultyId: f.id, supportRequestCount: 0, hasNotes: false, status: 'MISSING' };
            const supportRequestCount = [
                pref.pregnancySupport,
                pref.physicalAilmentSupport,
                pref.minimizeTravelTime,
                pref.avoidUpperFloors,
            ].filter(Boolean).length;
            return {
                facultyId: f.id,
                name: `${f.lastName}, ${f.firstName}`,
                specialization: f.specialization,
                department: f.department,
                supportRequestCount,
                hasNotes: Boolean(pref.notes?.trim()),
                respectMode: supportRequestCount > 0 ? 'SCHEDULER_REVIEWED_MANUAL_SUPPORT' : 'NONE_REQUESTED',
                status: pref.status
            };
        });
        res.json({ audit });
    }
    catch (e) {
        next(e);
    }
});
// ─── Faculty self: save draft ───
router.put('/:schoolId/:schoolYearId/faculty/:facultyId/draft', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        // Auth guard: faculty can only save own draft
        const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId, schoolYearId);
        if (!allowed)
            return;
        // Lifecycle guard
        const windowCheck = prefService.checkPreferenceWindow(CURRENT_PHASE);
        if (windowCheck) {
            res.status(windowCheck.statusCode).json({ code: windowCheck.code, message: windowCheck.message });
            return;
        }
        const slots = validateTimeSlots(req.body.timeSlots);
        if (typeof slots === 'string') {
            res.status(400).json({ code: 'INVALID_BODY', message: slots });
            return;
        }
        const result = await prefService.saveDraft({
            schoolId,
            schoolYearId,
            facultyId,
            notes: req.body.notes ?? null,
            timeSlots: slots,
            version: req.body.version,
            wellbeing: {
                pregnancySupport: req.body.wellbeing?.pregnancySupport ?? false,
                physicalAilmentSupport: req.body.wellbeing?.physicalAilmentSupport ?? false,
                minimizeTravelTime: req.body.wellbeing?.minimizeTravelTime ?? false,
                avoidUpperFloors: req.body.wellbeing?.avoidUpperFloors ?? false,
            },
        });
        res.json({ preference: result });
    }
    catch (e) {
        next(e);
    }
});
// ─── Faculty self: submit ───
router.post('/:schoolId/:schoolYearId/faculty/:facultyId/submit', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        // Auth guard: faculty can only submit own preference
        const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId, schoolYearId);
        if (!allowed)
            return;
        // Lifecycle guard
        const windowCheck = prefService.checkPreferenceWindow(CURRENT_PHASE);
        if (windowCheck) {
            res.status(windowCheck.statusCode).json({ code: windowCheck.code, message: windowCheck.message });
            return;
        }
        const slots = validateTimeSlots(req.body.timeSlots);
        if (typeof slots === 'string') {
            res.status(400).json({ code: 'INVALID_BODY', message: slots });
            return;
        }
        const version = Number(req.body.version);
        if (!Number.isInteger(version) || version < 1) {
            res.status(400).json({ code: 'INVALID_BODY', message: 'version is required and must be a positive integer.' });
            return;
        }
        const result = await prefService.submitPreference({
            schoolId,
            schoolYearId,
            facultyId,
            notes: req.body.notes ?? null,
            timeSlots: slots,
            version,
            wellbeing: {
                pregnancySupport: req.body.wellbeing?.pregnancySupport ?? false,
                physicalAilmentSupport: req.body.wellbeing?.physicalAilmentSupport ?? false,
                minimizeTravelTime: req.body.wellbeing?.minimizeTravelTime ?? false,
                avoidUpperFloors: req.body.wellbeing?.avoidUpperFloors ?? false,
            },
        });
        res.json({ preference: result });
    }
    catch (e) {
        next(e);
    }
});
// ─── Officer: summary (submitted / draft / missing, with review metadata) ───
router.get('/:schoolId/:schoolYearId/summary', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const statusParam = req.query.status;
        let statusFilter;
        if (statusParam) {
            const upper = statusParam.toUpperCase();
            if (!VALID_STATUSES.has(upper)) {
                res.status(400).json({ code: 'INVALID_PARAM', message: `status must be one of ${[...VALID_STATUSES].join(', ')}.` });
                return;
            }
            statusFilter = upper;
        }
        // Optional auto-seed: if ?autoSeed=true and no preferences exist yet, seed defaults
        if (req.query.autoSeed === 'true') {
            const actorId = req.user?.userId;
            const role = req.user?.role;
            if (actorId && (role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN')) {
                const preview = await prefService.getOfficerSummary(schoolId, schoolYearId);
                if (preview.counts.submitted === 0 && preview.counts.draft === 0) {
                    await prefService.seedPreferencesForSchoolYear(schoolId, schoolYearId, actorId);
                }
            }
        }
        const result = await prefService.getOfficerSummaryWithReviews(schoolId, schoolYearId, statusFilter);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
});
// ─── Officer: seed preferences (idempotent) ───
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
router.post('/:schoolId/:schoolYearId/seed', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can seed preferences.' });
            return;
        }
        const actorId = req.user?.userId;
        if (!actorId) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const result = await prefService.seedPreferencesForSchoolYear(schoolId, schoolYearId, actorId);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
});
// ─── Officer: trigger reminder ───
router.post('/:schoolId/:schoolYearId/remind', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const facultyIds = req.body.facultyIds;
        if (!Array.isArray(facultyIds) || facultyIds.length === 0 || !facultyIds.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
            res.status(400).json({ code: 'INVALID_BODY', message: 'facultyIds must be a non-empty array of positive integers.' });
            return;
        }
        const triggeredBy = req.user?.userId;
        if (!triggeredBy) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const result = await prefService.triggerReminder(schoolId, schoolYearId, facultyIds.map(Number), triggeredBy);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
});
// ─── Officer: get single teacher preference detail (for review) ───
router.get('/:schoolId/:schoolYearId/faculty/:facultyId/detail', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view preference details.' });
            return;
        }
        const detail = await prefService.getPreferenceDetail(schoolId, schoolYearId, facultyId);
        res.json({ preference: detail });
    }
    catch (e) {
        next(e);
    }
});
// ─── Officer: update review metadata ───
const VALID_REVIEW_STATUSES = new Set(['REVIEWED', 'NEEDS_FOLLOW_UP']);
router.patch('/:schoolId/:schoolYearId/review/:preferenceId', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can review preferences.' });
            return;
        }
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const preferenceId = positiveInt(req.params.preferenceId, 'preferenceId');
        if (typeof preferenceId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: preferenceId });
            return;
        }
        const reviewerId = req.user?.userId;
        if (!reviewerId) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const { reviewStatus, reviewerNotes } = req.body;
        if (!reviewStatus || !VALID_REVIEW_STATUSES.has(reviewStatus)) {
            res.status(400).json({ code: 'INVALID_BODY', message: `reviewStatus must be one of ${[...VALID_REVIEW_STATUSES].join(', ')}.` });
            return;
        }
        const review = await prefService.updateReview({
            schoolId,
            schoolYearId,
            preferenceId,
            reviewerId,
            reviewStatus,
            reviewerNotes: reviewerNotes ?? null,
        });
        res.json({ review });
    }
    catch (e) {
        next(e);
    }
});
// ─── SSE: bilateral preference events ───
// Faculty clients subscribe scoped to their own facultyId.
// Officer clients subscribe with facultyId=null to see all events.
// Accepts accessToken query param for EventSource compatibility.
router.get('/:schoolId/:schoolYearId/events', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        // Auth: accept token from cookie or query param (EventSource compat)
        let token = req.cookies?.atlasAuthToken ?? req.query.accessToken;
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer '))
                token = authHeader.slice(7);
        }
        if (!token) {
            res.status(401).json({ code: 'NO_TOKEN', message: 'Authentication required.' });
            return;
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            res.status(500).json({ code: 'SERVER_ERROR', message: 'JWT secret not configured.' });
            return;
        }
        let decoded = null;
        try {
            decoded = jwt.verify(token, secret);
        }
        catch {
            res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' });
            return;
        }
        if (!decoded) {
            res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid token.' });
            return;
        }
        // Determine scope: teacher users get filtered to their own events.
        // Use the canonical resolver so identity matches all other faculty
        // routes (avoids SSE-only auth drift where a teacher's externalId
        // does not equal their token userId, which previously returned 403
        // and showed up as net::ERR_FAILED on the EventSource client).
        const isPrivileged = decoded.role === 'admin' || decoded.role === 'officer' || decoded.role === 'SYSTEM_ADMIN';
        let scopeFacultyId = null;
        if (!isPrivileged) {
            const identity = await resolveCanonicalFacultyFromAuthPayload({ ...decoded, authSource: decoded.authSource ?? 'local' }, { schoolId, schoolYearId });
            if (!identity) {
                res.status(403).json({
                    code: 'FORBIDDEN',
                    message: 'Teacher profile mapping is required to subscribe to preference updates.',
                });
                return;
            }
            scopeFacultyId = identity.faculty.id;
        }
        // Reconnect: replay missed events since Last-Event-ID
        const lastIdRaw = req.headers['last-event-id'];
        const lastId = lastIdRaw ? parseInt(lastIdRaw, 10) : 0;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const send = (event) => {
            res.write(`id: ${event.id}\nevent: preference\ndata: ${JSON.stringify(event)}\n\n`);
        };
        // Replay missed events
        if (lastId > 0) {
            const missed = getPreferenceEventsSince(lastId, { schoolId, schoolYearId, facultyId: scopeFacultyId });
            for (const ev of missed)
                send(ev);
        }
        const unsub = subscribePreferenceEvents({ schoolId, schoolYearId, facultyId: scopeFacultyId, send });
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
        req.on('close', () => { unsub(); clearInterval(heartbeat); });
    }
    catch (e) {
        next(e);
    }
});
// ─── Dev: bulk-submit seeded drafts (non-production QA helper) ───
router.post('/:schoolId/:schoolYearId/dev/submit-seeded', authenticate, async (req, res, next) => {
    try {
        if (!prefService.isDevToolsEnabled()) {
            res.status(403).json({ code: 'DEV_TOOLS_DISABLED', message: 'Dev preference tools are disabled in production.' });
            return;
        }
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can use dev tools.' });
            return;
        }
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
            return;
        }
        const actorId = req.user?.userId;
        if (!actorId) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const result = await prefService.devBulkSubmitSeeded(schoolId, schoolYearId, actorId);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=preference.router.js.map