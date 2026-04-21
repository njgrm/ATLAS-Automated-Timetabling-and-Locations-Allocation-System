import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
/* ── Startup env validation ── */
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`[ATLAS] ❌ Missing required env var: ${key}. Server may not function correctly.`);
    }
}
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.router.js';
import mapRouter from './routes/map.router.js';
import subjectRouter from './routes/subject.router.js';
import facultyRouter from './routes/faculty.router.js';
import facultyAssignmentRouter from './routes/faculty-assignment.router.js';
import sectionRouter from './routes/section.router.js';
import preferenceRouter from './routes/preference.router.js';
import generationRouter from './routes/generation.router.js';
import schedulingPolicyRouter from './routes/scheduling-policy.router.js';
import roomScheduleRouter from './routes/room-schedule.router.js';
import roomPreferenceRouter from './routes/room-preference.router.js';
import followUpFlagRouter from './routes/follow-up-flag.router.js';
import manualEditRouter from './routes/manual-edit.router.js';
import lockedSessionRouter from './routes/locked-session.router.js';
import gradeWindowRouter from './routes/grade-window.router.js';
import cohortRouter from './routes/cohort.router.js';
const app = express();
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin)
            return callback(null, true);
        const allowed = new Set([
            process.env.CLIENT_URL || 'http://localhost:5174',
            process.env.ENROLLPRO_CLIENT_URL || 'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5173',
            // Tailscale / LAN origins — comma-separated via env
            ...(process.env.CORS_EXTRA_ORIGINS
                ? process.env.CORS_EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
                : []),
        ]);
        if (allowed.has(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
// Serve uploaded files
app.use('/uploads', express.static(path.resolve(import.meta.dirname, '../uploads')));
// Health check
app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'atlas' });
});
// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/map', mapRouter);
app.use('/api/v1/subjects', subjectRouter);
app.use('/api/v1/faculty', facultyRouter);
app.use('/api/v1/faculty-assignments', facultyAssignmentRouter);
app.use('/api/v1/sections', sectionRouter);
app.use('/api/v1/preferences', preferenceRouter);
app.use('/api/v1/generation', generationRouter);
app.use('/api/v1/policies/scheduling', schedulingPolicyRouter);
app.use('/api/v1/room-schedules', roomScheduleRouter);
app.use('/api/v1/room-preferences', roomPreferenceRouter);
app.use('/api/v1/follow-up-flags', followUpFlagRouter);
app.use('/api/v1/generation', manualEditRouter);
app.use('/api/v1/generation', lockedSessionRouter);
app.use('/api/v1/generation', gradeWindowRouter);
app.use('/api/v1/cohorts', cohortRouter);
// Error handler
app.use(errorHandler);
export default app;
//# sourceMappingURL=app.js.map