import { buildGenerationPreflight } from './services/generation-preflight.service.js';
import { revalidateGenerationPreflight } from './services/generation-preflight.service.js';

async function run(enforce: boolean) {
	const result: any = await buildGenerationPreflight(1, 10, { enforceShiftWindows: enforce });
	const blockers = Array.isArray(result?.blockers) ? result.blockers : [];
	const byCode: Record<string, number> = {};
	for (const b of blockers) byCode[b.code] = (byCode[b.code] || 0) + 1;
	console.log(`enforceShiftWindows=${enforce} -> ok: ${result?.ok} | blockers: ${blockers.length} | ${JSON.stringify(byCode)}`);
	for (const b of blockers.slice(0, 6)) console.log(`   [${b.code}] ${b.entity ?? ''} :: ${String(b.reason ?? '').slice(0, 140)}`);
	return result;
}

async function main() {
	const strict = await run(true);
	await run(false);
	if (strict?.ok) {
		const fresh: any = await revalidateGenerationPreflight(strict.assembly);
		console.log('freshness revalidation -> ok:', fresh?.ok, '| changed:', JSON.stringify(fresh?.changed ?? []));
	}
	console.log('schedulerCanRun:', strict?.assembly?.schedulerCanRun);
	console.log('demand:', JSON.stringify(strict?.assembly?.demand ? { lines: strict.assembly.demand.lines?.length ?? null } : null));
	process.exit(0);
}
main().catch((e) => { console.error('ERR:', String(e?.message ?? e).split('\n').slice(0, 3).join(' | ')); process.exit(1); });
