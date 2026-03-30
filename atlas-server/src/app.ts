import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.router.js';
import mapRouter from './routes/map.router.js';

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

// Error handler
app.use(errorHandler);

export default app;
