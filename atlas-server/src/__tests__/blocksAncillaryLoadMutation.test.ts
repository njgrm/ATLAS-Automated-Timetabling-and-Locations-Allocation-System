import { prisma } from '../lib/prisma.js';
import { validateAncillaryLoadImmutable } from '../services/scheduling-policy.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n=== ${name} ===`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  OK ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  FAIL ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  OK ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  FAIL ${label} - expected ${String(expected)}, got ${String(actual)}`);
}

async function run() {
	const candidate = await prisma.facultyMirror.findFirst({
		where: { isStale: false },
		orderBy: { id: 'asc' },
		select: { id: true, ancillaryMinutesPerWeek: true, ancillaryLoadSource: true },
	});

	if (!candidate) {
		console.error('\nMissing seeded faculty mirror data for ancillary immutability test.');
		process.exitCode = 1;
		await prisma.$disconnect();
		return;
	}

	const originalMinutes = candidate.ancillaryMinutesPerWeek;
	const originalSource = candidate.ancillaryLoadSource;

	try {
		section('ANC-IMMUTABLE-01 blocks local mutation when source is HR');
		await prisma.facultyMirror.update({
			where: { id: candidate.id },
			data: {
				ancillaryMinutesPerWeek: 120,
				ancillaryLoadSource: 'HR',
			},
		});

		let blockedError: { statusCode?: number; code?: string } | null = null;
		try {
			await validateAncillaryLoadImmutable(candidate.id, 60, 'LOCAL');
		} catch (error) {
			blockedError = error as { statusCode?: number; code?: string };
		}
		assert(Boolean(blockedError), 'Mutation attempt throws error');
		assertEqual(blockedError?.statusCode, 409, 'Conflict status returned');
		assertEqual(blockedError?.code, 'ANCILLARY_LOAD_IMMUTABLE', 'Immutable error code returned');

		section('ANC-IMMUTABLE-02 allows unchanged HR value');
		let unchangedOk = true;
		try {
			await validateAncillaryLoadImmutable(candidate.id, 120, 'HR');
		} catch {
			unchangedOk = false;
		}
		assert(unchangedOk, 'No error for unchanged HR-managed values');

		section('ANC-IMMUTABLE-03 allows updates when source is LOCAL');
		await prisma.facultyMirror.update({
			where: { id: candidate.id },
			data: {
				ancillaryMinutesPerWeek: 90,
				ancillaryLoadSource: 'LOCAL',
			},
		});
		let localUpdateOk = true;
		try {
			await validateAncillaryLoadImmutable(candidate.id, 30, 'LOCAL');
		} catch {
			localUpdateOk = false;
		}
		assert(localUpdateOk, 'No error when source is LOCAL');
	} finally {
		await prisma.facultyMirror.update({
			where: { id: candidate.id },
			data: {
				ancillaryMinutesPerWeek: originalMinutes,
				ancillaryLoadSource: originalSource,
			},
		});
		await prisma.$disconnect();
	}

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run().catch((error) => {
	console.error('\nUnhandled ancillary immutability test error:', error);
	process.exit(1);
});
