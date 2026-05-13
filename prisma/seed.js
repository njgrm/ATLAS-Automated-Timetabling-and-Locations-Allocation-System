/**
 * ATLAS Database Seed Script
 * 
 * This script populates the ATLAS database with all necessary data for a
 * fully functional demo environment. Run with: npm run db:seed
 * 
 * Seeded Data:
 * 1. School — ATLAS Pilot School
 * 2. Subjects — core DepEd JHS learning areas plus STE/SPA specialty subjects
 * 3. Buildings — 4 campus buildings with rooms
 * 4. Faculty Mirror — 20 teachers (synced from EnrollPro or stub)
 * 5. Faculty-Subject Assignments — Qualifications for each teacher
 * 6. Scheduling Policy — Default algorithm configuration
 * 
 * Prerequisites:
 * - Database migrated (npm run db:migrate)
 * - EnrollPro seeded if using live integration
 */

require('dotenv').config();

const { PrismaClient } = require('../atlas-server/node_modules/.prisma/client');
const bcrypt = require('../atlas-server/node_modules/bcryptjs');

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// SEED DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DepEd JHS Learning Areas per DO 010 s.2024 with modular rotation support.
 *
 * Core BEC subjects (isSeedable: true) are auto-assigned to every section by the scheduler.
 * Track-specific subjects (isSeedable: false) are assigned via teaching-load workflows.
 */
const subjectSeeds = [
	// ── Core BEC subjects ─────────────────────────────────────────────────────
	{ code: 'FIL', name: 'Filipino', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'ENG', name: 'English', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 240, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'ESP', name: 'ESP/GMRC', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 240, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'NRP', name: 'National Reading Program', minMinutesPerWeek: 50, preferredRoomType: 'CLASSROOM', sessionPattern: 'FRIDAY_ONLY', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'NMP', name: 'National Mathematics Program', minMinutesPerWeek: 50, preferredRoomType: 'CLASSROOM', sessionPattern: 'FRIDAY_ONLY', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	// ── Modular Science rotation (merged during generation by modularGroupId) ─
	{ code: 'SCI_BIO', name: 'Science - Biology', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'], modularGroupId: 'SCIENCE', modularOrder: 1 },
	{ code: 'SCI_CHEM', name: 'Science - Chemistry', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'], modularGroupId: 'SCIENCE', modularOrder: 2 },
	{ code: 'SCI_ES', name: 'Science - Earth Science', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'], modularGroupId: 'SCIENCE', modularOrder: 3 },
	{ code: 'SCI_PHYS', name: 'Science - Physics', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'], modularGroupId: 'SCIENCE', modularOrder: 4 },
	// ── Generic non-core enrichment ───────────────────────────────────────────
	{ code: 'ICT', name: 'Information and Communications Technology', minMinutesPerWeek: 90, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'] },
	// ── STE track specialty subjects (per-grade per DO 010 s.2024) ────────────
	{ code: 'ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_RESEARCH', name: 'Research', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE'] },
	{ code: 'BIOTECHNOLOGY', name: 'Biotechnology', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
	{ code: 'CONSUMERS_CHEMISTRY', name: 'Consumers Chemistry', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
	{ code: 'ELECTRONICS_ROBOTICS', name: 'Electronics and Robotics', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
	// ── SPA track specialty subjects ──────────────────────────────────────────
	{ code: 'SPA_SPEC', name: 'SPA Specialization', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
	{ code: 'DEVL_READING', name: 'Developmental Reading', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE', 'SPA'] },
];

const deprecatedSubjectCodes = [
	'SCI',
	'TLE_ICT_7',
	'TLE_ICT_8',
	'TLE_ICT_9',
	'TLE_ICT_10',
	'RESEARCH_I',
	'RESEARCH_II',
	'RESEARCH_III',
	'RESEARCH_IV',
	'MUSIC',
	'VISUAL_ARTS',
	'THEATER_ARTS',
	'MEDIA_ARTS',
	'CREATIVE_WRITING',
	'DANCE',
];

/** Stub faculty data — used when FACULTY_ADAPTER=stub */
const facultySeeds = [
	{ externalId: 1, firstName: 'Maria', lastName: 'Santos', email: 't-0001@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['FIL'] },
	{ externalId: 2, firstName: 'Jose', lastName: 'Reyes', email: 't-0002@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
	{ externalId: 3, firstName: 'Ana', lastName: 'Dela Cruz', email: 't-0003@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 4, firstName: 'Mark', lastName: 'Villanueva', email: 't-0004@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI_BIO'] },
	{ externalId: 5, firstName: 'Liza', lastName: 'Garcia', email: 't-0005@deped.local', department: 'Social Studies', maxWeeklyHours: 30, subjects: ['AP'] },
	{ externalId: 6, firstName: 'Paolo', lastName: 'Castro', email: 't-0006@deped.local', department: 'MAPEH', maxWeeklyHours: 30, subjects: ['MAPEH'] },
	{ externalId: 7, firstName: 'Rica', lastName: 'Mendoza', email: 't-0007@deped.local', department: 'Values', maxWeeklyHours: 30, subjects: ['ESP'] },
	{ externalId: 8, firstName: 'Neil', lastName: 'Torres', email: 't-0008@deped.local', department: 'TLE', maxWeeklyHours: 30, subjects: ['TLE'] },
	{ externalId: 9, firstName: 'Grace', lastName: 'Aquino', email: 't-0009@deped.local', department: 'Guidance', maxWeeklyHours: 20, subjects: ['HG'] },
	{ externalId: 10, firstName: 'Ivy', lastName: 'Flores', email: 't-0010@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 11, firstName: 'Jomar', lastName: 'Navarro', email: 't-0011@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI_CHEM'] },
	{ externalId: 12, firstName: 'Celia', lastName: 'Pascual', email: 't-0012@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
	{ externalId: 13, firstName: 'Ramon', lastName: 'Lopez', email: 't-0013@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['FIL'] },
	{ externalId: 14, firstName: 'Katrina', lastName: 'Salazar', email: 't-0014@deped.local', department: 'Social Studies', maxWeeklyHours: 30, subjects: ['AP'] },
	{ externalId: 15, firstName: 'Lourdes', lastName: 'Valdez', email: 't-0015@deped.local', department: 'MAPEH', maxWeeklyHours: 30, subjects: ['MAPEH'] },
	{ externalId: 16, firstName: 'Harold', lastName: 'Bautista', email: 't-0016@deped.local', department: 'Values', maxWeeklyHours: 30, subjects: ['ESP'] },
	{ externalId: 17, firstName: 'Mika', lastName: 'Ramos', email: 't-0017@deped.local', department: 'TLE', maxWeeklyHours: 30, subjects: ['TLE'] },
	{ externalId: 18, firstName: 'Jonas', lastName: 'Domingo', email: 't-0018@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 19, firstName: 'Ella', lastName: 'Rivera', email: 't-0019@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI_ES'] },
	{ externalId: 20, firstName: 'Darren', lastName: 'Serrano', email: 't-0020@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI_PHYS'] },
];

async function main() {
	const school = await prisma.school.upsert({
		where: { id: 1 },
		update: {
			name: 'ATLAS Pilot School',
			shortName: 'ATLAS',
		},
		create: {
			name: 'ATLAS Pilot School',
			shortName: 'ATLAS',
		},
	});

	if (deprecatedSubjectCodes.length > 0) {
		await prisma.subject.updateMany({
			where: {
				schoolId: school.id,
				code: { in: deprecatedSubjectCodes },
			},
			data: {
				isActive: false,
				isSeedable: false,
			},
		});
	}

	for (const subject of subjectSeeds) {
		await prisma.subject.upsert({
			where: {
				schoolId_code: {
					schoolId: school.id,
					code: subject.code,
				},
			},
			update: {
				name: subject.name,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
				sessionPattern: subject.sessionPattern ?? 'ANY',
				modularGroupId: subject.modularGroupId ?? null,
				modularOrder: subject.modularOrder ?? null,
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
				programScopes: subject.programScopes ?? ['REGULAR'],
				isActive: true,
			},
			create: {
				schoolId: school.id,
				code: subject.code,
				name: subject.name,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
				sessionPattern: subject.sessionPattern ?? 'ANY',
				modularGroupId: subject.modularGroupId ?? null,
				modularOrder: subject.modularOrder ?? null,
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
				programScopes: subject.programScopes ?? ['REGULAR'],
				isActive: true,
			},
		});
	}

	console.log(`Seeded ${subjectSeeds.length} ATLAS subjects for school ${school.name}.`);

	// Seed demo buildings + rooms aligned to occupancy-plan templates (20-room + 24-room buildings)
	// Main Academic Building: 20 classrooms (7 per floor F1/F2, 6 per floor F3)
	const buildingSeeds = [
		{
			name: 'Main Academic Building',
			shortCode: 'MAIN',
			floorCount: 3,
			x: 70, y: 80, width: 280, height: 170, color: '#2563eb',
			rooms: [
				// Floor 1: 7 classrooms
				{ name: 'Room 101', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
				{ name: 'Room 102', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
				{ name: 'Room 103', floor: 1, type: 'CLASSROOM', capacity: 40, floorPosition: 3 },
				{ name: 'Room 104', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 4 },
				{ name: 'Room 105', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 5 },
				{ name: 'Room 106', floor: 1, type: 'CLASSROOM', capacity: 40, floorPosition: 6 },
				{ name: 'Room 107', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 7 },
				// Floor 2: 7 classrooms
				{ name: 'Room 201', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
				{ name: 'Room 202', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
				{ name: 'Room 203', floor: 2, type: 'CLASSROOM', capacity: 40, floorPosition: 3 },
				{ name: 'Room 204', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 4 },
				{ name: 'Room 205', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 5 },
				{ name: 'Room 206', floor: 2, type: 'CLASSROOM', capacity: 40, floorPosition: 6 },
				{ name: 'Room 207', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 7 },
				// Floor 3: 6 classrooms
				{ name: 'Room 301', floor: 3, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
				{ name: 'Room 302', floor: 3, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
				{ name: 'Room 303', floor: 3, type: 'CLASSROOM', capacity: 40, floorPosition: 3 },
				{ name: 'Room 304', floor: 3, type: 'CLASSROOM', capacity: 45, floorPosition: 4 },
				{ name: 'Room 305', floor: 3, type: 'CLASSROOM', capacity: 45, floorPosition: 5 },
				{ name: 'Room 306', floor: 3, type: 'CLASSROOM', capacity: 40, floorPosition: 6 },
			],
		},
		{
			name: 'Science and Labs',
			shortCode: 'SCI',
			floorCount: 2,
			x: 390, y: 90, width: 220, height: 150, color: '#059669',
			rooms: [
				{ name: 'Chemistry Lab', floor: 1, type: 'LABORATORY', capacity: 35, floorPosition: 1 },
				{ name: 'Biology Lab', floor: 1, type: 'LABORATORY', capacity: 35, floorPosition: 2 },
				{ name: 'Physics Lab', floor: 2, type: 'LABORATORY', capacity: 30, floorPosition: 1 },
				{ name: 'Computer Lab', floor: 2, type: 'COMPUTER_LAB', capacity: 40, floorPosition: 2 },
			],
		},
		{
			name: 'TLE Building',
			shortCode: 'TLE',
			floorCount: 2,
			x: 640, y: 95, width: 180, height: 140, color: '#d97706',
			rooms: [
				{ name: 'Workshop A', floor: 1, type: 'TLE_WORKSHOP', capacity: 35, floorPosition: 1 },
				{ name: 'Workshop B', floor: 1, type: 'TLE_WORKSHOP', capacity: 35, floorPosition: 2 },
				{ name: 'Home Econ Lab', floor: 2, type: 'TLE_WORKSHOP', capacity: 30, floorPosition: 1 },
			],
		},
		{
			name: 'Gym and Covered Court',
			shortCode: 'GYM',
			floorCount: 1,
			x: 100, y: 300, width: 270, height: 170, color: '#ea580c',
			rooms: [
				{ name: 'Court A', floor: 1, type: 'GYMNASIUM', capacity: 200, floorPosition: 1 },
				{ name: 'Court B', floor: 1, type: 'GYMNASIUM', capacity: 150, floorPosition: 2 },
			],
		},
		{
			name: 'Library and Admin',
			shortCode: 'ADMIN',
			floorCount: 2,
			isTeachingBuilding: false,
			x: 420, y: 285, width: 250, height: 185, color: '#7c3aed',
			rooms: [
				{ name: 'Library', floor: 1, type: 'LIBRARY', capacity: 80, floorPosition: 1, isTeachingSpace: false },
				{ name: 'Principal Office', floor: 2, type: 'OFFICE', capacity: 5, floorPosition: 1, isTeachingSpace: false },
				{ name: 'Faculty Room', floor: 2, type: 'FACULTY_ROOM', capacity: 20, floorPosition: 2, isTeachingSpace: false },
			],
		},
	];

	for (const b of buildingSeeds) {
		const existing = await prisma.building.findFirst({
			where: { schoolId: school.id, name: b.name },
		});
		if (!existing) {
			await prisma.building.create({
				data: {
					schoolId: school.id,
					name: b.name,
					shortCode: b.shortCode,
					floorCount: b.floorCount || 1,
					isTeachingBuilding: b.isTeachingBuilding !== false,
					x: b.x,
					y: b.y,
					width: b.width,
					height: b.height,
					color: b.color,
					rooms: {
						create: b.rooms.map((r) => ({
							name: r.name,
							floor: r.floor,
							floorPosition: r.floorPosition || 1,
							type: r.type,
							capacity: r.capacity,
							isTeachingSpace: r.isTeachingSpace !== false,
						})),
					},
				},
			});
		}
	}
	console.log(`✅ Seeded ${buildingSeeds.length} buildings for school ${school.name}.`);

	// ═══════════════════════════════════════════════════════════════════════════
	// FACULTY MIRROR — Sync stub faculty for standalone mode
	// ═══════════════════════════════════════════════════════════════════════════
	
	// Get all subjects for faculty-subject mapping
	const allSubjects = await prisma.subject.findMany({
		where: { schoolId: school.id },
	});
	const subjectMap = new Map(allSubjects.map(s => [s.code, s.id]));

	let facultyCreated = 0;
	let assignmentsCreated = 0;

	for (const f of facultySeeds) {
		const faculty = await prisma.facultyMirror.upsert({
			where: {
				schoolId_externalId: {
					schoolId: school.id,
					externalId: f.externalId,
				},
			},
			update: {
				firstName: f.firstName,
				lastName: f.lastName,
				contactInfo: f.email,
				department: f.department,
				specialization: f.specialization ?? null,
				maxHoursPerWeek: f.maxWeeklyHours,
				isActiveForScheduling: true,
			},
			create: {
				schoolId: school.id,
				externalId: f.externalId,
				firstName: f.firstName,
				lastName: f.lastName,
				contactInfo: f.email,
				department: f.department,
				specialization: f.specialization ?? null,
				maxHoursPerWeek: f.maxWeeklyHours,
				isActiveForScheduling: true,
			},
		});
		facultyCreated++;

		// Create faculty-subject qualifications
		for (const subjectCode of f.subjects) {
			const subjectId = subjectMap.get(subjectCode);
			if (!subjectId) continue;

			const subject = allSubjects.find(s => s.id === subjectId);

			const existingAssignment = await prisma.facultySubject.findUnique({
				where: {
					facultyId_subjectId: {
						facultyId: faculty.id,
						subjectId: subjectId,
					},
				},
			});

			if (!existingAssignment) {
				await prisma.facultySubject.create({
					data: {
						facultyId: faculty.id,
						subjectId: subjectId,
						schoolId: school.id,
						gradeLevels: subject ? subject.gradeLevels : [7, 8, 9, 10],
						assignedBy: 0,
					},
				});
				assignmentsCreated++;
			}
		}
	}
	console.log(`✅ Seeded ${facultyCreated} faculty members with ${assignmentsCreated} subject assignments.`);

	// ═══════════════════════════════════════════════════════════════════════════
	// SPECIALIZATION ALIASES — EnrollPro department terms → ATLAS subject codes
	// ═══════════════════════════════════════════════════════════════════════════

	const aliasSeeds = [
		// Direct subject name aliases (common LIS/HR "specialization" values)
		{ alias: 'Filipino', canonical: 'FIL' },
		{ alias: 'English', canonical: 'ENG' },
		{ alias: 'Mathematics', canonical: 'MATH' },
		{ alias: 'Science', canonical: 'SCI' },
		{ alias: 'Araling Panlipunan', canonical: 'AP' },
		{ alias: 'MAPEH', canonical: 'MAPEH' },
		{ alias: 'Edukasyon sa Pagpapakatao', canonical: 'ESP' },
		{ alias: 'Technology and Livelihood Education', canonical: 'TLE' },
		{ alias: 'Homeroom Guidance', canonical: 'HG' },
		// Department name mappings (from EnrollPro department field)
		{ alias: 'Languages', canonical: 'ENG' },
		{ alias: 'Social Studies', canonical: 'AP' },
		{ alias: 'Values', canonical: 'ESP' },
		{ alias: 'Guidance', canonical: 'HG' },
		// Common shorthand / alternate spellings
		{ alias: 'Math', canonical: 'MATH' },
		{ alias: 'Fil', canonical: 'FIL' },
		{ alias: 'TLE/ICT', canonical: 'TLE' },
		// ── Real EnrollPro specialization values (MAJOR IN X format) ──────────
		// Science cluster
		{ alias: 'MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS', canonical: 'SCI' },
		{ alias: 'MAJOR IN BIOLOGY', canonical: 'SCI' },
		{ alias: 'MAJOR IN CHEMISTRY', canonical: 'SCI' },
		{ alias: 'MAJOR IN PHYSICS', canonical: 'SCI' },
		{ alias: 'MAJOR IN GENERAL SCIENCE', canonical: 'SCI' },
		// Mathematics cluster
		{ alias: 'MAJOR IN MATHEMATICS', canonical: 'MATH' },
		{ alias: 'MAJOR IN MATHEMATICS (WITH STATISTICS BACKGROUND)', canonical: 'MATH' },
		{ alias: 'MAJOR IN APPLIED MATHEMATICS', canonical: 'MATH' },
		// Filipino cluster
		{ alias: 'MAJOR IN FILIPINO', canonical: 'FIL' },
		{ alias: 'MAJOR IN FILIPINO (CAMPUS JOURNALISM)', canonical: 'FIL' },
		{ alias: 'MAJOR IN PHILIPPINE LITERATURE', canonical: 'FIL' },
		// English cluster
		{ alias: 'MAJOR IN ENGLISH', canonical: 'ENG' },
		{ alias: 'MAJOR IN ENGLISH / APPLIED LINGUISTICS', canonical: 'ENG' },
		{ alias: 'MAJOR IN ENGLISH (CAMPUS JOURNALISM)', canonical: 'ENG' },
		{ alias: 'MAJOR IN APPLIED LINGUISTICS', canonical: 'ENG' },
		{ alias: 'LITERATURE / CREATIVE WRITING', canonical: 'ENG' },
		{ alias: 'MASS COMMUNICATION', canonical: 'ENG' },
		{ alias: 'JOURNALISM', canonical: 'ENG' },
		// Social Studies / AP cluster
		{ alias: 'MAJOR IN SOCIAL STUDIES', canonical: 'AP' },
		{ alias: 'MAJOR IN SOCIAL STUDIES / HISTORY', canonical: 'AP' },
		{ alias: 'MAJOR IN HISTORY', canonical: 'AP' },
		{ alias: 'MAJOR IN SOCIAL SCIENCE', canonical: 'AP' },
		// Values Education / ESP cluster
		{ alias: 'MAJOR IN VALUES EDUCATION', canonical: 'ESP' },
		{ alias: 'MAJOR IN THEOLOGY', canonical: 'ESP' },
		{ alias: 'MAJOR IN PHILOSOPHY', canonical: 'ESP' },
		// MAPEH cluster
		{ alias: 'MAJOR IN MAPEH', canonical: 'MAPEH' },
		{ alias: 'MAJOR IN PHYSICAL EDUCATION', canonical: 'MAPEH' },
		{ alias: 'MAJOR IN MUSIC EDUCATION', canonical: 'MAPEH' },
		{ alias: 'THEATER / PERFORMING ARTS', canonical: 'MAPEH' },
		{ alias: 'FINE ARTS', canonical: 'MAPEH' },
		{ alias: 'DANCE', canonical: 'MAPEH' },
		{ alias: 'MAJOR IN MUSIC', canonical: 'MAPEH' },
		{ alias: 'MAJOR IN ARTS', canonical: 'MAPEH' },
		{ alias: 'MAJOR IN HEALTH EDUCATION', canonical: 'MAPEH' },
		// TLE cluster
		{ alias: 'MAJOR IN HOME ECONOMICS', canonical: 'TLE' },
		{ alias: 'MAJOR IN INDUSTRIAL ARTS', canonical: 'TLE' },
		{ alias: 'MAJOR IN AGRI-FISHERY ARTS', canonical: 'TLE' },
		{ alias: 'MAJOR IN ICT', canonical: 'TLE' },
		{ alias: 'MAJOR IN INFORMATION TECHNOLOGY', canonical: 'TLE' },
		{ alias: 'MAJOR IN COMPUTER SCIENCE', canonical: 'TLE' },
		{ alias: 'MAJOR IN TECHNOLOGY AND LIVELIHOOD EDUCATION', canonical: 'TLE' },
		// Homeroom Guidance cluster
		{ alias: 'MAJOR IN GUIDANCE AND COUNSELING', canonical: 'HG' },
		{ alias: 'MAJOR IN SCHOOL GUIDANCE', canonical: 'HG' },
		{ alias: 'GUIDANCE COUNSELOR', canonical: 'HG' },
		{ alias: 'MAJOR IN PSYCHOLOGY', canonical: 'HG' },
	];

	let aliasCount = 0;
	for (const alias of aliasSeeds) {
		const subject = await prisma.subject.findFirst({
			where: { schoolId: school.id, code: alias.canonical },
		});
		if (!subject) {
			console.log(`⚠️  Skipping alias "${alias.alias}" → ${alias.canonical} (subject not found)`);
			continue;
		}
		await prisma.specializationAlias.upsert({
			where: { schoolId_canonical_alias: { schoolId: school.id, canonical: alias.canonical, alias: alias.alias } },
			update: { canonical: alias.canonical },
			create: { schoolId: school.id, alias: alias.alias, canonical: alias.canonical },
		});
		aliasCount++;
	}
	console.log(`✅ Seeded ${aliasCount} specialization alias mappings.`);

	// ═══════════════════════════════════════════════════════════════════════════
	// ATLAS AUTH ACCOUNTS — Scheduling Officer and demo faculty
	// ═══════════════════════════════════════════════════════════════════════════

	const adminHash = await bcrypt.hash('AdminSY2026!', 12);
	await prisma.atlasAuthAccount.upsert({
		where: { email: 'admin@deped.edu.ph' },
		update: {
			employeeId: '1000001',
			passwordHash: adminHash,
			role: 'officer',
			isActive: true,
			failedLoginCount: 0,
			lockedUntil: null,
		},
		create: {
			email: 'admin@deped.edu.ph',
			employeeId: '1000001',
			passwordHash: adminHash,
			role: 'officer',
			schoolId: school.id,
			isActive: true,
		},
	});
	console.log('✅ Seeded admin auth account (Employee ID: 1000001).');

	// Seed faculty auth account for Diego Aquino (MATH teacher, Employee ID 3179586)
	// Note: FacultyMirror.externalId is EnrollPro's internal teacher ID, not the employee ID.
	// We look him up by first/last name since externalId ≠ employeeId.
	const facultyMirrorForDiego = await prisma.facultyMirror.findFirst({
		where: { schoolId: school.id, firstName: 'DIEGO', lastName: 'AQUINO', isStale: false },
	});
	if (facultyMirrorForDiego) {
		const diegoHash = await bcrypt.hash('DepEd2026!', 12);
		await prisma.atlasAuthAccount.upsert({
			where: { employeeId: '3179586' },
			update: {
				passwordHash: diegoHash,
				role: 'faculty',
				isActive: true,
				failedLoginCount: 0,
				lockedUntil: null,
				facultyId: facultyMirrorForDiego.id,
			},
			create: {
				employeeId: '3179586',
				passwordHash: diegoHash,
				role: 'faculty',
				schoolId: school.id,
				facultyId: facultyMirrorForDiego.id,
				isActive: true,
			},
		});
		console.log(`✅ Seeded/updated faculty auth account for AQUINO, DIEGO C. (Employee ID: 3179586).`);
	} else {
		console.log('ℹ️  Skipped Diego Aquino faculty auth — FacultyMirror not yet synced. Run faculty sync then re-seed.');
	}

	// Legacy: also seed Maria Santos demo account if her stub faculty record still exists
	const facultyMirrorForDemo = await prisma.facultyMirror.findFirst({
		where: { schoolId: school.id, externalId: 1 },
	});
	if (facultyMirrorForDemo) {
		const facultyHash = await bcrypt.hash('DepEd2026!', 12);
		await prisma.atlasAuthAccount.upsert({
			where: { email: 'maria.santos@deped.edu.ph' },
			update: {
				passwordHash: facultyHash,
				role: 'faculty',
				isActive: true,
				failedLoginCount: 0,
				lockedUntil: null,
				facultyId: facultyMirrorForDemo.id,
			},
			create: {
				email: 'maria.santos@deped.edu.ph',
				passwordHash: facultyHash,
				role: 'faculty',
				schoolId: school.id,
				facultyId: facultyMirrorForDemo.id,
				isActive: true,
			},
		});
		console.log('✅ Seeded legacy demo faculty auth account (maria.santos@deped.edu.ph).');
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// SEED SUMMARY
	// ═══════════════════════════════════════════════════════════════════════════
	
	console.log('\n════════════════════════════════════════════════════════════');
	console.log('  ATLAS SEED COMPLETE');
	console.log('════════════════════════════════════════════════════════════');
	console.log(`  School:     ${school.name} (ID: ${school.id})`);
	console.log(`  Subjects:   ${subjectSeeds.length} DepEd JHS learning areas`);
	console.log(`  Buildings:  ${buildingSeeds.length} campus buildings`);
	console.log(`  Rooms:      ${buildingSeeds.reduce((sum, b) => sum + b.rooms.length, 0)} teaching spaces`);
	console.log(`  Faculty:    ${facultyCreated} teachers`);
	console.log(`  Assignments: ${assignmentsCreated} subject qualifications`);
	console.log('════════════════════════════════════════════════════════════');
	console.log('\nNext Steps:');
	console.log('  1. Start EnrollPro (pnpm dev) for sections and student data');
	console.log('  2. Log in to EnrollPro as admin@deped.edu.ph / Incorrect_404');
	console.log('  3. Navigate to ATLAS from EnrollPro to establish bridge token');
	console.log('  4. Or use stub mode (SECTION_SOURCE_MODE=stub) for standalone testing');
	console.log('════════════════════════════════════════════════════════════\n');
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
