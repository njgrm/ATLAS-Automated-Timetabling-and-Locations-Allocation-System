import { prisma } from '../lib/prisma.js';
import {
	getPublishedFacultySchedule,
	getPublishedRoomSchedule,
	getPublishedSchedulePayload,
	getPublishedSectionSchedule,
} from '../services/published-schedule.service.js';

type PublishedEntry = Awaited<ReturnType<typeof getPublishedSchedulePayload>>['entries'][number];

function isRunPublished(summary: unknown): boolean {
	return Boolean(summary && typeof summary === 'object' && (summary as Record<string, unknown>).isPublished === true);
}

function entryIds(entries: PublishedEntry[]): string[] {
	return entries.map((entry) => entry.entryId);
}

function assertEqualIds(label: string, actual: PublishedEntry[], expected: PublishedEntry[]) {
	const actualIds = entryIds(actual);
	const expectedIds = entryIds(expected);
	if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
		throw new Error(`${label} mismatch. expected=${JSON.stringify(expectedIds)} actual=${JSON.stringify(actualIds)}`);
	}
	console.log(`PASS ${label}: ${actualIds.length} entries`);
}

async function resolvePublishedScope() {
	const candidates = await prisma.generationRun.findMany({
		where: { status: 'COMPLETED' },
		orderBy: [{ createdAt: 'desc' }],
		select: {
			id: true,
			schoolId: true,
			schoolYearId: true,
			summary: true,
		},
		take: 200,
	});

	const publishedRun = candidates.find((candidate) => isRunPublished(candidate.summary));
	if (!publishedRun) {
		throw new Error('No published generation run found for targeted-read probe.');
	}

	return publishedRun;
}

async function main() {
	console.log('--- Probing Targeted Published Schedule Reads ---');

	const publishedRun = await resolvePublishedScope();
	const { schoolId, schoolYearId } = publishedRun;
	const fullPayload = await getPublishedSchedulePayload(schoolId, schoolYearId);
	const fullEntries = fullPayload.entries;

	if (fullPayload.source.runId !== publishedRun.id) {
		throw new Error(`Resolved run mismatch. candidate=${publishedRun.id} payload=${fullPayload.source.runId}`);
	}
	if (fullEntries.length === 0) {
		throw new Error(`Published run ${publishedRun.id} has no entries to probe.`);
	}

	const facultyEntry = fullEntries.find((entry) => entry.faculty?.id != null);
	const roomEntry = fullEntries.find((entry) => entry.room?.id != null);
	const sectionEntry = fullEntries.find((entry) => entry.section?.id != null);

	if (!facultyEntry) throw new Error('Published payload has no faculty-linked entry to probe.');
	if (!roomEntry) throw new Error('Published payload has no room-linked entry to probe.');
	if (!sectionEntry) throw new Error('Published payload has no section-linked entry to probe.');

	const facultyId = facultyEntry.faculty.id;
	const roomId = roomEntry.room.id;
	const sectionId = sectionEntry.section.id;
	const missingId = 999_999_999;

	if (facultyId == null) throw new Error('Selected faculty probe entry has no faculty ID.');
	if (roomId == null) throw new Error('Selected room probe entry has no room ID.');
	if (sectionId == null) throw new Error('Selected section probe entry has no section ID.');

	console.log(`Published run: ${publishedRun.id}`);
	console.log(`School: ${schoolId}, school year: ${schoolYearId}`);
	console.log(`Full revision-effective entries: ${fullEntries.length}`);
	console.log(`Source marker: ${fullPayload.source.revisionMarker}`);

	const memoryBefore = process.memoryUsage().heapUsed;
	console.time('Targeted reads');
	const [facultyPayload, roomPayload, sectionPayload, missingFacultyPayload] = await Promise.all([
		getPublishedFacultySchedule(schoolId, facultyId, schoolYearId),
		getPublishedRoomSchedule(schoolId, roomId, schoolYearId),
		getPublishedSectionSchedule(schoolId, sectionId, schoolYearId),
		getPublishedFacultySchedule(schoolId, missingId, schoolYearId),
	]);
	console.timeEnd('Targeted reads');
	const memoryAfter = process.memoryUsage().heapUsed;

	for (const payload of [facultyPayload, roomPayload, sectionPayload, missingFacultyPayload]) {
		if (payload.source.runId !== fullPayload.source.runId) {
			throw new Error(`Targeted payload resolved run ${payload.source.runId}, expected ${fullPayload.source.runId}.`);
		}
		if (payload.source.revisionMarker !== fullPayload.source.revisionMarker) {
			throw new Error(`Targeted payload revision marker mismatch for run ${payload.source.runId}.`);
		}
	}

	assertEqualIds(
		`faculty ${facultyId}`,
		facultyPayload.entries,
		fullEntries.filter((entry) => entry.faculty.id === facultyId),
	);
	assertEqualIds(
		`room ${roomId}`,
		roomPayload.entries,
		fullEntries.filter((entry) => entry.room.id === roomId),
	);
	assertEqualIds(
		`section ${sectionId}`,
		sectionPayload.entries,
		fullEntries.filter((entry) => entry.section.id === sectionId),
	);
	assertEqualIds(`missing faculty ${missingId}`, missingFacultyPayload.entries, []);

	console.log(`Targeted heap delta: ${Math.round((memoryAfter - memoryBefore) / 1024 / 1024)} MB`);
	console.log('PASS targeted published schedule slice reads match full revision-effective truth.');
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
