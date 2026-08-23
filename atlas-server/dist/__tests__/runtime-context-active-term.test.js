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
function section(name) {
    console.log(`\n  -- ${name} --`);
}
// SECTION 1: Adapter tests
console.log('\n=== Active term adapter contract ===');
section('Valid normalization');
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T1', schoolYearId: 2 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-verified', 'T1: source=enrollpro-verified');
    assert(result.verified === true, 'T1: verified=true');
    assert(result.activeTerm === 'T1', 'T1: activeTerm=T1');
    assert(result.termIndex === 1, 'T1: termIndex=1');
    assert(result.schoolYearId === 2, 'T1: schoolYearId=2');
    assert(result.matchedSchoolYear === null, 'T1: matchedSchoolYear=null (no comparison ID)');
    assert(result.code === null, 'T1: code=null');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T2', schoolYearId: 3 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.termIndex === 2, 'T2: termIndex=2');
    assert(result.activeTerm === 'T2', 'T2: activeTerm=T2');
    teardownEnv(env);
}
{
    const env = setupEnv();
    process.env.ENROLLPRO_SERVICE_TOKEN = 'test-token';
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { activeTerm: 'T3', schoolYearId: 4 } }), { status: 200 });
    const result = await fetchEnrollProActiveTerm();
    assert(result.termIndex === 3, 'T3: termIndex=3');
    assert(result.activeTerm === 'T3', 'T3: activeTerm=T3');
    teardownEnv(env);
}
section('Unreachable cases');
{
    const env = setupEnv();
    delete process.env.ENROLLPRO_SERVICE_TOKEN;
    process.env.ENROLLPRO_API = 'http://localhost:9999/api';
    const result = await fetchEnrollProActiveTerm();
    assert(result.source === 'enrollpro-unreachable', 'No token: source=enrollpro-unreachable');
    assert(result.reachable === false, 'No token: reachable=false');
    assert(result.verified === false, 'No token: verified=false');
    assert(result.code === null, 'No token: code=null');
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
section('Contract drift cases');
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
section('School year match/mismatch');
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
section('Auth header');
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
// SECTION 2: Runtime-context guard logic tests
console.log('\n\n=== Runtime-context active-term guard logic ===');
function cloneActiveTerm(overrides) {
    return {
        source: 'enrollpro-verified',
        reachable: true,
        verified: true,
        activeTerm: 'T1',
        termIndex: 1,
        schoolYearId: 2,
        matchedSchoolYear: null,
        code: null,
        message: 'EnrollPro active term T1 verified.',
        ...overrides,
    };
}
function applyRuntimeContextGuard(activeTermResult, upstreamYear) {
    const result = { ...activeTermResult };
    if (result.verified === true &&
        result.schoolYearId !== null &&
        upstreamYear) {
        result.matchedSchoolYear = result.schoolYearId === upstreamYear.id;
        result.message = result.matchedSchoolYear
            ? `ATLAS is aligned with EnrollPro active term ${result.activeTerm}.`
            : `EnrollPro active term ${result.activeTerm} is from a different school year (expected ${upstreamYear.id}, got ${result.schoolYearId}).`;
    }
    return result;
}
section('Contract drift preserved by guard');
{
    const input = cloneActiveTerm({
        source: 'enrollpro-contract-drift',
        verified: false,
        activeTerm: 'Q1',
        termIndex: null,
        schoolYearId: 2,
        matchedSchoolYear: null,
        code: 'ACTIVE_TERM_CONTRACT_DRIFT',
        message: 'EnrollPro returned invalid activeTerm Q1. Expected T1, T2, or T3.',
    });
    const result = applyRuntimeContextGuard(input, { id: 2 });
    assert(result.source === 'enrollpro-contract-drift', 'Drift preserved: source unchanged');
    assert(result.verified === false, 'Drift preserved: verified unchanged');
    assert(result.code === 'ACTIVE_TERM_CONTRACT_DRIFT', 'Drift preserved: code unchanged');
    assert(result.matchedSchoolYear === null, 'Drift preserved: matchedSchoolYear=null (not overwritten)');
    assert(result.message.includes('invalid activeTerm Q1'), 'Drift preserved: message not rewritten to alignment');
    assert(!result.message.includes('aligned'), 'Drift preserved: message does not contain aligned');
}
section('Unreachable preserved by guard');
{
    const input = cloneActiveTerm({
        source: 'enrollpro-unreachable',
        reachable: false,
        verified: false,
        activeTerm: null,
        termIndex: null,
        schoolYearId: null,
        matchedSchoolYear: null,
        code: null,
        message: 'EnrollPro active-term endpoint is unreachable.',
    });
    const result = applyRuntimeContextGuard(input, { id: 2 });
    assert(result.source === 'enrollpro-unreachable', 'Unreachable preserved: source unchanged');
    assert(result.verified === false, 'Unreachable preserved: verified unchanged');
    assert(result.matchedSchoolYear === null, 'Unreachable preserved: matchedSchoolYear=null');
    assert(result.message.includes('unreachable'), 'Unreachable preserved: message not rewritten');
}
section('Verified + matching school year');
{
    const input = cloneActiveTerm({
        source: 'enrollpro-verified',
        verified: true,
        activeTerm: 'T1',
        termIndex: 1,
        schoolYearId: 2,
        matchedSchoolYear: null,
    });
    const result = applyRuntimeContextGuard(input, { id: 2 });
    assert(result.matchedSchoolYear === true, 'Match: matchedSchoolYear=true');
    assert(result.message.includes('aligned'), 'Match: message says aligned');
    assert(result.message.includes('T1'), 'Match: message includes active term');
}
section('Verified + mismatching school year');
{
    const input = cloneActiveTerm({
        source: 'enrollpro-verified',
        verified: true,
        activeTerm: 'T1',
        termIndex: 1,
        schoolYearId: 5,
        matchedSchoolYear: null,
    });
    const result = applyRuntimeContextGuard(input, { id: 2 });
    assert(result.matchedSchoolYear === false, 'Mismatch: matchedSchoolYear=false');
    assert(result.message.includes('different school year'), 'Mismatch: message says different school year');
    assert(result.message.includes('expected 2'), 'Mismatch: message includes expected school year');
    assert(result.message.includes('got 5'), 'Mismatch: message includes actual school year');
}
section('Verified + no schoolYearId in active term');
{
    const input = cloneActiveTerm({
        source: 'enrollpro-verified',
        verified: true,
        activeTerm: 'T1',
        termIndex: 1,
        schoolYearId: null,
        matchedSchoolYear: null,
    });
    const result = applyRuntimeContextGuard(input, { id: 2 });
    assert(result.matchedSchoolYear === null, 'No schoolYearId: matchedSchoolYear=null (not computed)');
    assert(!result.message.includes('aligned'), 'No schoolYearId: message not rewritten to alignment');
}
section('Verified + null upstream year');
{
    const input = cloneActiveTerm({
        source: 'enrollpro-verified',
        verified: true,
        activeTerm: 'T1',
        termIndex: 1,
        schoolYearId: 2,
        matchedSchoolYear: null,
    });
    const result = applyRuntimeContextGuard(input, null);
    assert(result.matchedSchoolYear === null, 'Null upstream: matchedSchoolYear=null (not computed)');
    assert(!result.message.includes('aligned'), 'Null upstream: message not rewritten to alignment');
}
section('Contract drift with matching school year still not rewritten');
{
    const input = cloneActiveTerm({
        source: 'enrollpro-contract-drift',
        verified: false,
        activeTerm: 'Q1',
        termIndex: null,
        schoolYearId: 2,
        matchedSchoolYear: null,
        code: 'ACTIVE_TERM_CONTRACT_DRIFT',
        message: 'EnrollPro returned invalid activeTerm Q1. Expected T1, T2, or T3.',
    });
    const result = applyRuntimeContextGuard(input, { id: 2 });
    assert(result.source === 'enrollpro-contract-drift', 'Drift+match: source unchanged');
    assert(result.matchedSchoolYear === null, 'Drift+match: matchedSchoolYear=null');
    assert(result.message.includes('invalid activeTerm Q1'), 'Drift+match: drift message preserved');
    assert(!result.message.includes('aligned'), 'Drift+match: no alignment message');
}
console.log('\n' + '='.repeat(56));
console.log(`Tests: ${pass} passed, ${fail} failed, ${pass + fail} total`);
console.log('='.repeat(56));
process.exit(fail > 0 ? 1 : 0);
//# sourceMappingURL=runtime-context-active-term.test.js.map