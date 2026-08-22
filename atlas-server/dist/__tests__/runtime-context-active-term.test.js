import { fetchEnrollProActiveTerm } from '../services/active-term-adapter.service.js';
let pass = 0;
let fail = 0;
function assert(condition, label) {
    if (condition) {
        pass++;
        console.log(`  ✓ ${label}`);
    }
    else {
        fail++;
        console.error(`  ✗ ${label}`);
    }
}
function setupEnv() {
    return {
        originalToken: process.env.ENROLLPRO_SERVICE_TOKEN,
        originalApi: process.env.ENROLLPRO_API,
        originalFetch: globalThis.fetch,
    };
}
function teardownEnv(env) {
    process.env.ENROLLPRO_SERVICE_TOKEN = env.originalToken;
    process.env.ENROLLPRO_API = env.originalApi;
    globalThis.fetch = env.originalFetch;
}
console.log('\n═══ Active term adapter contract ═══');
// ── Valid normalization ──
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T1', schoolYearId: 2 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-verified', 'Valid T1: source=enrollpro-verified');
    assert(result.verified === true, 'Valid T1: verified=true');
    assert(result.activeTerm === 'T1', 'Valid T1: activeTerm=T1');
    assert(result.termIndex === 1, 'Valid T1: termIndex=1');
    assert(result.schoolYearId === 2, 'Valid T1: schoolYearId=2');
    assert(result.matchedSchoolYear === null, 'Valid T1: matchedSchoolYear=null (no comparison ID)');
    assert(result.code === null, 'Valid T1: code=null');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T2', schoolYearId: 3 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.termIndex === 2, 'Valid T2: termIndex=2');
    assert(result.activeTerm === 'T2', 'Valid T2: activeTerm=T2');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T3', schoolYearId: 4 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.termIndex === 3, 'Valid T3: termIndex=3');
    assert(result.activeTerm === 'T3', 'Valid T3: activeTerm=T3');
    teardownEnv(env);
}
// ── Unreachable cases ──
{
    const env = setupEnv();
    delete process.env.ENROLLPRO_SERVICE_TOKEN;
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-unreachable', 'No token: source=enrollpro-unreachable');
    assert(result.reachable === false, 'No token: reachable=false');
    assert(result.verified === false, 'No token: verified=false');
    assert(result.message.includes('No integration key'), 'No token: message indicates missing key');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => { throw new Error('Connection refused'); };
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-unreachable', 'Network error: source=enrollpro-unreachable');
    assert(result.reachable === false, 'Network error: reachable=false');
    assert(result.message.includes('unreachable'), 'Network error: message indicates unreachable');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(null, { status: 500 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-unreachable', 'HTTP 500: source=enrollpro-unreachable');
    assert(result.message.includes('500'), 'HTTP 500: message includes status code');
    teardownEnv(env);
}
// ── Contract drift cases ──
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'Q1', schoolYearId: 2 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-contract-drift', 'Invalid term: source=enrollpro-contract-drift');
    assert(result.reachable === true, 'Invalid term: reachable=true');
    assert(result.verified === false, 'Invalid term: verified=false');
    assert(result.code === 'ACTIVE_TERM_CONTRACT_DRIFT', 'Invalid term: code=ACTIVE_TERM_CONTRACT_DRIFT');
    assert(result.activeTerm === 'Q1', 'Invalid term: preserves Q1');
    assert(result.termIndex === null, 'Invalid term: termIndex=null');
    assert(result.schoolYearId === 2, 'Invalid term: schoolYearId preserved');
    assert(result.matchedSchoolYear === null, 'Invalid term: matchedSchoolYear=null');
    assert(result.message.includes('invalid activeTerm Q1'), 'Invalid term: message says contract drift');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T1' } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-contract-drift', 'Missing schoolYearId: source=enrollpro-contract-drift');
    assert(result.reachable === true, 'Missing schoolYearId: reachable=true');
    assert(result.code === 'ACTIVE_TERM_CONTRACT_DRIFT', 'Missing schoolYearId: code=ACTIVE_TERM_CONTRACT_DRIFT');
    assert(result.activeTerm === 'T1', 'Missing schoolYearId: activeTerm=T1');
    assert(result.termIndex === 1, 'Missing schoolYearId: termIndex=1');
    assert(result.schoolYearId === null, 'Missing schoolYearId: schoolYearId=null');
    assert(result.matchedSchoolYear === null, 'Missing schoolYearId: matchedSchoolYear=null');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T2', schoolYearId: 'abc' } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-contract-drift', 'Non-numeric schoolYearId: source=enrollpro-contract-drift');
    assert(result.reachable === true, 'Non-numeric schoolYearId: reachable=true');
    assert(result.code === 'ACTIVE_TERM_CONTRACT_DRIFT', 'Non-numeric schoolYearId: code=ACTIVE_TERM_CONTRACT_DRIFT');
    assert(result.activeTerm === 'T2', 'Non-numeric schoolYearId: activeTerm=T2');
    assert(result.termIndex === 2, 'Non-numeric schoolYearId: termIndex=2');
    assert(result.schoolYearId === null, 'Non-numeric schoolYearId: schoolYearId=null');
    teardownEnv(env);
}
// ── School year match/mismatch ──
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T1', schoolYearId: 2 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm('test-token', 2);
    assert(result.matchedSchoolYear === true, 'Match: matchedSchoolYear=true');
    assert(result.message.includes('aligned'), 'Match: message says aligned');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T1', schoolYearId: 5 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm('test-token', 2);
    assert(result.matchedSchoolYear === false, 'Mismatch: matchedSchoolYear=false');
    assert(result.message.includes('different school year'), 'Mismatch: message says different school year');
    teardownEnv(env);
}
// ── Uses X-Integration-Key header ──
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'env-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    let capturedHeaders = {};
    globalThis.fetch = async (_url, init) => {
        capturedHeaders = init?.headers ?? {};
        return new Response(JSON.stringify({ data: { activeTerm: 'T1', schoolYearId: 2 } }), { status: 200 });
    };
    await fetchEnrollProActiveTerm('param-token');
    assert(capturedHeaders['X-Integration-Key'] === 'param-token', 'Auth: uses X-Integration-Key header');
    assert(capturedHeaders['Authorization'] === undefined, 'Auth: does not use Authorization header');
    teardownEnv(env);
}
// ── Missing null activeTerm returns contract drift ──
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: null, schoolYearId: 2 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-contract-drift', 'Null term: source=enrollpro-contract-drift');
    assert(result.reachable === true, 'Null term: reachable=true');
    assert(result.code === 'ACTIVE_TERM_CONTRACT_DRIFT', 'Null term: code=ACTIVE_TERM_CONTRACT_DRIFT');
    teardownEnv(env);
}
console.log('\n' + '='.repeat(56));
console.log(`Tests: ${pass} passed, ${fail} failed, ${pass + fail} total`);
console.log('='.repeat(56));
process.exit(fail > 0 ? 1 : 0);
//# sourceMappingURL=runtime-context-active-term.test.js.map