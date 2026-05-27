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
	{ code: 'FIL', name: 'Filipino', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'ESP', name: 'ESP/GMRC', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
	{ code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },

	// ── Tri-sem Science rotation (3-term modular bundle) ─
	{ code: 'SCI_BIO', name: 'Science - Biology', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], modularGroupId: 'SCIENCE', modularOrder: 1 },
	{ code: 'SCI_CHEM', name: 'Science - Chemistry', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], modularGroupId: 'SCIENCE', modularOrder: 2 },
	{ code: 'SCI_ES', name: 'Science - Earth Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], modularGroupId: 'SCIENCE', modularOrder: 3 },

	// ── TLE exploratory (Grades 7-8) ─────────────────────────────────────────
	{ code: 'TLE_ICT_EXP', name: 'TLE Exploratory - ICT', minMinutesPerWeek: 225, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 1, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], allowedSpecializations: ['ICT'] },
	{ code: 'TLE_AFA_EXP', name: 'TLE Exploratory - Agriculture and Fishery Arts', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 2, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], allowedSpecializations: ['AFA'] },
	{ code: 'TLE_FCS_EXP', name: 'TLE Exploratory - Family and Consumer Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'], allowedSpecializations: ['FCS'] },

	// ── STE / SPA / SPS overlays ─────────────────────────────────────────────
	{ code: 'STE_ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_BIOTECH', name: 'Biotechnology', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_APPLIED_CHEM', name: 'Applied Chemistry', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_APPLIED_PHYS', name: 'Applied Physics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_ROBOTICS', name: 'Robotics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
	{ code: 'STE_RESEARCH', name: 'Research', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE'] },
	{ code: 'SPA_SPEC', name: 'Special Program in the Arts: Specialization', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'], allowedSpecializations: ['MUSIC', 'VISUAL_ARTS', 'THEATER_ARTS', 'MEDIA_ARTS', 'CREATIVE_WRITING', 'DANCE', 'TRADITIONAL_ARTS'] },
	{ code: 'SPS_SPEC', name: 'Special Program in Sports: Specialization', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPS'], allowedSpecializations: ['ATHLETICS', 'SWIMMING', 'BASKETBALL', 'VOLLEYBALL', 'FOOTBALL', 'SEPAK_TAKRAW', 'SOFTBALL', 'BASEBALL', 'BADMINTON', 'TABLE_TENNIS', 'TAEKWONDO', 'TENNIS', 'CHESS', 'GYMNASTICS', 'ARCHERY', 'ARNIS'] },
	{ code: 'DEVL_READING', name: 'Developmental Reading', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA', 'SPS'] },
];

const deprecatedSubjectCodes = [
	'SCI',
	'ICT',
	'TLE_ICT_7',
	'TLE_ICT_8',
	'TLE_ICT_9',
	'TLE_ICT_10',
	'RESEARCH_I',
	'RESEARCH_II',
	'RESEARCH_III',
	'RESEARCH_IV',
	'ENV_SCI',
	'BIOTECHNOLOGY',
	'CONSUMERS_CHEMISTRY',
	'ELECTRONICS_ROBOTICS',
	'ADVANCED_CHEMISTRY',
	'ADVANCED_PHYSICS',
	'ADVANCED_STATISTICS',
	'BASIC_STATISTICS',
	'ELECTRONICS',
	'SPA_SPECIALIZATION',
	'MUSIC',
	'VISUAL_ARTS',
	'THEATER_ARTS',
	'MEDIA_ARTS',
	'CREATIVE_WRITING',
	'DANCE',
	'TLE_IA_EXP',
	'TLE',
	'SCI_PHYS',
	'STE_ICT',
];

function resolveSubjectOutputLabel(code, name, modularGroupId) {
	const normalizedCode = (code || '').trim().toUpperCase();
	const normalizedName = (name || '').trim().toUpperCase();
	const normalizedModular = (modularGroupId || '').trim().toUpperCase();

	if (normalizedCode === 'SPA_SPEC' || normalizedCode === 'SPS_SPEC') return 'SPECIALIZATION';
	if (normalizedCode === 'STE_RESEARCH' || normalizedCode.startsWith('RESEARCH') || normalizedName.includes('RESEARCH')) return 'RESEARCH';
	if (normalizedModular === 'SCIENCE' || normalizedCode.startsWith('SCI_')) return 'SCIENCE';
	if (normalizedModular === 'TLE_EXPLORATORY' || normalizedCode === 'TLE' || normalizedCode.startsWith('TLE_') || normalizedCode.startsWith('TLE_SPEC_')) return 'TLE';
	return normalizedCode || normalizedName || 'UNKNOWN SUBJECT';
}

function resolveSubjectOwnerDepartment(code, name) {
	const normalizedCode = (code || '').trim().toUpperCase();
	const normalizedName = (name || '').trim().toUpperCase();
	if (normalizedCode.startsWith('FIL')) return 'FIL';
	if (normalizedCode.startsWith('ENG')) return 'ENG';
	if (normalizedCode.startsWith('MATH')) return 'MATH';
	if (normalizedCode.startsWith('AP')) return 'AP';
	if (normalizedCode.startsWith('ESP') || normalizedCode === 'HG' || normalizedName.includes('HOMEROOM')) return 'ESP';
	if (normalizedCode.startsWith('MAPEH')) return 'MAPEH';
	if (normalizedCode.startsWith('TLE')) return 'TLE';
	if (normalizedCode.startsWith('SCI') || normalizedCode.startsWith('STE')) return 'SCI';
	if (normalizedCode.startsWith('SPA')) return 'SPA';
	if (normalizedCode.startsWith('SPS')) return 'SPS';
	if (normalizedCode === 'DEVL_READING') return 'ENG';
	return null;
}

function resolveSubjectContract(subject) {
	const code = (subject.code || '').trim().toUpperCase();
	return {
		outputLabel: resolveSubjectOutputLabel(subject.code, subject.name, subject.modularGroupId),
		ownerDepartment: resolveSubjectOwnerDepartment(subject.code, subject.name),
		qualificationPriority: 'DEPARTMENT_FIRST',
		rotationFamily: code.startsWith('TLE') ? 'TLE_ROTATION' : (subject.modularGroupId || null),
		isSystemManaged: code.startsWith('TLE_SPEC_') || code.endsWith('_EXP'),
	};
}

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
	{ externalId: 20, firstName: 'Darren', lastName: 'Serrano', email: 't-0020@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI_ES'] },
];

function makeClassroomRooms({ floorCount, perFloor, prefix, capacity = 45 }) {
	const rooms = [];
	for (let floor = 1; floor <= floorCount; floor++) {
		const floorRoomCount = perFloor[floor - 1] ?? perFloor[perFloor.length - 1] ?? 6;
		for (let i = 1; i <= floorRoomCount; i++) {
			rooms.push({
				name: `${prefix}${floor}${String(i).padStart(2, '0')}`,
				floor,
				type: 'CLASSROOM',
				capacity,
				floorPosition: i,
			});
		}
	}
	return rooms;
}

async function syncSeedBuildings(schoolId, buildingSeeds) {
	for (const b of buildingSeeds) {
		let building = await prisma.building.findFirst({
			where: { schoolId, name: b.name },
			select: { id: true },
		});

		if (!building) {
			building = await prisma.building.create({
				data: {
					schoolId,
					name: b.name,
					shortCode: b.shortCode,
					floorCount: b.floorCount || 1,
					isTeachingBuilding: b.isTeachingBuilding !== false,
					x: b.x,
					y: b.y,
					width: b.width,
					height: b.height,
					color: b.color,
				},
				select: { id: true },
			});
		} else {
			await prisma.building.update({
				where: { id: building.id },
				data: {
					shortCode: b.shortCode,
					floorCount: b.floorCount || 1,
					isTeachingBuilding: b.isTeachingBuilding !== false,
					x: b.x,
					y: b.y,
					width: b.width,
					height: b.height,
					color: b.color,
				},
			});
		}

		for (const r of b.rooms) {
			const existingRoom = await prisma.room.findFirst({
				where: { buildingId: building.id, name: r.name },
				select: { id: true },
			});

			const roomPayload = {
				name: r.name,
				floor: r.floor,
				floorNumber: r.floor,
				floorPosition: r.floorPosition || 1,
				type: r.type,
				capacity: r.capacity,
				isTeachingSpace: r.isTeachingSpace !== false,
				isSharedFacility: ['LABORATORY', 'COMPUTER_LAB', 'TLE_WORKSHOP', 'GYMNASIUM'].includes(r.type),
				buildingZoneId: r.buildingZoneId ?? b.shortCode ?? null,
			};

			if (!existingRoom) {
				await prisma.room.create({
					data: {
						buildingId: building.id,
						...roomPayload,
					},
				});
			} else {
				await prisma.room.update({
					where: { id: existingRoom.id },
					data: roomPayload,
				});
			}
		}

		const seedRoomNames = b.rooms.map((room) => room.name);
		await prisma.room.deleteMany({
			where: {
				buildingId: building.id,
				name: { notIn: seedRoomNames },
			},
		});
	}
}

async function assignSectionHomeRooms(schoolId) {
	const schoolYears = await prisma.sectionMirror.findMany({
		where: { schoolId, isStale: false },
		select: { schoolYearId: true },
		distinct: ['schoolYearId'],
	});

	if (schoolYears.length === 0) {
		console.log('ℹ️  Skipped home-room mapping: no section mirrors found.');
		return;
	}

	const rooms = await prisma.room.findMany({
		where: {
			isTeachingSpace: true,
			building: { schoolId, isTeachingBuilding: true },
		},
		select: {
			id: true,
			type: true,
			capacity: true,
			buildingZoneId: true,
			building: { select: { name: true, shortCode: true } },
		},
		orderBy: [{ buildingId: 'asc' }, { floor: 'asc' }, { floorPosition: 'asc' }, { id: 'asc' }],
	});

	const gradeWingPools = {
		7: rooms.filter((room) => room.building.name.includes('Grade 7 Academic Wing') && room.type === 'CLASSROOM'),
		8: rooms.filter((room) => room.building.name.includes('Grade 8 Academic Wing') && room.type === 'CLASSROOM'),
		9: rooms.filter((room) => room.building.name.includes('Grade 9 Academic Wing') && room.type === 'CLASSROOM'),
		10: rooms.filter((room) => room.building.name.includes('Grade 10 Academic Wing') && room.type === 'CLASSROOM'),
	};
	const stePool = rooms.filter((room) => room.building.shortCode === 'STEX' && room.type === 'CLASSROOM');
	const spsPool = rooms.filter((room) => room.building.shortCode === 'SPS' && room.type === 'CLASSROOM');
	const spaPool = rooms.filter((room) => room.building.shortCode === 'SPA' && room.type === 'CLASSROOM');
	const labPool = rooms.filter((room) => room.type === 'LABORATORY' || room.type === 'COMPUTER_LAB');
	const gymPool = rooms.filter((room) => room.type === 'GYMNASIUM');

	const counters = new Map();
	const pickRoom = (key, pool) => {
		if (!pool || pool.length === 0) return null;
		const index = counters.get(key) ?? 0;
		const room = pool[index % pool.length];
		counters.set(key, index + 1);
		return room;
	};

	let totalMapped = 0;
	for (const year of schoolYears) {
		const sections = await prisma.sectionMirror.findMany({
			where: { schoolId, schoolYearId: year.schoolYearId, isStale: false },
			select: {
				id: true,
				gradeLevelName: true,
				programType: true,
				name: true,
			},
			orderBy: [{ gradeLevelId: 'asc' }, { name: 'asc' }],
		});

		for (let i = 0; i < sections.length; i++) {
			const section = sections[i];
			const gradeMatch = section.gradeLevelName.match(/(\d+)/);
			const gradeLevel = gradeMatch ? Number(gradeMatch[1]) : null;
			const gradePool = gradeLevel ? gradeWingPools[gradeLevel] : [];
			const programType = (section.programType ?? 'REGULAR').toUpperCase();

			let homeRoom = null;
			if (programType === 'STE') {
				homeRoom = (i % 3 === 0 ? pickRoom('STE_LAB', labPool) : null)
					?? pickRoom('STE', stePool)
					?? pickRoom(`G${gradeLevel}`, gradePool)
					?? pickRoom('LAB_FALLBACK', labPool);
			} else if (programType === 'SPS') {
				homeRoom = (i % 3 === 0 ? pickRoom('SPS_GYM', gymPool) : null)
					?? pickRoom('SPS', spsPool)
					?? pickRoom(`G${gradeLevel}`, gradePool);
			} else if (programType === 'SPA') {
				homeRoom = (i % 3 === 0 ? pickRoom('SPA_LAB', labPool) : null)
					?? pickRoom('SPA', spaPool)
					?? pickRoom(`G${gradeLevel}`, gradePool);
			} else {
				homeRoom = pickRoom(`G${gradeLevel}`, gradePool) ?? pickRoom('REG_FALLBACK', stePool);
			}

			await prisma.sectionMirror.update({
				where: { id: section.id },
				data: {
					homeRoomId: homeRoom?.id ?? null,
					buildingZoneId: homeRoom?.buildingZoneId ?? homeRoom?.building.shortCode ?? null,
				},
			});
			totalMapped += 1;
		}
	}

	console.log(`✅ Home-room mapping refreshed for ${totalMapped} sections.`);
}

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
		const contract = resolveSubjectContract(subject);
		await prisma.subject.upsert({
			where: {
				schoolId_code: {
					schoolId: school.id,
					code: subject.code,
				},
			},
			update: {
				name: subject.name,
				outputLabel: contract.outputLabel,
				ownerDepartment: contract.ownerDepartment,
				qualificationPriority: contract.qualificationPriority,
				rotationFamily: contract.rotationFamily,
				isSystemManaged: contract.isSystemManaged,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
				modularGroupId: subject.modularGroupId ?? null,
				modularOrder: subject.modularOrder ?? null,
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
				programScopes: subject.programScopes ?? ['REGULAR'],
				allowedSpecializations: subject.allowedSpecializations ?? [],
				requiredFeatures: subject.requiredFeatures ?? [],
				isActive: true,
			},
			create: {
				schoolId: school.id,
				code: subject.code,
				name: subject.name,
				outputLabel: contract.outputLabel,
				ownerDepartment: contract.ownerDepartment,
				qualificationPriority: contract.qualificationPriority,
				rotationFamily: contract.rotationFamily,
				isSystemManaged: contract.isSystemManaged,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
				modularGroupId: subject.modularGroupId ?? null,
				modularOrder: subject.modularOrder ?? null,
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
				programScopes: subject.programScopes ?? ['REGULAR'],
				allowedSpecializations: subject.allowedSpecializations ?? [],
				requiredFeatures: subject.requiredFeatures ?? [],
				isActive: true,
			},
		});
	}

	console.log(`Seeded ${subjectSeeds.length} ATLAS subjects for school ${school.name}.`);

	// Seed deterministic building templates and re-apply them on every seed run.
	// Grade-level wings (20/24-room templates) are used for home-room ownership.
	const buildingSeeds = [
		{
			name: 'Grade 7 Academic Wing',
			shortCode: 'G7',
			floorCount: 3,
			x: 60, y: 70, width: 220, height: 155, color: '#16a34a',
			rooms: makeClassroomRooms({ floorCount: 3, perFloor: [7, 7, 6], prefix: 'G7-' }),
		},
		{
			name: 'Grade 8 Academic Wing',
			shortCode: 'G8',
			floorCount: 3,
			x: 300, y: 70, width: 220, height: 155, color: '#ca8a04',
			rooms: makeClassroomRooms({ floorCount: 3, perFloor: [7, 7, 6], prefix: 'G8-' }),
		},
		{
			name: 'Grade 9 Academic Wing',
			shortCode: 'G9',
			floorCount: 3,
			x: 540, y: 70, width: 220, height: 155, color: '#dc2626',
			rooms: makeClassroomRooms({ floorCount: 3, perFloor: [8, 8, 8], prefix: 'G9-' }),
		},
		{
			name: 'Grade 10 Academic Wing',
			shortCode: 'G10',
			floorCount: 3,
			x: 780, y: 70, width: 220, height: 155, color: '#2563eb',
			rooms: makeClassroomRooms({ floorCount: 3, perFloor: [8, 8, 8], prefix: 'G10-' }),
		},
		{
			name: 'STE Innovation Center',
			shortCode: 'STEX',
			floorCount: 3,
			x: 60, y: 250, width: 260, height: 180, color: '#059669',
			rooms: [
				...makeClassroomRooms({ floorCount: 2, perFloor: [6, 6], prefix: 'STE-', capacity: 40 }),
				{ name: 'STE-BioLab', floor: 3, type: 'LABORATORY', capacity: 35, floorPosition: 1 },
				{ name: 'STE-ChemLab', floor: 3, type: 'LABORATORY', capacity: 35, floorPosition: 2 },
				{ name: 'STE-PhysLab', floor: 3, type: 'LABORATORY', capacity: 35, floorPosition: 3 },
				{ name: 'STE-Robotics', floor: 3, type: 'LABORATORY', capacity: 30, floorPosition: 4 },
				{ name: 'STE-CompLab-1', floor: 3, type: 'COMPUTER_LAB', capacity: 40, floorPosition: 5 },
				{ name: 'STE-CompLab-2', floor: 3, type: 'COMPUTER_LAB', capacity: 40, floorPosition: 6 },
				{ name: 'STE-Workshop-1', floor: 3, type: 'TLE_WORKSHOP', capacity: 30, floorPosition: 7 },
				{ name: 'STE-Workshop-2', floor: 3, type: 'TLE_WORKSHOP', capacity: 30, floorPosition: 8 },
			],
		},
		{
			name: 'SPS Sports Academy',
			shortCode: 'SPS',
			floorCount: 2,
			x: 350, y: 250, width: 230, height: 165, color: '#ea580c',
			rooms: [
				...makeClassroomRooms({ floorCount: 2, perFloor: [3, 3], prefix: 'SPS-', capacity: 40 }),
				{ name: 'SPS-Court-1', floor: 1, type: 'GYMNASIUM', capacity: 160, floorPosition: 4 },
				{ name: 'SPS-Court-2', floor: 1, type: 'GYMNASIUM', capacity: 140, floorPosition: 5 },
				{ name: 'SPS-HumanPerfLab', floor: 2, type: 'LABORATORY', capacity: 35, floorPosition: 4 },
				{ name: 'SPS-FitnessLab', floor: 2, type: 'LABORATORY', capacity: 35, floorPosition: 5 },
			],
		},
		{
			name: 'SPA Arts Conservatory',
			shortCode: 'SPA',
			floorCount: 2,
			x: 610, y: 250, width: 240, height: 165, color: '#9333ea',
			rooms: [
				...makeClassroomRooms({ floorCount: 2, perFloor: [3, 3], prefix: 'SPA-', capacity: 40 }),
				{ name: 'SPA-MediaLab', floor: 1, type: 'COMPUTER_LAB', capacity: 35, floorPosition: 4 },
				{ name: 'SPA-ArtsStudio', floor: 1, type: 'LABORATORY', capacity: 35, floorPosition: 5 },
				{ name: 'SPA-PerformanceHall', floor: 2, type: 'GYMNASIUM', capacity: 120, floorPosition: 4 },
				{ name: 'SPA-MakersLab', floor: 2, type: 'LABORATORY', capacity: 30, floorPosition: 5 },
			],
		},
		{
			name: 'Science and Labs',
			shortCode: 'SCI',
			floorCount: 2,
			x: 870, y: 250, width: 220, height: 160, color: '#047857',
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
			x: 60, y: 460, width: 180, height: 140, color: '#d97706',
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
			x: 260, y: 460, width: 270, height: 170, color: '#ea580c',
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
			x: 560, y: 460, width: 250, height: 185, color: '#7c3aed',
			rooms: [
				{ name: 'Library', floor: 1, type: 'LIBRARY', capacity: 80, floorPosition: 1, isTeachingSpace: false },
				{ name: 'Principal Office', floor: 2, type: 'OFFICE', capacity: 5, floorPosition: 1, isTeachingSpace: false },
				{ name: 'Faculty Room', floor: 2, type: 'FACULTY_ROOM', capacity: 20, floorPosition: 2, isTeachingSpace: false },
			],
		},
	];

	await syncSeedBuildings(school.id, buildingSeeds);
	console.log(`✅ Seeded ${buildingSeeds.length} buildings for school ${school.name}.`);
	await assignSectionHomeRooms(school.id);

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
				email: `faculty.3179586@deped.edu.ph`,
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
