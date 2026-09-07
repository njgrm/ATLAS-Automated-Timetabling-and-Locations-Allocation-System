/**
 * SCA-02R2 — Atomic requirement creation: deterministic concurrency proof.
 *
 * Proves through the production `createRequirement` path (service + route)
 * on a disposable school with an EnrollPro year mirror and zero-residue
 * cleanup:
 *  C1. Concurrent identical base-scope creates → exactly one active row,
 *      one success + typed 409 REQUIREMENT_EXISTS.
 *  C2. Concurrent identical section-override creates → same guarantee.
 *  C3. Concurrent identical cohort-override creates → same guarantee.
 *  C4. Concurrent creates with genuinely different canonical identities →
 *      both succeed (no false serialization conflict).
 *  C5. Retired identity followed by a new active create → succeeds; the
 *      retired row never blocks, and a re-duplicate of the new row → 409.
 *  C6. Route-level concurrent identical creates → HTTP 201 + 409 with code
 *      REQUIREMENT_EXISTS and exactly one persisted active row.
 *  C7. Failure cleanup and zero fixture residue.
 *
 * Determinism (NOT probabilistic Promise.all): every concurrent pair runs
 * under a `$transaction`-entry barrier installed on the production Prisma
 * singleton. The first entrant waits until the second entrant arrives, so
 * both requests are simultaneously in flight through the production path
 * before either transaction body executes. Pre-fix this forces both
 * duplicate-discovery reads to complete before either insert (both succeed,
 * two active rows — the recorded failure). Post-fix both transaction bodies
 * overlap inside Serializable isolation (one commits, the other deterministically
 * loses with typed 409). No sleeps, no timing assumptions; the barrier has a
 * fail-open timeout that marks the attack un-engaged (loud failure, never a
 * silent pass).
 *
 * Run with: npx tsx --env-file=.env src/__tests__/curriculum-requirements-concurrency.test.ts
 */

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import {
  createRequirement,
  retireRequirementAtomic,
  requirementIdentityKey,
  requirementIdentityOf,
  type OfferingInput,
  type RequirementIdentity,
} from '../services/school-year-offering.service.js';
import { upsertTermConfig } from '../services/term-config.service.js';

// Disposable fixtures — NEVER canonical school 1, NEVER another suite's IDs.
const SCHOOL = 99971;
const YEAR = 77871;
const ACTOR = 41;
const PORT = 5998;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string) {
  if (condition) { passed += 1; console.log(`  OK ${label}`); return; }
  failed += 1; console.error(`  FAIL ${label}`);
}

// ─── Deterministic $transaction-entry barrier ───

interface Barrier { engaged: () => boolean; uninstall: () => void; }

/**
 * Installs a wrapper on the production Prisma singleton's `$transaction`.
 * The first entrant waits until the second entrant arrives (or a fail-open
 * timeout fires), guaranteeing both requests are simultaneously in flight
 * through the production path. Restored afterwards. Install only around a
 * single concurrent pair — never across sequential setup.
 */
function installTxEntryBarrier(timeoutMs = 10000): Barrier {
  const target = prisma as unknown as Record<string, unknown>;
  const original = target.$transaction;
  let entered = 0;
  let engagedFlag = false;
  let release: (() => void) | null = null;
  const bothIn = new Promise<void>((resolve) => { release = resolve; });
  const bound = (original as (...args: unknown[]) => unknown).bind(prisma);
  target.$transaction = (...args: unknown[]) => {
    entered += 1;
    if (entered >= 2) {
      engagedFlag = true;
      if (release) release();
      return bound(...args);
    }
    return (async () => {
      await Promise.race([bothIn, new Promise((r) => setTimeout(r, timeoutMs))]);
      return bound(...args);
    })();
  };
  return {
    engaged: () => engagedFlag,
    uninstall: () => { target.$transaction = original; },
  };
}

// ─── Fixture helpers ───

async function cleanup() {
  await prisma.offeringTermAssignment.deleteMany({
    where: { offering: { schoolId: SCHOOL } },
  });
  await prisma.schoolYearOffering.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.schoolYearTermConfig.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.sectionMirror.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.instructionalCohort.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.subject.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.school.deleteMany({ where: { id: SCHOOL } });
}

function baseInput(overrides: Partial<OfferingInput> & { subjectId: number | null }): OfferingInput {
  return {
    gradeLevel: 7,
    programType: 'REGULAR',
    sectionMirrorId: null,
    cohortId: null,
    classification: 'CORE',
    weeklyMinutes: 200,
    rotationFamily: null,
    rotationOrder: null,
    termMode: 'ALL',
    termIdentities: [],
    ...overrides,
  };
}

type CreateOutcome = { ok: true; id: number } | { ok: false; code: string };

async function tryCreate(input: OfferingInput): Promise<CreateOutcome> {
  try {
    const row = await createRequirement(SCHOOL, YEAR, input, ACTOR);
    return { ok: true, id: row.id };
  } catch (error) {
    return { ok: false, code: (error as { code?: string }).code ?? `THROW:${(error as Error).message}` };
  }
}

/** Every concurrent pair runs under the barrier; returns both outcomes + engagement. */
async function concurrentPair(inputA: OfferingInput, inputB: OfferingInput): Promise<{ a: CreateOutcome; b: CreateOutcome; engaged: boolean }> {
  const barrier = installTxEntryBarrier();
  try {
    const [a, b] = await Promise.all([tryCreate(inputA), tryCreate(inputB)]);
    return { a, b, engaged: barrier.engaged() };
  } finally {
    barrier.uninstall();
  }
}

/** Active rows for this school/year carrying exactly the expected canonical identity. */
async function activeRowsWithIdentity(expected: RequirementIdentity): Promise<Array<{ id: number; version: number }>> {
  const rows = await prisma.schoolYearOffering.findMany({
    where: { schoolId: SCHOOL, schoolYearId: YEAR, isActive: true },
    select: {
      id: true, version: true, subjectId: true, gradeLevel: true, programType: true,
      sectionMirrorId: true, cohortId: true, rotationFamily: true,
    },
  });
  const want = requirementIdentityKey(expected);
  return rows
    .filter((r) => requirementIdentityKey(requirementIdentityOf({
      subjectId: r.subjectId, gradeLevel: r.gradeLevel, programType: r.programType,
      sectionMirrorId: r.sectionMirrorId, cohortId: r.cohortId, rotationFamily: r.rotationFamily,
    })) === want)
    .map((r) => ({ id: r.id, version: r.version }));
}

async function activeRowCount(): Promise<number> {
  return prisma.schoolYearOffering.count({ where: { schoolId: SCHOOL, schoolYearId: YEAR, isActive: true } });
}

function officerToken(): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ userId: ACTOR, role: 'officer', schoolId: SCHOOL, authSource: 'local' }, secret, { expiresIn: '1h' });
}

async function main() {
  await cleanup();
  await prisma.school.upsert({
    where: { id: SCHOOL },
    create: { id: SCHOOL, name: `SCA-02R2 School ${SCHOOL}`, shortName: `R2-${SCHOOL}` },
    update: {},
  });
  await prisma.enrollProSchoolYearMirror.create({
    data: { schoolId: SCHOOL, enrollProSchoolYearId: YEAR, yearLabel: 'R2 1', isActive: true },
  });
  await upsertTermConfig(SCHOOL, YEAR, { termCount: 2, termIdentities: ['Q1', 'Q2'] }, ACTOR);

  const mkSubject = (code: string, minutes = 200) => prisma.subject.create({
    data: {
      schoolId: SCHOOL, code, name: `${code} subject`, minMinutesPerWeek: minutes,
      preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 10], programScopes: ['REGULAR', 'STE'],
    },
  });
  // One fixture subject per attack so attacks never share canonical identity.
  const subjBase = await mkSubject('R2_BASE');
  const subjSec = await mkSubject('R2_SEC');
  const subjCoh = await mkSubject('R2_COH');
  const subjDiffA = await mkSubject('R2_DIFF_A');
  const subjDiffB = await mkSubject('R2_DIFF_B');
  const subjRet = await mkSubject('R2_RET');
  const subjRoute = await mkSubject('R2_ROUTE');

  const secG7 = await prisma.sectionMirror.create({
    data: {
      externalId: 9201, schoolId: SCHOOL, schoolYearId: YEAR, name: 'R2 7-A', gradeLevelId: 7,
      gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 45, enrolledCount: 40,
      programType: 'REGULAR', isActiveForScheduling: true, isStale: false,
    },
  });
  const cohort = await prisma.instructionalCohort.create({
    data: {
      schoolId: SCHOOL, schoolYearId: YEAR, cohortCode: 'R2-COHORT-1',
      specializationCode: 'R2_SPEC', specializationName: 'R2 Special', gradeLevel: 10,
      memberSectionIds: [],
    },
  });

  const { default: app } = await import('../app.js');
  const server = app.listen(PORT, () => {});

  try {
    console.log('=== C1: concurrent identical base-scope creates ===');
    {
      const input = baseInput({ subjectId: subjBase.id });
      const { a, b, engaged } = await concurrentPair(input, { ...input });
      const rows = await activeRowsWithIdentity(requirementIdentityOf(input));
      console.log(`  OUTCOME engaged=${engaged} a=${JSON.stringify(a)} b=${JSON.stringify(b)} activeRows=${rows.length}`);
      ok(engaged, 'barrier engaged: both requests simultaneously in flight');
      const wins = [a, b].filter((r) => r.ok);
      const losses = [a, b].filter((r) => !r.ok);
      ok(wins.length === 1, `exactly one create succeeds (got ${wins.length})`);
      const lossCode = losses.length === 1 ? String((losses[0] as { code: string }).code) : 'none (both succeeded)';
      ok(losses.length === 1 && lossCode === 'REQUIREMENT_EXISTS',
        `loser returns typed 409 REQUIREMENT_EXISTS (got ${lossCode})`);
      ok(rows.length === 1, `exactly one active canonical row persists (got ${rows.length})`);
      ok(!lossCode.startsWith('THROW:') && !lossCode.startsWith('P'),
        'loser error is a typed API code, not a raw Prisma/serialization throw');
    }

    console.log('=== C2: concurrent identical section-override creates ===');
    {
      const input = baseInput({ subjectId: subjSec.id, sectionMirrorId: secG7.id });
      const { a, b, engaged } = await concurrentPair(input, { ...input });
      const rows = await activeRowsWithIdentity(requirementIdentityOf(input));
      console.log(`  OUTCOME engaged=${engaged} a=${JSON.stringify(a)} b=${JSON.stringify(b)} activeRows=${rows.length}`);
      ok(engaged, 'barrier engaged for section-override pair');
      ok([a, b].filter((r) => r.ok).length === 1, 'exactly one section-override create succeeds');
      const loss = [a, b].find((r) => !r.ok) as { code: string } | undefined;
      ok(loss?.code === 'REQUIREMENT_EXISTS', `section-override loser is REQUIREMENT_EXISTS (got ${loss?.code})`);
      ok(rows.length === 1, `exactly one active section-override row persists (got ${rows.length})`);
    }

    console.log('=== C3: concurrent identical cohort-override creates ===');
    {
      const input = baseInput({
        subjectId: subjCoh.id, cohortId: cohort.id, gradeLevel: 10, programType: 'STE',
      });
      const { a, b, engaged } = await concurrentPair(input, { ...input });
      const rows = await activeRowsWithIdentity(requirementIdentityOf(input));
      console.log(`  OUTCOME engaged=${engaged} a=${JSON.stringify(a)} b=${JSON.stringify(b)} activeRows=${rows.length}`);
      ok(engaged, 'barrier engaged for cohort-override pair');
      ok([a, b].filter((r) => r.ok).length === 1, 'exactly one cohort-override create succeeds');
      const loss = [a, b].find((r) => !r.ok) as { code: string } | undefined;
      ok(loss?.code === 'REQUIREMENT_EXISTS', `cohort-override loser is REQUIREMENT_EXISTS (got ${loss?.code})`);
      ok(rows.length === 1, `exactly one active cohort-override row persists (got ${rows.length})`);
    }

    console.log('=== C4: concurrent creates with genuinely different identities ===');
    {
      const inputA = baseInput({ subjectId: subjDiffA.id, gradeLevel: 8 });
      const inputB = baseInput({ subjectId: subjDiffB.id, gradeLevel: 8 });
      const { a, b, engaged } = await concurrentPair(inputA, inputB);
      const rowsA = await activeRowsWithIdentity(requirementIdentityOf(inputA));
      const rowsB = await activeRowsWithIdentity(requirementIdentityOf(inputB));
      console.log(`  OUTCOME engaged=${engaged} a=${JSON.stringify(a)} b=${JSON.stringify(b)} rowsA=${rowsA.length} rowsB=${rowsB.length}`);
      ok(engaged, 'barrier engaged for distinct-identity pair (forced overlap)');
      ok(a.ok && b.ok, `both distinct-identity creates succeed (got ${JSON.stringify([a, b])})`);
      ok(rowsA.length === 1 && rowsB.length === 1, 'both distinct identities persist exactly once');
    }

    console.log('=== C5: retired identity followed by a new active create ===');
    {
      const input = baseInput({ subjectId: subjRet.id });
      const created = await createRequirement(SCHOOL, YEAR, input, ACTOR);
      const retired = await retireRequirementAtomic(created.id, SCHOOL, created.version, ACTOR);
      ok(retired.isActive === false, 'retire deactivates the row');
      const recreated = await tryCreate({ ...input });
      console.log(`  OUTCOME recreate=${JSON.stringify(recreated)}`);
      ok(recreated.ok, 'new active create after retire succeeds (retired row does not block)');
      const rows = await activeRowsWithIdentity(requirementIdentityOf(input));
      ok(rows.length === 1, `exactly one active row for the identity (got ${rows.length})`);
      ok(recreated.ok && rows[0].id === (recreated as { id: number }).id, 'the active row is the new create, not the retired row');
      const dup = await tryCreate({ ...input });
      ok(!dup.ok && (dup as { code: string }).code === 'REQUIREMENT_EXISTS', 're-duplicate of the new row is REQUIREMENT_EXISTS');
    }

    console.log('=== C6: route-level concurrent identical creates (201 + typed 409) ===');
    {
      const offering = baseInput({ subjectId: subjRoute.id });
      const post = () => fetch(`${BASE}/api/v1/curriculum-requirements/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerToken()}` },
        body: JSON.stringify({ schoolId: SCHOOL, schoolYearId: YEAR, offering }),
      }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));
      const barrier = installTxEntryBarrier();
      let pair: Array<{ status: number; body: unknown }>;
      try {
        pair = await Promise.all([post(), post()]);
      } finally {
        barrier.uninstall();
      }
      const rows = await activeRowsWithIdentity(requirementIdentityOf(offering));
      const statuses = pair.map((r) => r.status).sort();
      console.log(`  OUTCOME engaged=${barrier.engaged()} statuses=${JSON.stringify(statuses)} codes=${JSON.stringify(pair.map((r) => (r.body as { code?: string } | null)?.code))} activeRows=${rows.length}`);
      ok(barrier.engaged(), 'barrier engaged for route-level pair');
      ok(statuses[0] === 201 && statuses[1] === 409, `route pair yields one 201 + one 409 (got ${statuses.join(',')})`);
      const loser = pair.find((r) => r.status === 409);
      ok((loser?.body as { code?: string } | null)?.code === 'REQUIREMENT_EXISTS',
        `route loser carries code REQUIREMENT_EXISTS (got ${(loser?.body as { code?: string } | null)?.code})`);
      ok(rows.length === 1, `route race persists exactly one active row (got ${rows.length})`);
      ok((await activeRowCount()) === 7, `total active rows match the seven expected identities (got ${await activeRowCount()})`);
    }
  } finally {
    server.close();
    await cleanup();
  }

  const residue = await prisma.schoolYearOffering.count({ where: { schoolId: SCHOOL } })
    + await prisma.schoolYearTermConfig.count({ where: { schoolId: SCHOOL } })
    + await prisma.sectionMirror.count({ where: { schoolId: SCHOOL } })
    + await prisma.instructionalCohort.count({ where: { schoolId: SCHOOL } })
    + await prisma.subject.count({ where: { schoolId: SCHOOL } })
    + await prisma.enrollProSchoolYearMirror.count({ where: { schoolId: SCHOOL } });
  ok(residue === 0, `C7: zero residue on disposable school, mirrors, sections, cohort, subjects, terms (got ${residue})`);

  console.log(`\ncurriculum-requirements-concurrency: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
