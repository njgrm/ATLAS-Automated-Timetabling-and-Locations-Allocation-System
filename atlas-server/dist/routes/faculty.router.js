import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as facultyService from '../services/faculty.service.js';
const router = Router();
// Auth: GET /faculty?schoolId=X
router.get('/', authenticate, async (req, res, next) => {
    try {
        const schoolId = Number(req.query.schoolId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
            return;
        }
        const [faculty, lastSyncedAt] = await Promise.all([
            facultyService.getFacultyBySchool(schoolId),
            facultyService.getLastSyncTime(schoolId),
        ]);
        res.json({ faculty, lastSyncedAt });
    }
    catch (err) {
        next(err);
    }
});
// Auth: GET /faculty/:id
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
            return;
        }
        const faculty = await facultyService.getFacultyById(id);
        if (!faculty) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Faculty not found.' });
            return;
        }
        res.json({ faculty });
    }
    catch (err) {
        next(err);
    }
});
// Auth: PATCH /faculty/:id — update local notes, scheduling status, max hours
router.patch('/:id', authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
            return;
        }
        const { localNotes, isActiveForScheduling, maxHoursPerWeek, version } = req.body;
        if (version === undefined) {
            res.status(400).json({ code: 'MISSING_FIELDS', message: 'version is required for optimistic locking.' });
            return;
        }
        const result = await facultyService.updateFacultyMirror(id, { localNotes, isActiveForScheduling, maxHoursPerWeek }, Number(version));
        if (!result.success) {
            const status = result.error?.includes('conflict') ? 409 : 404;
            res.status(status).json({ code: status === 409 ? 'VERSION_CONFLICT' : 'NOT_FOUND', message: result.error });
            return;
        }
        res.json({ faculty: result.faculty });
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /faculty/sync — trigger sync from external source
router.post('/sync', authenticate, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        // Forward the bridge token to the EnrollPro adapter
        const authToken = req.headers.authorization?.slice(7);
        const result = await facultyService.syncFacultyFromExternal(schoolId, authToken);
        if (!result.synced) {
            res.status(502).json({ code: 'SYNC_FAILED', message: result.error });
            return;
        }
        res.json({ synced: true, count: result.count });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=faculty.router.js.map