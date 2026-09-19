/**
 * SECTION-ROUTE-AUTHORITY-C01 - actor-school scope on sibling section routes.
 *
 * Failing-first contract on the real Express app with hand-signed JWTs.
 * Every route that accepts a caller-supplied schoolId must enforce
 * actor-school equality before any service dispatch.
 *
 * Run with npx tsx this-file against a reachable database supplied
 * through DATABASE_URL.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let passCount = 0;
let failCount = 0;

function section(title: string) {
  console.log('\n=== ' + title + ' ===\n');
}

function assert(condition: boolean, label: string) {
  if (condition) {
    passCount += 1;
    console.log('[PASS] ' + label);
    return;
  }
  failCount += 1;
  console.error('[FAIL] ' + label);
}

function loadServerEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const content = readFileSync(resolve(here, '../../.env'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

const FIXTURE_NAME = 'SECTION-AUTH-C01 FIXTURE - SAFE TO DELETE';
const OTHER_SCHOOL_ID = 999999;

async function main() {
  loadServerEnv();
  if (!process.env.DATABASE_URL) {
    console.error('[FAIL] DATABASE_URL is unavailable.');
    process.exit(1);
  }
  const prismaModule = await import('../lib/prisma.js');
  const instrumented = (prismaModule as any).createTestPrismaClient();

  let fixtureSchoolId = 0;
  try {
    const created = await instrumented.school.create({
      data: { name: FIXTURE_NAME, shortName: 'SRAC01' },
      select: { id: true },
    });
    fixtureSchoolId = created.id as number;
    assert(fixtureSchoolId > 0, 'fixture school created (id=' + fixtureSchoolId + ')');

    section('boot the real app with hand-signed JWTs');
    const app = (await import('../app.js')).default;
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET as string;
    assert(typeof secret === 'string' && secret.length > 0, 'JWT secret configured for route tests');
    const signJwt = (payload: Record<string, unknown>): string =>
      (jwt.default as any).sign(payload, secret, { expiresIn: '5m' });
    const systemToken = (process.env.ATLAS_SYSTEM_TOKEN ?? '').trim();

    const server = await new Promise<any>((resolveServer, rejectServer) => {
      const listener = app.listen(0, () => resolveServer(listener));
      listener.on('error', rejectServer);
    });
    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? (address as any).port : 0;
      assert(port > 0, 'ephemeral test server listening (port=' + port + ')');
      const baseUrl = 'http://127.0.0.1:' + port;

      const officerJwt = (schoolId: number | null) =>
        signJwt(
          schoolId == null
            ? { userId: 9001, role: 'officer', authSource: 'local' }
            : { userId: 9001, role: 'officer', authSource: 'local', schoolId },
        );

      async function callRoute(
        name: string,
        method: string,
        path: string,
        token: string | null,
        body: unknown,
        expectStatus: number,
        expectCode?: string,
      ) {
        const res = await fetch(baseUrl + path, {
          method,
          headers: {
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        const okStatus = res.status === expectStatus;
        const okCode = expectCode == null || (json as any).code === expectCode;
        assert(
          okStatus && okCode,
          name + ' -> ' + res.status + '/' + ((json as any).code ?? 'no-code') +
            ' (expected ' + expectStatus + (expectCode ? '/' + expectCode : '') + ')',
        );
        return { status: res.status, json };
      }

      // ---- E1: Cross-school GET /home-rooms/:schoolYearId ----
      section('E1 cross-school GET /home-rooms/:schoolYearId');
      await callRoute(
        'E1-a cross-school rejected',
        'GET',
        '/api/v1/sections/home-rooms/1?schoolId=' + fixtureSchoolId,
        officerJwt(OTHER_SCHOOL_ID),
        undefined,
        403,
        'CROSS_SCHOOL_DENIED',
      );

      // ---- E2: Cross-school PUT /home-rooms/:schoolYearId ----
      section('E2 cross-school PUT /home-rooms/:schoolYearId');
      await callRoute(
        'E2-a cross-school rejected',
        'PUT',
        '/api/v1/sections/home-rooms/1',
        officerJwt(OTHER_SCHOOL_ID),
        { schoolId: fixtureSchoolId, assignments: [{ sectionId: 999999, homeRoomId: null }] },
        403,
        'CROSS_SCHOOL_DENIED',
      );

      // ---- E3: Cross-school POST /sync ----
      section('E3 cross-school POST /sync');
      await callRoute(
        'E3-a cross-school rejected',
        'POST',
        '/api/v1/sections/sync',
        officerJwt(OTHER_SCHOOL_ID),
        { schoolId: fixtureSchoolId },
        403,
        'CROSS_SCHOOL_DENIED',
      );

      // ---- E4: Missing actor school (all three routes) ----
      section('E4 missing actor school on all three routes');
      await callRoute(
        'E4-a missing school on GET /home-rooms',
        'GET',
        '/api/v1/sections/home-rooms/1?schoolId=' + fixtureSchoolId,
        officerJwt(null),
        undefined,
        403,
        'SCHOOL_SCOPE_REQUIRED',
      );
      await callRoute(
        'E4-b missing school on PUT /home-rooms',
        'PUT',
        '/api/v1/sections/home-rooms/1',
        officerJwt(null),
        { schoolId: fixtureSchoolId, assignments: [{ sectionId: 999999, homeRoomId: null }] },
        403,
        'SCHOOL_SCOPE_REQUIRED',
      );
      await callRoute(
        'E4-c missing school on POST /sync',
        'POST',
        '/api/v1/sections/sync',
        officerJwt(null),
        { schoolId: fixtureSchoolId },
        403,
        'SCHOOL_SCOPE_REQUIRED',
      );

      // ---- E5: Same-school privileged actor succeeds ----
      section('E5 same-school privileged actor succeeds');
      const e5GetResult = await callRoute(
        'E5-a same-school GET /home-rooms',
        'GET',
        '/api/v1/sections/home-rooms/1?schoolId=' + fixtureSchoolId,
        officerJwt(fixtureSchoolId),
        undefined,
        200,
      );
      assert(e5GetResult.status !== 403, 'E5-a same-school GET passed authority gate (status=' + e5GetResult.status + ')');

      // ---- E6: System token path ----
      section('E6 system token path');
      if (systemToken.length > 0) {
        await callRoute(
          'E6-a system token on sync (no schoolId) rejected',
          'POST',
          '/api/v1/sections/sync',
          systemToken,
          { schoolId: fixtureSchoolId },
          403,
          'SCHOOL_SCOPE_REQUIRED',
        );
      } else {
        console.log('[SKIP] E6 system token not configured');
      }

      // ---- E7: Actor school absent from token ----
      section('E7 actor school absent from token');
      await callRoute(
        'E7-a no schoolId on GET /home-rooms',
        'GET',
        '/api/v1/sections/home-rooms/1?schoolId=' + fixtureSchoolId,
        officerJwt(null),
        undefined,
        403,
        'SCHOOL_SCOPE_REQUIRED',
      );
      await callRoute(
        'E7-b no schoolId on POST /sync',
        'POST',
        '/api/v1/sections/sync',
        officerJwt(null),
        { schoolId: fixtureSchoolId },
        403,
        'SCHOOL_SCOPE_REQUIRED',
      );

      // ---- E8: No scope widening ----
      section('E8 no scope widening - auto-assign still enforces');
      await callRoute(
        'E8-a cross-school auto-assign still rejected',
        'POST',
        '/api/v1/sections/home-rooms/1/auto-assign',
        officerJwt(OTHER_SCHOOL_ID),
        { schoolId: fixtureSchoolId, mode: 'preview' },
        403,
        'CROSS_SCHOOL_DENIED',
      );

    } finally {
      server.close();
    }
  } finally {
    if (fixtureSchoolId > 0) {
      await instrumented.school.deleteMany({ where: { id: fixtureSchoolId } });
    }
  }

  const residue = await instrumented.school.count({ where: { name: FIXTURE_NAME } });
  assert(residue === 0, 'zero residue (school=' + residue + ')');

  console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(2);
});
