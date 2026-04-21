/**
 * Wave 3.5.2 Realistic Seeder — EnrollPro-first by default, fixture mode by explicit opt-in.
 *
 * Default behavior mirrors live EnrollPro contracts into ATLAS caches and mirrors.
 * The legacy ATLAS-owned fixture dataset remains available only for explicit dev-only use.
 * Optional campus-map seeding remains supported in both modes.
 *
 * Usage:
 *   npx tsx src/scripts/seed-realistic.ts --schoolId=1 --schoolYearId=1 --reset
 *   npx tsx src/scripts/seed-realistic.ts --schoolId=1 --schoolYearId=1 --mode=atlas-fixture --confirmFixtureBypass=true --withCachedSnapshots
 *   npx tsx src/scripts/seed-realistic.ts --schoolId=1 --schoolYearId=1 --seedMap=true --resetMap=true
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { RoomType } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { generateBuildingShortCode } from '../lib/building-short-code.js';
import type { ExternalFaculty } from '../services/faculty-adapter.js';
import { syncCohorts } from '../services/cohort.service.js';
import { syncFacultyFromExternal } from '../services/faculty.service.js';
import { getSectionSummary } from '../services/section.service.js';
import type { ExternalSection, ProgramType, SectionsByGrade } from '../services/section-adapter.js';
import {
	buildRealisticGradeBlueprints,
	buildRealisticTeacherSeeds,
	REALISTIC_SECTION_COUNT,
	REALISTIC_TEACHER_COUNT,
} from './realistic-jhs-dataset.js';

type CliValue = string | boolean | undefined;
type SeederMode = 'enrollpro-source' | 'atlas-fixture';

interface SeederOptions {
	schoolId: number;
	schoolYearId: number;
	mode: SeederMode;
	reset: boolean;
	withCachedSnapshots: boolean;
	seedMap: boolean;
	resetMap: boolean;
	confirmFixtureBypass: boolean;
	authUserId: number;
	authRole: string;
	authToken: string | null;
}

interface SeedTeacher extends ExternalFaculty {
	maxHoursPerWeek: number;
}

interface SeedRoom {
	name: string;
	floor: number;
	type: RoomType;
	capacity: number | null;
	floorPosition: number;
	isTeachingSpace?: boolean;
}

interface SeedBuilding {
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation?: number;
	color: string;
	floorCount: number;
	isTeachingBuilding?: boolean;
	rooms: SeedRoom[];
}

interface ExistingState {
	facultyMirrors: number;
	facultySnapshots: number;
	sectionSnapshots: number;
	instructionalCohorts: number;
	buildings: number;
	rooms: number;
	campusImagePresent: boolean;
}

interface MapSeedSummary {
	buildingsCreated: number;
	buildingsMatched: number;
	roomsCreated: number;
	roomsMatched: number;
	mapResetApplied: boolean;
}

interface AuthTokenResolution {
	token: string | undefined;
	source: 'cli' | 'service-env' | 'generated-jwt' | 'none';
}

const USAGE =
	'Usage: npx tsx src/scripts/seed-realistic.ts --schoolId=N --schoolYearId=N [--mode=enrollpro-source|atlas-fixture] [--reset] [--withCachedSnapshots] [--seedMap=true|false] [--resetMap=true|false] [--confirmFixtureBypass=true] [--authUserId=N] [--authRole=SYSTEM_ADMIN] [--authToken=TOKEN]';

const WAVE_RESET_LABELS = [
	'faculty_mirrors (target school)',
	'faculty_snapshots (target school + school year)',
	'section_snapshots (target school + school year)',
	'instructional_cohorts (target school + school year)',
];

const DEFAULT_PRESERVED_MAP_LABELS = [
	'buildings',
	'rooms',
	'campus_image_url',
];

const NON_TEACHING_ROOM_TYPES = new Set<RoomType>(['LIBRARY', 'FACULTY_ROOM', 'OFFICE', 'OTHER']);

const REALISTIC_CAMPUS_BUILDINGS: SeedBuilding[] = [
	{
		name: 'Academic Building 1',
		x: 48,
		y: 56,
		width: 238,
		height: 168,
		color: '#2563eb',
		floorCount: 3,
		rooms: [
			{ name: 'Room 101', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 0 },
			{ name: 'Room 102', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
			{ name: 'Room 103', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
			{ name: 'Room 201', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 0 },
			{ name: 'Room 202', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
			{ name: 'Room 203', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
			{ name: 'Room 301', floor: 3, type: 'CLASSROOM', capacity: 42, floorPosition: 0 },
			{ name: 'Room 302', floor: 3, type: 'CLASSROOM', capacity: 42, floorPosition: 1 },
		],
	},
	{
		name: 'Academic Building 2',
		x: 328,
		y: 52,
		width: 230,
		height: 170,
		color: '#0f766e',
		floorCount: 3,
		rooms: [
			{ name: 'Room 104', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 0 },
			{ name: 'Room 105', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
			{ name: 'Room 204', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 0 },
			{ name: 'Room 205', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
			{ name: 'Room 206', floor: 2, type: 'CLASSROOM', capacity: 42, floorPosition: 2 },
			{ name: 'Room 304', floor: 3, type: 'CLASSROOM', capacity: 42, floorPosition: 0 },
			{ name: 'Room 305', floor: 3, type: 'CLASSROOM', capacity: 42, floorPosition: 1 },
		],
	},
	{
		name: 'Science and Innovation Center',
		x: 612,
		y: 56,
		width: 236,
		height: 164,
		color: '#16a34a',
		floorCount: 2,
		rooms: [
			{ name: 'Chemistry Lab', floor: 1, type: 'LABORATORY', capacity: 40, floorPosition: 0 },
			{ name: 'Biology Lab', floor: 1, type: 'LABORATORY', capacity: 40, floorPosition: 1 },
			{ name: 'Physics Lab', floor: 2, type: 'LABORATORY', capacity: 36, floorPosition: 0 },
			{ name: 'Computer Lab 1', floor: 2, type: 'COMPUTER_LAB', capacity: 40, floorPosition: 1 },
			{ name: 'STE Research Room', floor: 2, type: 'CLASSROOM', capacity: 28, floorPosition: 2 },
		],
	},
	{
		name: 'MAPEH and Wellness Hub',
		x: 64,
		y: 286,
		width: 258,
		height: 180,
		color: '#ea580c',
		floorCount: 1,
		rooms: [
			{ name: 'Covered Court', floor: 1, type: 'GYMNASIUM', capacity: 160, floorPosition: 0 },
			{ name: 'Dance Studio', floor: 1, type: 'CLASSROOM', capacity: 32, floorPosition: 1 },
			{ name: 'Music Room', floor: 1, type: 'CLASSROOM', capacity: 30, floorPosition: 2 },
			{ name: 'Arts Studio', floor: 1, type: 'CLASSROOM', capacity: 28, floorPosition: 3 },
		],
	},
	{
		name: 'TLE and Livelihood Center',
		x: 362,
		y: 278,
		width: 256,
		height: 188,
		color: '#d97706',
		floorCount: 2,
		rooms: [
			{ name: 'Industrial Arts Shop', floor: 1, type: 'TLE_WORKSHOP', capacity: 35, floorPosition: 0 },
			{ name: 'Electronics Lab', floor: 1, type: 'TLE_WORKSHOP', capacity: 32, floorPosition: 1 },
			{ name: 'Home Economics Lab', floor: 2, type: 'LABORATORY', capacity: 34, floorPosition: 0 },
			{ name: 'AFA Demonstration Room', floor: 2, type: 'LABORATORY', capacity: 34, floorPosition: 1 },
			{ name: 'Entrepreneurship Room', floor: 2, type: 'CLASSROOM', capacity: 30, floorPosition: 2 },
		],
	},
	{
		name: 'Admin and Learning Commons',
		x: 654,
		y: 280,
		width: 208,
		height: 182,
		color: '#7c3aed',
		floorCount: 2,
		isTeachingBuilding: false,
		rooms: [
			{ name: 'Learning Commons', floor: 1, type: 'LIBRARY', capacity: 80, floorPosition: 0, isTeachingSpace: false },
			{ name: 'Guidance Office', floor: 1, type: 'OFFICE', capacity: 8, floorPosition: 1, isTeachingSpace: false },
			{ name: 'Principal Office', floor: 2, type: 'OFFICE', capacity: 6, floorPosition: 0, isTeachingSpace: false },
			{ name: 'Faculty Room', floor: 2, type: 'FACULTY_ROOM', capacity: 20, floorPosition: 1, isTeachingSpace: false },
			{ name: 'Registrar Annex', floor: 2, type: 'OFFICE', capacity: 6, floorPosition: 2, isTeachingSpace: false },
		],
	},
];

function parseBooleanFlag(value: CliValue, defaultValue = false): boolean {
	if (value === undefined) return defaultValue;
	if (value === true) return true;
	const normalized = String(value).trim().toLowerCase();
	if (['true', '1', 'yes'].includes(normalized)) return true;
	if (['false', '0', 'no'].includes(normalized)) return false;
	throw new Error(`Invalid boolean flag value: ${value}`);
}

function parseArgs(): SeederOptions {
	const args = process.argv.slice(2);
	const parsed: Record<string, string | boolean> = {};

	for (const arg of args) {
		if (!arg.startsWith('--')) continue;
		const [key, val] = arg.slice(2).split('=');
		parsed[key] = val ?? true;
	}

	const options: SeederOptions = {
		schoolId: Number(parsed.schoolId) || 0,
		schoolYearId: Number(parsed.schoolYearId) || 0,
		mode: parsed.mode === 'atlas-fixture' ? 'atlas-fixture' : 'enrollpro-source',
		reset: parseBooleanFlag(parsed.reset, false),
		withCachedSnapshots: parseBooleanFlag(parsed.withCachedSnapshots, false),
		seedMap: parseBooleanFlag(parsed.seedMap, false),
		resetMap: parseBooleanFlag(parsed.resetMap, false),
		confirmFixtureBypass: parseBooleanFlag(parsed.confirmFixtureBypass, false),
		authUserId: Number(parsed.authUserId) || 1,
		authRole: typeof parsed.authRole === 'string' && parsed.authRole.trim().length > 0 ? parsed.authRole.trim() : 'SYSTEM_ADMIN',
		authToken: typeof parsed.authToken === 'string' && parsed.authToken.trim().length > 0 ? parsed.authToken.trim() : null,
	};

	if (options.resetMap && !options.seedMap) {
		throw new Error('--resetMap=true is only allowed when --seedMap=true.');
	}

	if (parsed.mode && parsed.mode !== 'enrollpro-source' && parsed.mode !== 'atlas-fixture') {
		throw new Error(`Unsupported --mode value: ${parsed.mode}`);
	}

	return options;
}

function createTeacherExternalId(schoolId: number, teacherIndex: number): number {
	return schoolId * 10000 + teacherIndex + 1;
}

function roomStableKey(name: string, floor: number): string {
	return `${floor}:${name.trim().toLowerCase()}`;
}

function generateSectionsByGrade(): SectionsByGrade[] {
	const gradeBlueprints = buildRealisticGradeBlueprints();

	return gradeBlueprints.map((grade, index) => ({
		gradeLevelId: index + 1,
		gradeLevelName: grade.gradeLevelName,
		displayOrder: grade.displayOrder,
		sections: grade.sections.map((section) => ({
			id: section.sequence,
			name: section.name,
			maxCapacity: section.maxCapacity,
			enrolledCount: section.enrolledCount,
			gradeLevelId: index + 1,
			gradeLevelName: grade.gradeLevelName,
			programType: (section.programCode ?? 'REGULAR') as ProgramType,
			programCode: section.programCode,
			programName: section.programName,
			admissionMode: section.admissionMode,
			adviserId: null,
			adviserName: null,
		} satisfies ExternalSection)),
	}));
}

function generateTeachers(schoolId: number, sections: ExternalSection[]): SeedTeacher[] {
	return buildRealisticTeacherSeeds().map((teacher, teacherIndex) => {
		const adviserSection = sections[teacherIndex] ?? null;
		return {
			id: createTeacherExternalId(schoolId, teacherIndex),
			firstName: teacher.firstName,
			lastName: teacher.lastName,
			department: teacher.specialization,
			employmentStatus: teacher.employmentStatus,
			isClassAdviser: adviserSection != null,
			advisoryEquivalentHours: adviserSection ? 5 : 0,
			canTeachOutsideDepartment: teacher.canTeachOutsideDepartment,
			contactInfo: teacher.email,
			advisedSectionId: adviserSection?.id ?? null,
			advisedSectionName: adviserSection?.name ?? null,
			maxHoursPerWeek: teacher.maxHoursPerWeek,
		};
	});
}

function generateTleCohorts(gradeLevels: SectionsByGrade[]) {
	return gradeLevels.flatMap((gradeLevel) => {
		const sectionIds = gradeLevel.sections.map((section) => section.id);
		const iaCount = gradeLevel.gradeLevelId === 1 ? 6 : 5;
		const heCount = gradeLevel.gradeLevelId === 1 ? 6 : 5;
		const buckets = [
			{
				cohortCode: `G${gradeLevel.displayOrder}-TLE-IA`,
				specializationCode: 'IA',
				specializationName: 'Industrial Arts',
				gradeLevel: gradeLevel.displayOrder,
				memberSectionIds: sectionIds.slice(0, iaCount),
				preferredRoomType: 'TLE_WORKSHOP' as const,
			},
			{
				cohortCode: `G${gradeLevel.displayOrder}-TLE-HE`,
				specializationCode: 'HE',
				specializationName: 'Home Economics',
				gradeLevel: gradeLevel.displayOrder,
				memberSectionIds: sectionIds.slice(iaCount, iaCount + heCount),
				preferredRoomType: 'LABORATORY' as const,
			},
			{
				cohortCode: `G${gradeLevel.displayOrder}-TLE-AFA`,
				specializationCode: 'AFA',
				specializationName: 'Agri-Fishery Arts',
				gradeLevel: gradeLevel.displayOrder,
				memberSectionIds: sectionIds.slice(iaCount + heCount),
				preferredRoomType: 'LABORATORY' as const,
			},
		];

		return buckets.map((bucket) => ({
			...bucket,
			expectedEnrollment: gradeLevel.sections
				.filter((section) => bucket.memberSectionIds.includes(section.id))
				.reduce((total, section) => total + section.enrolledCount, 0),
		}));
	});
}

async function assertSchoolExists(schoolId: number) {
	const school = await prisma.school.findUnique({
		where: { id: schoolId },
		select: { id: true, name: true, shortName: true },
	});

	if (!school) {
		throw new Error(`School ${schoolId} does not exist. Seed the base school data first.`);
	}

	return school;
}

async function collectExistingState(schoolId: number, schoolYearId: number): Promise<ExistingState> {
	const [facultyMirrors, facultySnapshots, sectionSnapshots, instructionalCohorts, buildings, rooms, school] = await prisma.$transaction([
		prisma.facultyMirror.count({ where: { schoolId } }),
		prisma.facultySnapshot.count({ where: { schoolId, schoolYearId } }),
		prisma.sectionSnapshot.count({ where: { schoolId, schoolYearId } }),
		prisma.instructionalCohort.count({ where: { schoolId, schoolYearId } }),
		prisma.building.count({ where: { schoolId } }),
		prisma.room.count({ where: { building: { schoolId } } }),
		prisma.school.findUnique({ where: { id: schoolId }, select: { campusImageUrl: true } }),
	]);

	return {
		facultyMirrors,
		facultySnapshots,
		sectionSnapshots,
		instructionalCohorts,
		buildings,
		rooms,
		campusImagePresent: !!school?.campusImageUrl,
	};
}

function printPreflightSummary(
	options: SeederOptions,
	school: { id: number; name: string; shortName: string },
	state: ExistingState,
) {
	const resetActions = [
		...(options.reset ? WAVE_RESET_LABELS : []),
		...(options.resetMap ? ['buildings (target school)', 'rooms (via building cascade)', 'campus_image_url (target school)'] : []),
	];
	const preserved = options.resetMap ? [] : DEFAULT_PRESERVED_MAP_LABELS;

	console.log('[seed-realistic] Preflight summary');
	console.log(`  School: ${school.name} (#${school.id}, ${school.shortName})`);
	console.log(`  School year: ${options.schoolYearId}`);
	console.log(`  Mode: ${options.mode}`);
	console.log('  Existing state:');
	console.log(`    faculty_mirrors=${state.facultyMirrors}`);
	console.log(`    faculty_snapshots=${state.facultySnapshots}`);
	console.log(`    section_snapshots=${state.sectionSnapshots}`);
	console.log(`    instructional_cohorts=${state.instructionalCohorts}`);
	console.log(`    buildings=${state.buildings}`);
	console.log(`    rooms=${state.rooms}`);
	console.log(`    campus_image_url=${state.campusImagePresent ? 'present' : 'none'}`);
	console.log('  Reset actions:');
	if (resetActions.length === 0) {
		console.log('    - none');
	} else {
		for (const action of resetActions) {
			console.log(`    - ${action}`);
		}
	}
	console.log('  Preserved:');
	if (preserved.length === 0) {
		console.log('    - none (map reset explicitly requested)');
	} else {
		for (const entry of preserved) {
			console.log(`    - ${entry}`);
		}
	}
	console.log('  Requested operations:');
	console.log(`    - reset=${options.reset}`);
	console.log(`    - withCachedSnapshots=${options.withCachedSnapshots}`);
	console.log(`    - seedMap=${options.seedMap}`);
	console.log(`    - resetMap=${options.resetMap}`);
	if (options.mode === 'atlas-fixture') {
		console.log(`    - confirmFixtureBypass=${options.confirmFixtureBypass}`);
	}
	console.log('[seed-realistic] Confirmation: proceeding non-interactively because the requested flags were provided explicitly.');
}

async function resetWaveData(options: SeederOptions) {
	await prisma.$transaction([
		prisma.facultyMirror.deleteMany({ where: { schoolId: options.schoolId } }),
		prisma.facultySnapshot.deleteMany({ where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId } }),
		prisma.sectionSnapshot.deleteMany({ where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId } }),
		prisma.instructionalCohort.deleteMany({ where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId } }),
	]);
}

async function resetMapData(schoolId: number) {
	await prisma.$transaction([
		prisma.building.deleteMany({ where: { schoolId } }),
		prisma.school.update({
			where: { id: schoolId },
			data: { campusImageUrl: null },
		}),
	]);
}

async function upsertFacultyMirrors(schoolId: number, teachers: SeedTeacher[]) {
	const syncedAt = new Date();

	for (const teacher of teachers) {
		await prisma.facultyMirror.upsert({
			where: {
				schoolId_externalId: {
					schoolId,
					externalId: teacher.id,
				},
			},
			update: {
				firstName: teacher.firstName,
				lastName: teacher.lastName,
				department: teacher.department,
				employmentStatus: teacher.employmentStatus ?? 'PERMANENT',
				contactInfo: teacher.contactInfo,
				isClassAdviser: teacher.isClassAdviser ?? false,
				advisoryEquivalentHours: teacher.advisoryEquivalentHours ?? 0,
				canTeachOutsideDepartment: teacher.canTeachOutsideDepartment ?? false,
				maxHoursPerWeek: teacher.maxHoursPerWeek,
				advisedSectionId: teacher.advisedSectionId ?? null,
				advisedSectionName: teacher.advisedSectionName ?? null,
				isActiveForScheduling: true,
				lastSyncedAt: syncedAt,
				isStale: false,
				staleReason: null,
				staleAt: null,
			},
			create: {
				externalId: teacher.id,
				schoolId,
				firstName: teacher.firstName,
				lastName: teacher.lastName,
				department: teacher.department,
				employmentStatus: teacher.employmentStatus ?? 'PERMANENT',
				contactInfo: teacher.contactInfo,
				isClassAdviser: teacher.isClassAdviser ?? false,
				advisoryEquivalentHours: teacher.advisoryEquivalentHours ?? 0,
				canTeachOutsideDepartment: teacher.canTeachOutsideDepartment ?? false,
				maxHoursPerWeek: teacher.maxHoursPerWeek,
				advisedSectionId: teacher.advisedSectionId ?? null,
				advisedSectionName: teacher.advisedSectionName ?? null,
				isActiveForScheduling: true,
				lastSyncedAt: syncedAt,
				isStale: false,
			},
		});
	}
}

async function saveFacultySnapshot(schoolId: number, schoolYearId: number, teachers: SeedTeacher[]) {
	const payload: ExternalFaculty[] = teachers.map((teacher) => ({
		id: teacher.id,
		firstName: teacher.firstName,
		lastName: teacher.lastName,
		department: teacher.department,
		employmentStatus: teacher.employmentStatus,
		isClassAdviser: teacher.isClassAdviser,
		advisoryEquivalentHours: teacher.advisoryEquivalentHours,
		canTeachOutsideDepartment: teacher.canTeachOutsideDepartment,
		contactInfo: teacher.contactInfo,
		advisedSectionId: teacher.advisedSectionId ?? null,
		advisedSectionName: teacher.advisedSectionName ?? null,
	}));

	const checksum = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

	await prisma.facultySnapshot.upsert({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		update: {
			payload: payload as any,
			source: 'stub',
			fetchedAt: new Date(),
			checksum,
		},
		create: {
			schoolId,
			schoolYearId,
			payload: payload as any,
			source: 'stub',
			fetchedAt: new Date(),
			checksum,
		},
	});
}

async function saveSectionSnapshot(schoolId: number, schoolYearId: number, gradeLevels: SectionsByGrade[]) {
	const checksum = crypto.createHash('sha256').update(JSON.stringify(gradeLevels)).digest('hex');

	await prisma.sectionSnapshot.upsert({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		update: {
			payload: gradeLevels as any,
			source: 'stub',
			fetchedAt: new Date(),
			checksum,
		},
		create: {
			schoolId,
			schoolYearId,
			payload: gradeLevels as any,
			source: 'stub',
			fetchedAt: new Date(),
			checksum,
		},
	});
}

function resolveEnrollProAuthToken(options: SeederOptions): AuthTokenResolution {
	if (options.authToken) {
		return { token: options.authToken, source: 'cli' };
	}

	if (process.env.ENROLLPRO_SERVICE_TOKEN) {
		return { token: process.env.ENROLLPRO_SERVICE_TOKEN, source: 'service-env' };
	}

	const jwtSecret = process.env.JWT_SECRET;
	if (!jwtSecret) {
		return { token: undefined, source: 'none' };
	}

	return {
		token: jwt.sign(
			{ userId: options.authUserId, role: options.authRole },
			jwtSecret,
			{ expiresIn: '15m' },
		),
		source: 'generated-jwt',
	};
}

function assertNonFixtureSource(
	domain: 'faculty' | 'sections' | 'cohorts',
	source: string,
): void {
	if (source === 'stub' || source === 'auto-fallback' || source === 'preserved-existing') {
		throw new Error(`enrollpro-source mode rejected ${domain} source \"${source}\". Upstream contracts or cached upstream snapshots are required.`);
	}
}

async function runFixtureMode(options: SeederOptions) {
	const gradeLevels = generateSectionsByGrade();
	const sections = gradeLevels.flatMap((gradeLevel) => gradeLevel.sections);
	const teachers = generateTeachers(options.schoolId, sections);

	console.warn('[seed-realistic] WARNING: atlas-fixture mode seeds ATLAS-owned faculty/section/cohort data and is intended for explicit dev fallback only.');
	console.log(`[seed-realistic] Upserting ${teachers.length} fixture faculty mirrors...`);
	await upsertFacultyMirrors(options.schoolId, teachers);

	if (options.withCachedSnapshots) {
		console.log('[seed-realistic] Saving fixture faculty and section snapshots...');
		await saveFacultySnapshot(options.schoolId, options.schoolYearId, teachers);
		await saveSectionSnapshot(options.schoolId, options.schoolYearId, gradeLevels);
	}

	console.log('[seed-realistic] Upserting fixture TLE instructional cohorts...');
	const cohorts = await upsertCohorts(options.schoolId, options.schoolYearId, gradeLevels);

	return {
		teachers: teachers.length,
		sections: sections.length,
		cohorts,
	};
}

async function runEnrollProSourceMode(options: SeederOptions) {
	const auth = resolveEnrollProAuthToken(options);
	if (!auth.token) {
		throw new Error('enrollpro-source mode requires an EnrollPro auth token. Provide --authToken, ENROLLPRO_SERVICE_TOKEN, or JWT_SECRET plus an active EnrollPro user id.');
	}

	console.log(`[seed-realistic] Mirroring EnrollPro contracts using ${auth.source} authentication...`);
	const facultyResult = await syncFacultyFromExternal(options.schoolId, options.schoolYearId, auth.token);
	assertNonFixtureSource('faculty', facultyResult.source);

	const sectionSummary = await getSectionSummary(options.schoolYearId, options.schoolId, auth.token);
	assertNonFixtureSource('sections', sectionSummary.source);

	const cohortResult = await syncCohorts(options.schoolId, options.schoolYearId, auth.token);
	assertNonFixtureSource('cohorts', cohortResult.source);

	if (sectionSummary.contractWarnings?.length) {
		for (const warning of sectionSummary.contractWarnings) {
			console.warn(`[seed-realistic] Section contract warning: ${warning}`);
		}
	}

	if (cohortResult.warnings?.length) {
		for (const warning of cohortResult.warnings) {
			console.warn(`[seed-realistic] Cohort sync warning: ${warning}`);
		}
	}

	if (options.withCachedSnapshots) {
		console.log('[seed-realistic] withCachedSnapshots was requested, but EnrollPro-source mode refreshes snapshots automatically during sync.');
	}

	return {
		authSource: auth.source,
		facultySource: facultyResult.source,
		sectionSource: sectionSummary.source,
		cohortSource: cohortResult.source,
		teachers: facultyResult.activeCount,
		sections: sectionSummary.totalSections,
		cohorts: cohortResult.count,
		totalEnrolled: sectionSummary.totalEnrolled,
		isSectionStale: sectionSummary.isStale,
		isFacultyStale: facultyResult.isStale ?? false,
	};
}

async function upsertCohorts(schoolId: number, schoolYearId: number, gradeLevels: SectionsByGrade[]) {
	const cohorts = generateTleCohorts(gradeLevels);

	for (const cohort of cohorts) {
		await prisma.instructionalCohort.upsert({
			where: {
				schoolId_schoolYearId_cohortCode: {
					schoolId,
					schoolYearId,
					cohortCode: cohort.cohortCode,
				},
			},
			update: {
				specializationCode: cohort.specializationCode,
				specializationName: cohort.specializationName,
				gradeLevel: cohort.gradeLevel,
				memberSectionIds: cohort.memberSectionIds,
				expectedEnrollment: cohort.expectedEnrollment,
				preferredRoomType: cohort.preferredRoomType,
				isActive: true,
			},
			create: {
				schoolId,
				schoolYearId,
				cohortCode: cohort.cohortCode,
				specializationCode: cohort.specializationCode,
				specializationName: cohort.specializationName,
				gradeLevel: cohort.gradeLevel,
				memberSectionIds: cohort.memberSectionIds,
				expectedEnrollment: cohort.expectedEnrollment,
				preferredRoomType: cohort.preferredRoomType,
				isActive: true,
			},
		});
	}

	return cohorts.length;
}

async function seedCampusMap(schoolId: number, resetMap: boolean): Promise<MapSeedSummary> {
	if (resetMap) {
		await resetMapData(schoolId);
	}

	let buildingsCreated = 0;
	let buildingsMatched = 0;
	let roomsCreated = 0;
	let roomsMatched = 0;

	for (const building of REALISTIC_CAMPUS_BUILDINGS) {
		const generatedShortCode = generateBuildingShortCode(building.name);
		const existing = await prisma.building.findFirst({
			where: {
				schoolId,
				OR: [{ name: building.name }, { shortCode: generatedShortCode }],
			},
			include: { rooms: true },
		});

		if (!existing) {
			await prisma.building.create({
				data: {
					schoolId,
					name: building.name,
					shortCode: generatedShortCode,
					x: building.x,
					y: building.y,
					width: building.width,
					height: building.height,
					rotation: building.rotation ?? 0,
					color: building.color,
					floorCount: building.floorCount,
					isTeachingBuilding: building.isTeachingBuilding ?? true,
					rooms: {
						create: building.rooms.map((room) => ({
							name: room.name,
							floor: room.floor,
							type: room.type,
							capacity: room.capacity,
							floorPosition: room.floorPosition,
							isTeachingSpace:
								building.isTeachingBuilding === false || NON_TEACHING_ROOM_TYPES.has(room.type)
									? false
									: room.isTeachingSpace ?? true,
						})),
					},
				},
			});

			buildingsCreated++;
			roomsCreated += building.rooms.length;
			continue;
		}

		buildingsMatched++;
		const existingRoomKeys = new Set(existing.rooms.map((room) => roomStableKey(room.name, room.floor)));
		roomsMatched += building.rooms.filter((room) => existingRoomKeys.has(roomStableKey(room.name, room.floor))).length;

		const missingRooms = building.rooms.filter((room) => !existingRoomKeys.has(roomStableKey(room.name, room.floor)));
		if (missingRooms.length > 0) {
			const created = await prisma.room.createMany({
				data: missingRooms.map((room) => ({
					buildingId: existing.id,
					name: room.name,
					floor: room.floor,
					type: room.type,
					capacity: room.capacity,
					floorPosition: room.floorPosition,
					isTeachingSpace:
						existing.isTeachingBuilding === false || NON_TEACHING_ROOM_TYPES.has(room.type)
							? false
							: room.isTeachingSpace ?? true,
				})),
			});
			roomsCreated += created.count;
		}
	}

	return {
		buildingsCreated,
		buildingsMatched,
		roomsCreated,
		roomsMatched,
		mapResetApplied: resetMap,
	};
}

async function main() {
	const options = parseArgs();

	if (!options.schoolId || !options.schoolYearId) {
		console.error(USAGE);
		process.exit(1);
	}

	if (options.mode === 'atlas-fixture' && !options.confirmFixtureBypass) {
		throw new Error('atlas-fixture mode is dev-only. Re-run with --confirmFixtureBypass=true to proceed.');
	}

	const school = await assertSchoolExists(options.schoolId);
	const existingState = await collectExistingState(options.schoolId, options.schoolYearId);
	printPreflightSummary(options, school, existingState);

	if (options.reset) {
		console.log('[seed-realistic] Resetting wave-3.5 data domains...');
		await resetWaveData(options);
	}

	const result = options.mode === 'atlas-fixture'
		? await runFixtureMode(options)
		: await runEnrollProSourceMode(options);

	let mapSummary: MapSeedSummary | undefined;
	if (options.seedMap) {
		console.log('[seed-realistic] Seeding realistic campus map...');
		mapSummary = await seedCampusMap(options.schoolId, options.resetMap);
	} else {
		console.log('[seed-realistic] Map seeding skipped. Existing buildings, rooms, and campus image were preserved.');
	}

	console.log('[seed-realistic] Completed successfully.');
	console.log(`  - Mode: ${options.mode}`);
	console.log(`  - Teachers: ${result.teachers}`);
	console.log(`  - Sections: ${result.sections}`);
	console.log(`  - Instructional cohorts: ${result.cohorts}`);
	if (options.mode === 'enrollpro-source') {
		const sourceResult = result as Awaited<ReturnType<typeof runEnrollProSourceMode>>;
		console.log(`  - Faculty source: ${sourceResult.facultySource}`);
		console.log(`  - Section source: ${sourceResult.sectionSource}`);
		console.log(`  - Cohort source: ${sourceResult.cohortSource}`);
		console.log(`  - Total enrolled from upstream: ${sourceResult.totalEnrolled}`);
		console.log(`  - Auth source: ${sourceResult.authSource}`);
	}
	if (options.mode === 'atlas-fixture') {
		console.log(`  - Fixture teacher target: ${REALISTIC_TEACHER_COUNT}`);
		console.log(`  - Fixture section target: ${REALISTIC_SECTION_COUNT}`);
	}
	if (mapSummary) {
		console.log(`  - Buildings created: ${mapSummary.buildingsCreated}`);
		console.log(`  - Buildings preserved/matched: ${mapSummary.buildingsMatched}`);
		console.log(`  - Rooms created: ${mapSummary.roomsCreated}`);
		console.log(`  - Rooms preserved/matched: ${mapSummary.roomsMatched}`);
		console.log(`  - Map reset applied: ${mapSummary.mapResetApplied}`);
	}
}

main()
	.catch((error) => {
		console.error('[seed-realistic] Failed:', error instanceof Error ? error.message : error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
