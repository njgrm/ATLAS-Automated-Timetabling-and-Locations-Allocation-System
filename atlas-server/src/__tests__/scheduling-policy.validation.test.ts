import { validatePolicyInput } from '../services/scheduling-policy.service.js';

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

console.log('\n═══ Scheduling policy validation regression ═══');

{
	const result = validatePolicyInput({
		earliestStartTime: '06:30',
		latestEndTime: '12:00',
		// Keep lunch defaults and enforce window ON.
		// This used to fail when lunchEndTime exceeded latestEndTime.
		enforceLunchWindow: true,
	});

	assert(result.errors.length === 0, 'Half-day policy (06:30-12:00) should validate successfully');
	assert(result.data.enforceLunchWindow === true, 'Lunch enforcement remains enabled when a valid clamped window exists');
	assert(result.data.lunchStartTime === '11:55', 'Lunch start remains unchanged when inside bounds');
	assert(result.data.lunchEndTime === '12:00', 'Lunch end is clamped to latestEndTime');
}

{
	const result = validatePolicyInput({
		earliestStartTime: '07:00',
		latestEndTime: '07:30',
		enforceLunchWindow: false,
	});

	assert(result.errors.length > 0, 'Window smaller than one period is rejected');
	assert(
		result.errors.some((e) => e.includes('at least 50 minutes')),
		'Too-short-window error message is explicit',
	);
}

{
	const result = validatePolicyInput({
		earliestStartTime: '11:00',
		latestEndTime: '12:00',
		lunchStartTime: '11:50',
		lunchEndTime: '12:30',
		enforceLunchWindow: true,
	});

	assert(result.errors.length === 0, 'Out-of-range lunch window should be normalized instead of rejected');
	assert(result.data.lunchStartTime === '11:50', 'Lunch start stays when valid');
	assert(result.data.lunchEndTime === '12:00', 'Lunch end clamps to schedule end');
}

console.log('\n' + '═'.repeat(56));
console.log(`Tests: ${pass} passed, ${fail} failed, ${pass + fail} total`);
console.log('═'.repeat(56));

process.exit(fail > 0 ? 1 : 0);
