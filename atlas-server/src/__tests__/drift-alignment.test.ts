import { prisma } from '../lib/prisma.js';
import { resolveRuntimeContext } from '../services/runtime-context.service.js';
import { getRolloverStatus, findMappingConflicts } from '../services/enrollpro-rollover.service.js';

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		pass++;
		console.log(`  ✓ ${label}`);
	} else {
		fail++;
		console.error(`  ✗ ${label}`);
	}
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label} — expected ${String(expected)}, got ${String(actual)}`);
}

console.log('\n═══ Drift alignment: runtime-context vs rollover-status ═══');

async function run() {
	const schoolId = 1;

	section('FindMappingConflicts exports correctly');
	const upstreamYear = { id: 1, yearLabel: '2026-2027' };
	const conflicts = await findMappingConflicts(schoolId, upstreamYear);
	assert(Array.isArray(conflicts), 'findMappingConflicts returns an array');
	console.log(`  ℹ Found ${conflicts.length} conflicts for schoolId=${schoolId}, yearId=1`);
	if (conflicts.length > 0) {
		for (const c of conflicts) {
			console.log(`    - ${c.code}: ${c.message}`);
		}
	}

	section('Runtime context and rollover status agree on drift status (live-state coverage)');
	const runtimeContext = await resolveRuntimeContext(schoolId, undefined, { verifyUpstream: true });
	const rolloverStatus = await getRolloverStatus(schoolId, undefined, { includeCounts: true });

	assert(runtimeContext !== null, 'Runtime context returns a result');
	assert(rolloverStatus !== null, 'Rollover status returns a result');

	if (runtimeContext && rolloverStatus) {
		assertEqual(
			runtimeContext.activeYearDrift.status,
			rolloverStatus.drift.status,
			'Runtime context and rollover status report the same drift.status',
		);
		assertEqual(
			runtimeContext.activeYearDrift.recommendedAction,
			rolloverStatus.drift.recommendedAction,
			'Runtime context and rollover status report the same recommendedAction',
		);
		console.log(`  ℹ Live drift status: ${runtimeContext.activeYearDrift.status}`);
		console.log(`  ℹ Live recommended action: ${runtimeContext.activeYearDrift.recommendedAction}`);

		// Verify drift-specific properties
		const driftStatus = runtimeContext.activeYearDrift.status;
		if (driftStatus === 'mapping-conflict') {
			assert(
				rolloverStatus.conflicts.length > 0,
				'When drift is mapping-conflict, rollover status has conflicts',
			);
			assertEqual(
				runtimeContext.activeYearDrift.recommendedAction,
				'RESET_DUMMY_YEAR',
				'Mapping conflict recommends RESET_DUMMY_YEAR when reset is available',
			);
			console.log(`  ℹ Rollover conflicts: ${rolloverStatus.conflicts.map((c) => c.code).join(', ')}`);
		} else if (driftStatus === 'enrollpro-unreachable') {
			assertEqual(
				runtimeContext.activeYearDrift.recommendedAction,
				'RETRY_ENROLLPRO',
				'EnrollPro unreachable recommends RETRY_ENROLLPRO',
			);
		} else if (driftStatus === 'aligned') {
			assertEqual(
				runtimeContext.activeYearDrift.recommendedAction,
				'NONE',
				'Aligned state recommends NONE',
			);
		}
	} else {
		console.log('  ⚠ Skipping alignment check — one or both endpoints returned null');
		fail++;
	}

	section('Current-year reviewed data does not become dummy conflict by itself');
	const currentYearConflicts = await findMappingConflicts(schoolId, upstreamYear);
	const nonIdentityConflicts = currentYearConflicts.filter(
		(c) => c.code !== 'YEAR_LABEL_MISMATCH' && c.code !== 'SECTION_ID_COLLISION',
	);
	assertEqual(
		nonIdentityConflicts.length,
		0,
		'No non-identity conflicts exist for current year (reviewed data is not a dummy conflict)',
	);

	section('SECTION_ID_COLLISION detection');
	const sectionMirrors = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId: upstreamYear.id },
		select: { externalId: true },
		take: 10,
	});
	console.log(`  ℹ Found ${sectionMirrors.length} section mirrors for yearId=1`);
	if (sectionMirrors.length > 0) {
		const externalIds = new Set(sectionMirrors.map((s) => s.externalId));
		console.log(`  ℹ External IDs: ${[...externalIds].slice(0, 5).join(', ')}${externalIds.size > 5 ? '...' : ''}`);
	}

	section('Active school year consistency');
	if (runtimeContext) {
		assert(
			runtimeContext.activeSchoolYearId > 0,
			'Runtime context has a positive activeSchoolYearId',
		);
		console.log(`  ℹ Active school year ID: ${runtimeContext.activeSchoolYearId}`);
		console.log(`  ℹ Active school year label: ${runtimeContext.activeSchoolYearLabel ?? '(unavailable)'}`);
	}

	console.log('\n' + '═'.repeat(56));
	console.log(`Tests: ${pass} passed, ${fail} failed, ${pass + fail} total`);
	console.log('═'.repeat(56));

	process.exit(fail > 0 ? 1 : 0);
}

function section(name: string) {
	console.log(`\n════ ${name} ════`);
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
