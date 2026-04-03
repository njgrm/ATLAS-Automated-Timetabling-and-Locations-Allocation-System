import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

/* ── Startup env validation ── */
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;
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
import followUpFlagRouter from './routes/follow-up-flag.router.js';
import manualEditRouter from './routes/manual-edit.router.js';

const app = express();

app.use(
	helmet({
		crossOriginResourcePolicy: { policy: 'cross-origin' },
	}),
);

app.use(
	cors({
		origin: [
			process.env.CLIENT_URL || 'http://localhost:5174',
			'http://localhost:5174',
			'http://localhost:5173',
		],
		credentials: true,
	}),
);

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
app.use('/api/v1/follow-up-flags', followUpFlagRouter);
app.use('/api/v1/generation', manualEditRouter);

// Error handler
app.use(errorHandler);

export default app;
