#!/usr/bin/env node
/**
 * One-shot, reversible copy of per-year timetable setup from a previous school
 * year into a new one (hotfix 2026-09-29, EnrollPro reset to 2022-2023).
 *
 * Copies, fill-empty-only:
 *   - grade_shift_windows   (a row is copied only when the target has no row for
 *                            the same grade_level + program_type)
 *   - policy_special_events (copied only when the target year has none at all)
 *
 * It never updates or deletes a source row, never touches any other table, and
 * never overwrites a target row. The scheduling policy is NOT copied: the new
 * year already has one and it was verified field-identical on 2026-09-29.
 *
 * Modes (default is a dry run):
 *   node copy-year-setup-shift-windows-events.mjs --school 1 --from 10 --to 1
 *       Dry run. The connection is opened with default_transaction_read_only=on
 *       and the script aborts unless the server confirms it. Prints the plan.
 *   ... --apply --receipt <file.json>
 *       One transaction. Writes a receipt with every inserted id.
 *   ... --revert <file.json>
 *       One transaction. Deletes exactly the receipt's ids (scoped to the
 *       receipt's school and target year) and nothing else.
 *
 * Environment: DATABASE_URL, or --env <file> with a DATABASE_URL= line (the
 * value is never printed). @prisma/client is resolved from ATLAS_SERVER_DIR
 * (a directory containing node_modules/@prisma/client) or from this script's
 * own atlas-server directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

function arg(name) {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name) => process.argv.includes(`--${name}`);
function positive(name) {
	const value = Number(arg(name));
	if (!Number.isInteger(value) || value <= 0) throw new Error(`--${name} must be a positive integer`);
	return value;
}

const envFile = arg('env');
if (envFile) {
	for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
		const m = line.match(/^DATABASE_URL=(.*)$/);
		if (m) process.env.DATABASE_URL = m[1].trim().replace(/^"(.*)"$/, '$1');
	}
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (use --env <file>).');

const revertFile = arg('revert');
const apply = flag('apply');
const mode = revertFile ? 'REVERT' : apply ? 'APPLY' : 'DRY_RUN';

const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('connection_limit', '1');
if (mode === 'DRY_RUN') url.searchParams.set('options', '-c default_transaction_read_only=on');

const serverDir = process.env.ATLAS_SERVER_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(serverDir, 'package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: url.toString() });

const sameProgram = (a, b) => (a ?? null) === (b ?? null);

async function plan(tx, schoolId, fromYear, toYear) {
	const [target] = await tx.$queryRawUnsafe(
		'select enrollpro_school_year_id y, year_label, is_active, is_archived from enrollpro_school_year_mirrors where school_id = $1 and enrollpro_school_year_id = $2',
		schoolId, toYear,
	);
	if (!target) throw new Error(`No school-year mirror for target year ${toYear}.`);
	if (!target.is_active || target.is_archived) throw new Error(`Target year ${toYear} is not the active, non-archived year.`);
	const [source] = await tx.$queryRawUnsafe(
		'select enrollpro_school_year_id y, year_label from enrollpro_school_year_mirrors where school_id = $1 and enrollpro_school_year_id = $2',
		schoolId, fromYear,
	);
	if (!source) throw new Error(`No school-year mirror for source year ${fromYear}.`);

	const srcWindows = await tx.$queryRawUnsafe(
		'select grade_level, program_type::text program_type, start_time, end_time from grade_shift_windows where school_id = $1 and school_year_id = $2 order by grade_level, program_type nulls last',
		schoolId, fromYear,
	);
	const dstWindows = await tx.$queryRawUnsafe(
		'select grade_level, program_type::text program_type from grade_shift_windows where school_id = $1 and school_year_id = $2',
		schoolId, toYear,
	);
	const windows = srcWindows.filter((w) => !dstWindows.some((d) => d.grade_level === w.grade_level && sameProgram(d.program_type, w.program_type)));

	const srcEvents = await tx.$queryRawUnsafe(
		'select event_type, label, grade_group, program_type, start_time, end_time, enabled, sort_order from policy_special_events where school_id = $1 and school_year_id = $2 order by sort_order, id',
		schoolId, fromYear,
	);
	const [{ n: dstEventCount }] = await tx.$queryRawUnsafe(
		'select count(*)::int n from policy_special_events where school_id = $1 and school_year_id = $2',
		schoolId, toYear,
	);
	const events = dstEventCount === 0 ? srcEvents : [];

	return {
		source: { year: fromYear, label: source.year_label },
		target: { year: toYear, label: target.year_label },
		gradeShiftWindows: { source: srcWindows.length, targetExisting: dstWindows.length, toInsert: windows.length, rows: windows },
		policySpecialEvents: { source: srcEvents.length, targetExisting: dstEventCount, toInsert: events.length, rows: events },
	};
}

async function main() {
	if (mode === 'REVERT') {
		const receipt = JSON.parse(fs.readFileSync(revertFile, 'utf8'));
		const result = await prisma.$transaction(async (tx) => {
			const w = receipt.inserted.gradeShiftWindowIds.length === 0 ? 0 : await tx.$executeRawUnsafe(
				'delete from grade_shift_windows where school_id = $1 and school_year_id = $2 and id = any($3::int[])',
				receipt.schoolId, receipt.target.year, receipt.inserted.gradeShiftWindowIds,
			);
			const e = receipt.inserted.policySpecialEventIds.length === 0 ? 0 : await tx.$executeRawUnsafe(
				'delete from policy_special_events where school_id = $1 and school_year_id = $2 and id = any($3::int[])',
				receipt.schoolId, receipt.target.year, receipt.inserted.policySpecialEventIds,
			);
			if (w !== receipt.inserted.gradeShiftWindowIds.length || e !== receipt.inserted.policySpecialEventIds.length) {
				throw new Error(`Revert count mismatch (windows ${w}/${receipt.inserted.gradeShiftWindowIds.length}, events ${e}/${receipt.inserted.policySpecialEventIds.length}); rolled back.`);
			}
			return { deletedGradeShiftWindows: w, deletedPolicySpecialEvents: e };
		}, { isolationLevel: 'Serializable' });
		console.log(JSON.stringify({ mode, ...result }, null, 2));
		return;
	}

	const schoolId = positive('school');
	const fromYear = positive('from');
	const toYear = positive('to');
	if (fromYear === toYear) throw new Error('--from and --to must differ');

	if (mode === 'DRY_RUN') {
		const [ro] = await prisma.$queryRawUnsafe('show default_transaction_read_only');
		if (ro.default_transaction_read_only !== 'on') throw new Error('Read-only guard not active; aborting dry run.');
		const p = await plan(prisma, schoolId, fromYear, toYear);
		console.log(JSON.stringify({ mode, readOnlyGuard: 'on', schoolId, ...p }, null, 2));
		return;
	}

	const receiptPath = arg('receipt');
	if (!receiptPath) throw new Error('--apply requires --receipt <file.json>');
	if (fs.existsSync(receiptPath)) throw new Error(`Receipt ${receiptPath} already exists; refusing to overwrite.`);
	const receipt = await prisma.$transaction(async (tx) => {
		const p = await plan(tx, schoolId, fromYear, toYear);
		const gradeShiftWindowIds = [];
		for (const w of p.gradeShiftWindows.rows) {
			const [row] = await tx.$queryRawUnsafe(
				`insert into grade_shift_windows (school_id, school_year_id, grade_level, program_type, start_time, end_time, "createdAt", "updatedAt")
				 values ($1, $2, $3, $4::program_type, $5, $6, now(), now()) returning id`,
				schoolId, toYear, w.grade_level, w.program_type, w.start_time, w.end_time,
			);
			gradeShiftWindowIds.push(row.id);
		}
		const policySpecialEventIds = [];
		for (const e of p.policySpecialEvents.rows) {
			const [row] = await tx.$queryRawUnsafe(
				`insert into policy_special_events (school_id, school_year_id, event_type, label, grade_group, program_type, start_time, end_time, enabled, sort_order, created_at, updated_at)
				 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) returning id`,
				schoolId, toYear, e.event_type, e.label, e.grade_group, e.program_type, e.start_time, e.end_time, e.enabled, e.sort_order,
			);
			policySpecialEventIds.push(row.id);
		}
		return { schoolId, source: p.source, target: p.target, appliedAt: new Date().toISOString(), inserted: { gradeShiftWindowIds, policySpecialEventIds } };
	}, { isolationLevel: 'Serializable' });
	fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
	console.log(JSON.stringify({ mode, receiptPath, inserted: { gradeShiftWindows: receipt.inserted.gradeShiftWindowIds.length, policySpecialEvents: receipt.inserted.policySpecialEventIds.length } }, null, 2));
}

try {
	await main();
} finally {
	await prisma.$disconnect();
}
