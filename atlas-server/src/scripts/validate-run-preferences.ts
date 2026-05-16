import { PrismaClient } from '@prisma/client';

type DraftEntry = {
  sectionId?: number;
  subjectId?: number;
  facultyId?: number;
  roomId?: number | null;
  durationMinutes?: number;
  roomAssignmentReason?: string;
};

const prisma = new PrismaClient();

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

async function main() {
  const run = await prisma.generationRun.findFirst({
    where: { schoolId: 1, schoolYearId: 55, status: 'COMPLETED' },
    orderBy: { id: 'desc' },
  });

  if (!run) {
    console.log('No completed generation run found for school=1, schoolYear=55.');
    return;
  }

  const entries = (Array.isArray(run.draftEntries) ? run.draftEntries : []) as DraftEntry[];

  const [facultyRows, sectionRows, roomRows, subjectRows, facultySubjects] = await Promise.all([
    prisma.facultyMirror.findMany({
      where: { schoolId: 1, isActiveForScheduling: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        maxHoursPerWeek: true,
        ancillaryMinutesPerWeek: true,
      },
    }),
    prisma.sectionMirror.findMany({
      where: { schoolId: 1 },
      select: { externalId: true, name: true },
    }),
    prisma.room.findMany({
      where: { building: { schoolId: 1 } },
      select: { id: true, name: true, type: true },
    }),
    prisma.subject.findMany({
      where: { schoolId: 1 },
      select: { id: true, name: true, code: true },
    }),
    prisma.facultySubject.findMany({
      where: { schoolId: 1 },
      select: { facultyId: true, subjectId: true },
    }),
  ]);

  const sectionByExternalId = new Map(sectionRows.map((s) => [s.externalId, s.name]));
  const roomById = new Map(roomRows.map((r) => [r.id, r]));
  const subjectById = new Map(subjectRows.map((s) => [s.id, s]));

  const assignmentSet = new Set(facultySubjects.map((row) => `${row.facultyId}:${row.subjectId}`));

  const facultyLoad = new Map<number, number>();
  const facultyOutsideExplicit = new Map<number, Set<number>>();

  for (const entry of entries) {
    if (!entry.facultyId) continue;
    facultyLoad.set(entry.facultyId, (facultyLoad.get(entry.facultyId) ?? 0) + (entry.durationMinutes ?? 0));

    if (entry.subjectId && !assignmentSet.has(`${entry.facultyId}:${entry.subjectId}`)) {
      if (!facultyOutsideExplicit.has(entry.facultyId)) {
        facultyOutsideExplicit.set(entry.facultyId, new Set<number>());
      }
      facultyOutsideExplicit.get(entry.facultyId)?.add(entry.subjectId);
    }
  }

  const overloads = facultyRows
    .map((f) => {
      const assigned = facultyLoad.get(f.id) ?? 0;
      const maxMinutes = Math.round((f.maxHoursPerWeek ?? 0) * 60);
      const ancillary = Math.max(0, Math.round(f.ancillaryMinutesPerWeek ?? 0));
      const effective = Math.max(0, maxMinutes - ancillary);
      return {
        id: f.id,
        name: `${f.lastName}, ${f.firstName}`,
        assigned,
        effective,
        maxMinutes,
        overBy: assigned - effective,
      };
    })
    .filter((row) => row.assigned > row.effective)
    .sort((a, b) => b.overBy - a.overBy);

  const nonSpecialSectionRooms = new Map<number, Set<number>>();
  for (const entry of entries) {
    if (!entry.sectionId || !entry.roomId) continue;
    const reason = entry.roomAssignmentReason ?? '';
    const room = roomById.get(entry.roomId);
    const roomType = normalize(room?.type);

    const isSpecialReason = reason.includes('SPECIALIZED') || reason.includes('FALLBACK');
    const isSpecialRoom = ['LAB', 'COMPUTER_LAB', 'GYM', 'WORKSHOP', 'TLE_LAB'].includes(roomType);
    if (isSpecialReason || isSpecialRoom) continue;

    if (!nonSpecialSectionRooms.has(entry.sectionId)) {
      nonSpecialSectionRooms.set(entry.sectionId, new Set<number>());
    }
    nonSpecialSectionRooms.get(entry.sectionId)?.add(entry.roomId);
  }

  const multiRoomSections = [...nonSpecialSectionRooms.entries()]
    .filter(([, rooms]) => rooms.size > 1)
    .map(([sectionId, rooms]) => ({
      sectionId,
      sectionName: sectionByExternalId.get(sectionId) ?? `Section ${sectionId}`,
      roomCodes: [...rooms]
        .map((roomId) => roomById.get(roomId)?.name ?? `Room ${roomId}`)
        .sort(),
    }))
    .sort((a, b) => a.sectionName.localeCompare(b.sectionName));

  const aquinoElpidio = facultyRows.filter(
    (f) => normalize(f.lastName) === 'AQUINO' && normalize(f.firstName) === 'ELPIDIO',
  );

  console.log(`Run ${run.id} validation`);
  console.log(`Entries: ${entries.length}`);
  const summary = (run.summary ?? {}) as {
    homeRoomAttemptedCount?: number;
    homeRoomAssignedCount?: number;
    homeRoomSuccessRate?: number;
    resourceDiagnostics?: {
      homeRoomFallbackDiagnostics?: {
        homeRoomOccupied?: number;
        noSameZoneStandardRoom?: number;
        onlySpecializedRoomsAvailable?: number;
        policyOrShiftWindowIncompatible?: number;
      };
    };
  };
  const successRate = summary.homeRoomSuccessRate ?? 0;
  const targetMin = 70;
  const targetMax = 85;
  const meetsTarget = successRate >= targetMin && successRate <= targetMax;

  console.log(`Home room attempted: ${summary.homeRoomAttemptedCount ?? 0}`);
  console.log(`Home room assigned: ${summary.homeRoomAssignedCount ?? 0}`);
  console.log(`Home room success rate: ${successRate}`);
  console.log(`Home room KPI band: ${targetMin}-${targetMax}`);
  console.log(`Home room KPI status: ${meetsTarget ? 'PASS' : 'FAIL'}`);
  if (!meetsTarget) {
    console.log('KPI verdict: NO-GO (below accepted home-room target band)');
  }

  const fallbackDiagnostics = summary.resourceDiagnostics?.homeRoomFallbackDiagnostics;
  if (fallbackDiagnostics) {
    console.log('\nHome-room fallback diagnostics:');
    console.log(`- occupied home room: ${fallbackDiagnostics.homeRoomOccupied ?? 0}`);
    console.log(`- no same-zone standard room: ${fallbackDiagnostics.noSameZoneStandardRoom ?? 0}`);
    console.log(`- only specialized rooms available: ${fallbackDiagnostics.onlySpecializedRoomsAvailable ?? 0}`);
    console.log(`- policy or shift-window incompatible: ${fallbackDiagnostics.policyOrShiftWindowIncompatible ?? 0}`);
  }

  console.log(`\nFaculty overload count: ${overloads.length}`);
  if (overloads.length > 0) {
    console.log('Top overloads:');
    for (const item of overloads.slice(0, 10)) {
      console.log(`- ${item.name} [${item.id}] assigned=${item.assigned} effective=${item.effective} overBy=${item.overBy}`);
    }
  }

  console.log(`\nSections with >1 non-special room: ${multiRoomSections.length}`);
  for (const item of multiRoomSections.slice(0, 10)) {
    console.log(`- ${item.sectionName} (${item.sectionId}) -> ${item.roomCodes.join(', ')}`);
  }

  console.log('\nAQUINO, ELPIDIO records:');
  for (const member of aquinoElpidio) {
    const assigned = facultyLoad.get(member.id) ?? 0;
    const maxMinutes = Math.round((member.maxHoursPerWeek ?? 0) * 60);
    const ancillary = Math.max(0, Math.round(member.ancillaryMinutesPerWeek ?? 0));
    const effective = Math.max(0, maxMinutes - ancillary);

    const outside = [...(facultyOutsideExplicit.get(member.id) ?? new Set<number>())]
      .map((subjectId) => subjectById.get(subjectId)?.code ?? subjectById.get(subjectId)?.name ?? String(subjectId))
      .sort();

    console.log(
      `- id=${member.id} assigned=${assigned} effective=${effective} outsideExplicitSubjects=${outside.length} [${outside.join(', ')}]`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
