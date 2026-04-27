import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/prisma.js';
import * as roomPreferenceService from '../services/room-preference.service.js';
const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
const VALID_ROOM_PREFERENCE_STATUSES = new Set(['DRAFT', 'SUBMITTED']);
const VALID_ROOM_PREFERENCE_DECISION_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const VALID_REVIEW_DECISIONS = new Set(['APPROVED', 'REJECTED']);
const VALID_APPEAL_STATUSES = new Set(['OPEN', 'UNDER_REVIEW', 'UPHELD', 'DENIED']);
function positiveInt(raw, name) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1)
        return `${name} must be a positive integer.`;
    return parsed;
}
async function assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId) {
    const role = req.user?.role;
    if (role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN')
        return true;
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
        return false;
    }
    const faculty = await prisma.facultyMirror.findFirst({
        where: { id: facultyId, schoolId, externalId: userId },
        select: { id: true },
    });
    if (!faculty) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission to access this faculty room preference.' });
        return false;
    }
    return true;
}
async function resolveRequestingFacultyId(req, schoolId) {
    const role = req.user?.role;
    if (role && PRIVILEGED_ROLES.has(role))
        return null;
    const userId = req.user?.userId;
    if (!userId)
        return null;
    const faculty = await prisma.facultyMirror.findFirst({
        where: { schoolId, externalId: userId },
        select: { id: true },
    });
    return faculty?.id ?? null;
}
function parseScope(req, res) {
    const schoolId = positiveInt(req.params.schoolId, 'schoolId');
    if (typeof schoolId === 'string') {
        res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
        return null;
    }
    const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
    if (typeof schoolYearId === 'string') {
        res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
        return null;
    }
    const runId = positiveInt(req.params.runId, 'runId');
    if (typeof runId === 'string') {
        res.status(400).json({ code: 'INVALID_PARAM', message: runId });
        return null;
    }
    return { schoolId, schoolYearId, runId };
}
async function assertRequestOwnerOrOfficer(req, res, scope, requestId) {
    const request = await prisma.facultyRoomPreference.findFirst({
        where: {
            id: requestId,
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            runId: scope.runId,
        },
        select: { id: true, facultyId: true },
    });
    if (!request) {
        res.status(404).json({ code: 'ROOM_PREFERENCE_NOT_FOUND', message: 'Room preference request was not found in this run scope.' });
        return null;
    }
    const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, request.facultyId);
    if (!allowed)
        return null;
    return request;
}
router.get('/:schoolId/:schoolYearId/latest/faculty/:facultyId', authenticate, async (req, res, next) => {
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
        const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId);
        if (!allowed)
            return;
        const result = await roomPreferenceService.getLatestFacultyRoomPreferenceState(schoolId, schoolYearId, facultyId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
        if (!allowed)
            return;
        const result = await roomPreferenceService.getFacultyRoomPreferenceState(scope.schoolId, scope.schoolYearId, scope.runId, facultyId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.put('/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/entries/:entryId/draft', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
        if (!allowed)
            return;
        const requestedRoomId = positiveInt(req.body.requestedRoomId, 'requestedRoomId');
        if (typeof requestedRoomId === 'string') {
            res.status(400).json({ code: 'INVALID_BODY', message: requestedRoomId });
            return;
        }
        const entryId = typeof req.params.entryId === 'string' ? req.params.entryId : undefined;
        if (!entryId) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'entryId is required.' });
            return;
        }
        const result = await roomPreferenceService.saveRoomPreferenceDraft({
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            runId: scope.runId,
            facultyId,
            entryId,
            requestedRoomId,
            rationale: req.body.rationale ?? null,
            expectedRunVersion: req.body.expectedRunVersion,
            requestVersion: req.body.requestVersion,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/entries/:entryId/submit', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
        if (!allowed)
            return;
        const requestedRoomId = positiveInt(req.body.requestedRoomId, 'requestedRoomId');
        if (typeof requestedRoomId === 'string') {
            res.status(400).json({ code: 'INVALID_BODY', message: requestedRoomId });
            return;
        }
        const entryId = typeof req.params.entryId === 'string' ? req.params.entryId : undefined;
        if (!entryId) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'entryId is required.' });
            return;
        }
        const result = await roomPreferenceService.submitRoomPreference({
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            runId: scope.runId,
            facultyId,
            entryId,
            requestedRoomId,
            rationale: req.body.rationale ?? null,
            expectedRunVersion: req.body.expectedRunVersion,
            requestVersion: req.body.requestVersion,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/entries/:entryId', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
        if (!allowed)
            return;
        const entryId = typeof req.params.entryId === 'string' ? req.params.entryId : undefined;
        if (!entryId) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'entryId is required.' });
            return;
        }
        const result = await roomPreferenceService.deleteRoomPreferenceDraft(scope.schoolId, scope.schoolYearId, scope.runId, facultyId, entryId, req.body?.requestVersion);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:schoolId/:schoolYearId/latest/summary', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
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
        const statusQuery = req.query.status;
        const decisionStatusQuery = req.query.decisionStatus;
        const requestedFacultyId = req.query.facultyId != null ? positiveInt(req.query.facultyId, 'facultyId') : undefined;
        const ownFacultyId = await resolveRequestingFacultyId(req, schoolId);
        if (!PRIVILEGED_ROLES.has(role) && ownFacultyId == null) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty profile mapping is required to view room requests.' });
            return;
        }
        const facultyId = ownFacultyId ?? requestedFacultyId;
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        if (ownFacultyId != null && requestedFacultyId != null && requestedFacultyId !== ownFacultyId) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty users can only view their own room requests.' });
            return;
        }
        const requestedRoomId = req.query.requestedRoomId != null ? positiveInt(req.query.requestedRoomId, 'requestedRoomId') : undefined;
        if (typeof requestedRoomId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestedRoomId });
            return;
        }
        if (statusQuery && !VALID_ROOM_PREFERENCE_STATUSES.has(statusQuery)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: `status must be one of ${[...VALID_ROOM_PREFERENCE_STATUSES].join(', ')}.` });
            return;
        }
        if (decisionStatusQuery && !VALID_ROOM_PREFERENCE_DECISION_STATUSES.has(decisionStatusQuery)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: `decisionStatus must be one of ${[...VALID_ROOM_PREFERENCE_DECISION_STATUSES].join(', ')}.` });
            return;
        }
        const result = await roomPreferenceService.getLatestRoomPreferenceSummary(schoolId, schoolYearId, {
            status: statusQuery,
            decisionStatus: decisionStatusQuery,
            facultyId: facultyId,
            requestedRoomId,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:schoolId/:schoolYearId/runs/:runId/summary', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const statusQuery = req.query.status;
        const decisionStatusQuery = req.query.decisionStatus;
        const requestedFacultyId = req.query.facultyId != null ? positiveInt(req.query.facultyId, 'facultyId') : undefined;
        const ownFacultyId = await resolveRequestingFacultyId(req, scope.schoolId);
        if (!PRIVILEGED_ROLES.has(role) && ownFacultyId == null) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty profile mapping is required to view room requests.' });
            return;
        }
        const facultyId = ownFacultyId ?? requestedFacultyId;
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        if (ownFacultyId != null && requestedFacultyId != null && requestedFacultyId !== ownFacultyId) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty users can only view their own room requests.' });
            return;
        }
        const requestedRoomId = req.query.requestedRoomId != null ? positiveInt(req.query.requestedRoomId, 'requestedRoomId') : undefined;
        if (typeof requestedRoomId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestedRoomId });
            return;
        }
        if (statusQuery && !VALID_ROOM_PREFERENCE_STATUSES.has(statusQuery)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: `status must be one of ${[...VALID_ROOM_PREFERENCE_STATUSES].join(', ')}.` });
            return;
        }
        if (decisionStatusQuery && !VALID_ROOM_PREFERENCE_DECISION_STATUSES.has(decisionStatusQuery)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: `decisionStatus must be one of ${[...VALID_ROOM_PREFERENCE_DECISION_STATUSES].join(', ')}.` });
            return;
        }
        const result = await roomPreferenceService.getRoomPreferenceSummary(scope.schoolId, scope.schoolYearId, scope.runId, {
            status: statusQuery,
            decisionStatus: decisionStatusQuery,
            facultyId: facultyId,
            requestedRoomId,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:schoolId/:schoolYearId/runs/:runId/requests/:requestId', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const requestId = positiveInt(req.params.requestId, 'requestId');
        if (typeof requestId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
            return;
        }
        const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
        if (!request)
            return;
        const result = await roomPreferenceService.getRoomPreferenceDetail(scope.schoolId, scope.schoolYearId, scope.runId, requestId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/preview', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const requestId = positiveInt(req.params.requestId, 'requestId');
        if (typeof requestId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
            return;
        }
        const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
        if (!request)
            return;
        const result = await roomPreferenceService.previewRoomPreferenceDecision(scope.schoolId, scope.schoolYearId, scope.runId, requestId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/review', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can review room preferences.' });
            return;
        }
        const reviewerId = req.user?.userId;
        if (!reviewerId) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const requestId = positiveInt(req.params.requestId, 'requestId');
        if (typeof requestId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
            return;
        }
        const { decisionStatus, reviewerNotes, expectedRunVersion, requestVersion, allowSoftOverride } = req.body ?? {};
        if (!decisionStatus || !VALID_REVIEW_DECISIONS.has(decisionStatus)) {
            res.status(400).json({ code: 'INVALID_BODY', message: `decisionStatus must be one of ${[...VALID_REVIEW_DECISIONS].join(', ')}.` });
            return;
        }
        const result = await roomPreferenceService.reviewRoomPreference({
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            runId: scope.runId,
            requestId,
            reviewerId,
            decisionStatus,
            reviewerNotes: reviewerNotes ?? null,
            expectedRunVersion,
            requestVersion,
            allowSoftOverride: !!allowSoftOverride,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/appeals', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const requestId = positiveInt(req.params.requestId, 'requestId');
        if (typeof requestId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
            return;
        }
        const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
        if (!request)
            return;
        const appeals = await roomPreferenceService.listRoomRequestAppeals(scope.schoolId, scope.schoolYearId, scope.runId, requestId);
        res.json({ requestId, appeals });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/appeals', authenticate, async (req, res, next) => {
    try {
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const requestId = positiveInt(req.params.requestId, 'requestId');
        if (typeof requestId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
            return;
        }
        const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
        if (!request)
            return;
        const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
        const result = await roomPreferenceService.createRoomRequestAppeal({
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            runId: scope.runId,
            requestId,
            requesterId: request.facultyId,
            reason,
        });
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/appeals/:appealId/status', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can update appeal status.' });
            return;
        }
        const actorId = req.user?.userId;
        if (!actorId) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const scope = parseScope(req, res);
        if (!scope)
            return;
        const requestId = positiveInt(req.params.requestId, 'requestId');
        if (typeof requestId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
            return;
        }
        const appealId = positiveInt(req.params.appealId, 'appealId');
        if (typeof appealId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: appealId });
            return;
        }
        const status = req.body?.status;
        if (typeof status !== 'string' || !VALID_APPEAL_STATUSES.has(status)) {
            res.status(400).json({ code: 'INVALID_BODY', message: `status must be one of ${[...VALID_APPEAL_STATUSES].join(', ')}.` });
            return;
        }
        const note = typeof req.body?.note === 'string' ? req.body.note : null;
        const result = await roomPreferenceService.updateRoomRequestAppealStatus({
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            runId: scope.runId,
            requestId,
            appealId,
            actorId,
            status: status,
            note,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=room-preference.router.js.map