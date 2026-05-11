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

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// SEED DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DepEd JHS Learning Areas per DO 010 s.2024
 *
 * Core BEC subjects (isSeedable: true) are auto-assigned to every section by the scheduler.
 * Track-specific subjects (isSeedable: false) are only assigned to STE/SPA sections manually.
 *
 * Subject code alignment note:
 *   - ESP (not VE): official DepEd code is "EsP" (Edukasyon sa Pagpapakatao).
 *   - TLE_ICT_7/8/9/10: per-grade ICT track within TLE, REGULAR program.
 *   - STE subjects are per-grade per DO 010 s.2024 Science, Technology & Engineering track.
 *   - SPA subjects align with EnrollPro's checklist.
 */
const subjectSeeds = [
	// ── Core BEC subjects ─────────────────────────────────────────────────────
	{ code: 'FIL', name: 'Filipino', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'SCI', name: 'Science', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 200, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'ESP', name: 'Edukasyon sa Pagpapakatao', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 200, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	{ code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
	// ── TLE (ICT) per-grade — REGULAR track ──────────────────────────────────
	{ code: 'TLE_ICT_7', name: 'TLE (ICT I) Computer Systems', minMinutesPerWeek: 90, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [7], isSeedable: false, programScopes: ['REGULAR'] },
	{ code: 'TLE_ICT_8', name: 'TLE (ICT II) Computer Systems Servicing II', minMinutesPerWeek: 90, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [8], isSeedable: false, programScopes: ['REGULAR'] },
	{ code: 'TLE_ICT_9', name: 'TLE (ICT III) Computer Systems Servicing III', minMinutesPerWeek: 90, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [9], isSeedable: false, programScopes: ['REGULAR'] },
	{ code: 'TLE_ICT_10', name: 'TLE (ICT IV) Computer Systems Servicing IV', minMinutesPerWeek: 90, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [10], isSeedable: false, programScopes: ['REGULAR'] },
	// ── STE track specialty subjects (per-grade per DO 010 s.2024) ────────────
	{ code: 'ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
	{ code: 'RESEARCH_I', name: 'Research I', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
	{ code: 'RESEARCH_II', name: 'Research II', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
	{ code: 'BIOTECHNOLOGY', name: 'Biotechnology', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
	{ code: 'CONSUMERS_CHEMISTRY', name: 'Consumers Chemistry', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
	{ code: 'RESEARCH_III', name: 'Research III', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
	{ code: 'ELECTRONICS_ROBOTICS', name: 'Electronics and Robotics', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
	{ code: 'RESEARCH_IV', name: 'Research IV', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
	// ── SPA track specialty subjects ──────────────────────────────────────────
	{ code: 'MUSIC', name: 'Music (Vocal / Instrumental)', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
	{ code: 'VISUAL_ARTS', name: 'Visual Arts', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
	{ code: 'THEATER_ARTS', name: 'Theater Arts', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
	{ code: 'MEDIA_ARTS', name: 'Media Arts', minMinutesPerWeek: 90, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
	{ code: 'CREATIVE_WRITING', name: 'Creative Writing (English / Filipino)', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
	{ code: 'DANCE', name: 'Dance', minMinutesPerWeek: 90, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
];

/** Stub faculty data — used when FACULTY_ADAPTER=stub */
const facultySeeds = [
	{ externalId: 1, firstName: 'Maria', lastName: 'Santos', email: 't-0001@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['FIL'] },
	{ externalId: 2, firstName: 'Jose', lastName: 'Reyes', email: 't-0002@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
	{ externalId: 3, firstName: 'Ana', lastName: 'Dela Cruz', email: 't-0003@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 4, firstName: 'Mark', lastName: 'Villanueva', email: 't-0004@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI'] },
	{ externalId: 5, firstName: 'Liza', lastName: 'Garcia', email: 't-0005@deped.local', department: 'Social Studies', maxWeeklyHours: 30, subjects: ['AP'] },
	{ externalId: 6, firstName: 'Paolo', lastName: 'Castro', email: 't-0006@deped.local', department: 'MAPEH', maxWeeklyHours: 30, subjects: ['MAPEH'] },
	{ externalId: 7, firstName: 'Rica', lastName: 'Mendoza', email: 't-0007@deped.local', department: 'Values', maxWeeklyHours: 30, subjects: ['ESP'] },
	{ externalId: 8, firstName: 'Neil', lastName: 'Torres', email: 't-0008@deped.local', department: 'TLE', maxWeeklyHours: 30, subjects: ['TLE'] },
	{ externalId: 9, firstName: 'Grace', lastName: 'Aquino', email: 't-0009@deped.local', department: 'Guidance', maxWeeklyHours: 20, subjects: ['HG'] },
	{ externalId: 10, firstName: 'Ivy', lastName: 'Flores', email: 't-0010@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 11, firstName: 'Jomar', lastName: 'Navarro', email: 't-0011@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI'] },
	{ externalId: 12, firstName: 'Celia', lastName: 'Pascual', email: 't-0012@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
	{ externalId: 13, firstName: 'Ramon', lastName: 'Lopez', email: 't-0013@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['FIL'] },
	{ externalId: 14, firstName: 'Katrina', lastName: 'Salazar', email: 't-0014@deped.local', department: 'Social Studies', maxWeeklyHours: 30, subjects: ['AP'] },
	{ externalId: 15, firstName: 'Lourdes', lastName: 'Valdez', email: 't-0015@deped.local', department: 'MAPEH', maxWeeklyHours: 30, subjects: ['MAPEH'] },
	{ externalId: 16, firstName: 'Harold', lastName: 'Bautista', email: 't-0016@deped.local', department: 'Values', maxWeeklyHours: 30, subjects: ['ESP'] },
	{ externalId: 17, firstName: 'Mika', lastName: 'Ramos', email: 't-0017@deped.local', department: 'TLE', maxWeeklyHours: 30, subjects: ['TLE'] },
	{ externalId: 18, firstName: 'Jonas', lastName: 'Domingo', email: 't-0018@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 19, firstName: 'Ella', lastName: 'Rivera', email: 't-0019@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI'] },
	{ externalId: 20, firstName: 'Darren', lastName: 'Serrano', email: 't-0020@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
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
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
				programScopes: subject.programScopes ?? ['REGULAR'],
			},
			create: {
				schoolId: school.id,
				code: subject.code,
				name: subject.name,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
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
