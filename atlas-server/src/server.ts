import { createServer } from 'node:http';

import app from './app.js';
import { prisma } from './lib/prisma.js';
import { registerProcessCrashHandlers } from './services/crash-handler.service.js';
import { registerRoomPreferenceCollaborationSocket } from './services/room-preference-collaboration.service.js';
import { startRolloverAutomation, stopRolloverAutomation } from './services/rollover-automation.service.js';

// RR-08: process-level crash hardening. Registered before anything else so
// startup-time failures are also captured. Policy: log-and-continue with a
// visible SERVER_FATAL_ERROR notification (single unattended deployment).
registerProcessCrashHandlers();

const PORT = Number(process.env.PORT) || 5001;
const server = createServer(app);
registerRoomPreferenceCollaborationSocket(server);

/**
 * Verify that expected policy columns exist in scheduling_policies.
 * Non-fatal: logs actionable warning if columns are missing.
 */
async function checkPolicySchema() {
	const expectedColumns = [
		'enable_vacant_aware_constraints',
		'target_faculty_daily_vacant_minutes',
		'target_section_daily_vacant_periods',
		'period_length_minutes',
		'periods_per_day',
		'max_compressed_teaching_minutes_per_day',
		'lunch_start_time',
		'lunch_end_time',
		'enforce_lunch_window',
	];

	try {
		const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
			SELECT column_name FROM information_schema.columns
			WHERE table_name = 'scheduling_policies'
		`;
		const existing = new Set(result.map((r) => r.column_name));
		const missing = expectedColumns.filter((c) => !existing.has(c));

		if (missing.length > 0) {
			console.warn(
				`[POLICY_SCHEMA_DRIFT] scheduling_policies is missing columns: ${missing.join(', ')}. ` +
				`Policy endpoints will use in-memory defaults until migrations are applied. ` +
				`Run: npx prisma migrate deploy`,
			);
		} else {
			console.log('[prisma] ✔ scheduling_policies schema verified');
		}
	} catch {
		// Table may not exist at all — first migration not run yet
		console.warn('[POLICY_SCHEMA_DRIFT] Could not verify scheduling_policies schema. Run: npx prisma migrate deploy');
	}
}

server.listen(PORT,'0.0.0.0', async () => {
	console.log(`[ATLAS] Server listening on http://localhost:${PORT}`);
	// Startup connectivity check
	try {
		const count = await prisma.school.count();
		console.log(`[prisma] ✔ DB connected, ${count} school(s) found`);
		// Schema diagnostic — non-blocking
		await checkPolicySchema();
		// Start automated rollover sync
		startRolloverAutomation();
	} catch (e: unknown) {
		const err = e as { code?: string; message?: string };
		console.error(`[prisma] ❌ Startup DB check failed: ${err.code} — ${err.message?.substring(0, 200)}`);
	}
});

server.on('close', () => {
	stopRolloverAutomation();
});
