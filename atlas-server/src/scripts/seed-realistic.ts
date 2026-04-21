/**
 * Wave 3.5 Realistic Seeder — Faculty and Sections
 *
 * Creates 154 teachers across departments and 83 sections (23 G7, 21 G8, 19 G9, 20 G10)
 * with realistic distributions. NO ICT subject track.
 *
 * Usage:
 *   npx tsx src/scripts/seed-realistic.ts --schoolId=1 --schoolYearId=1 --reset
 *
 * Flags:
 *   --schoolId=N         Target school ID (required)
 *   --schoolYearId=N     Target school year ID (required)
 *   --reset              Clear existing data before seeding
 *   --withCachedSnapshots  Also seed FacultySnapshot and SectionSnapshot
 */

import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';

// ─── CLI Args ───

function parseArgs() {
	const args = process.argv.slice(2);
	const parsed: Record<string, string | boolean> = {};
	for (const arg of args) {
		if (arg.startsWith('--')) {
			const [key, val] = arg.slice(2).split('=');
			parsed[key] = val ?? true;
		}
	}
	return {
		schoolId: Number(parsed.schoolId) || 0,
		schoolYearId: Number(parsed.schoolYearId) || 0,
		reset: parsed.reset === true,
		withCachedSnapshots: parsed.withCachedSnapshots === true,
	};
}

// ─── Data Generators ───

const FILIPINO_SURNAMES = [
	'Santos', 'Reyes', 'Cruz', 'Garcia', 'Del Rosario', 'Ramos', 'Bautista',
	'Gonzales', 'Aquino', 'Fernandez', 'Mendoza', 'Torres', 'Villanueva', 'De Leon',
	'Manalo', 'Flores', 'Lopez', 'Castillo', 'Tan', 'Lim', 'Chua', 'Sy', 'Go',
	'Morales', 'Pascual', 'Navarro', 'Perez', 'Rivera', 'Mercado', 'Aguilar',
	'Tolentino', 'Magno', 'Diaz', 'Salazar', 'Ocampo', 'Francisco', 'Panganiban',
	'Delos Santos', 'De Guzman', 'Villanueva', 'Santiago', 'Miranda', 'Guerrero',
];

const FILIPINO_FIRST_NAMES_F = [
	'Maria', 'Ana', 'Liza', 'Cristina', 'Rosa', 'Elena', 'Josefina', 'Teresa',
	'Carmen', 'Angela', 'Patricia', 'Jennifer', 'Michelle', 'Angelica', 'Grace',
	'Jasmine', 'Kathleen', 'Maricel', 'Rowena', 'Aileen', 'Glenda', 'Mildred',
];

const FILIPINO_FIRST_NAMES_M = [
	'Jose', 'Juan', 'Pedro', 'Antonio', 'Carlos', 'Manuel', 'Roberto', 'Francisco',
	'Ricardo', 'Eduardo', 'Fernando', 'Rafael', 'Miguel', 'Gabriel', 'Danilo',
	'Ernesto', 'Benjamin', 'Romeo', 'Rodolfo', 'Reynaldo', 'Armando', 'Rolando',
];

// Department distribution for 154 teachers
const DEPARTMENTS = [
	{ code: 'FILIPINO', name: 'Filipino', count: 18 },
	{ code: 'ENGLISH', name: 'English', count: 18 },
	{ code: 'MATH', name: 'Mathematics', count: 18 },
	{ code: 'SCIENCE', name: 'Science', count: 18 },
	{ code: 'AP', name: 'Araling Panlipunan', count: 16 },
	{ code: 'MAPEH', name: 'MAPEH', count: 20 },
	{ code: 'ESP', name: 'Edukasyon sa Pagpapakatao', count: 14 },
	{ code: 'TLE', name: 'Technology and Livelihood Education', count: 16 },
	{ code: 'MTB', name: 'Mother Tongue-Based', count: 8 },
	{ code: 'HOMEROOM', name: 'Homeroom Guidance', count: 8 },
];

// Section naming patterns
const SECTION_NAMES_G7 = [
	'Einstein', 'Curie', 'Newton', 'Galileo', 'Darwin', 'Mendel', 'Pasteur', 'Tesla',
	'Edison', 'Fermi', 'Hawking', 'Bohr', 'Archimedes', 'Pythagoras', 'Euclid', 'Pascal',
	'Kepler', 'Copernicus', 'Faraday', 'Lavoisier', 'Maxwell', 'Planck', 'Rutherford',
];

const SECTION_NAMES_G8 = [
	'Rizal', 'Bonifacio', 'Mabini', 'Luna', 'Del Pilar', 'Aguinaldo', 'Jacinto',
	'Silang', 'Malvar', 'Tandang Sora', 'Plaridel', 'Jaena', 'Ponce', 'Paterno',
	'Legarda', 'Tavera', 'Buencamino', 'Araullo', 'Osmeña', 'Quezon', 'Laurel',
];

const SECTION_NAMES_G9 = [
	'Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Amethyst', 'Topaz', 'Opal',
	'Garnet', 'Jade', 'Onyx', 'Quartz', 'Turquoise', 'Coral', 'Amber', 'Jasper',
	'Obsidian', 'Citrine', 'Peridot',
];

const SECTION_NAMES_G10 = [
	'Narra', 'Molave', 'Acacia', 'Mahogany', 'Kamagong', 'Ipil', 'Yakal', 'Tindalo',
	'Lauan', 'Apitong', 'Dao', 'Balayong', 'Bangkal', 'Almaciga', 'Pili', 'Anahaw',
	'Balete', 'Mango', 'Santol', 'Kaimito',
];

function generateFacultyId(): string {
	return `T${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function generateTeachers(schoolId: number) {
	const teachers: any[] = [];
	let teacherIndex = 0;

	for (const dept of DEPARTMENTS) {
		for (let i = 0; i < dept.count; i++) {
			const isFemale = Math.random() > 0.35; // ~65% female
			const firstName = isFemale
				? FILIPINO_FIRST_NAMES_F[Math.floor(Math.random() * FILIPINO_FIRST_NAMES_F.length)]
				: FILIPINO_FIRST_NAMES_M[Math.floor(Math.random() * FILIPINO_FIRST_NAMES_M.length)];
			const lastName = FILIPINO_SURNAMES[Math.floor(Math.random() * FILIPINO_SURNAMES.length)];
			const middleInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26));

			teachers.push({
				externalId: generateFacultyId(),
				schoolId,
				firstName,
				lastName,
				middleName: `${middleInitial}.`,
				email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}${teacherIndex}@school.edu.ph`,
				employeeId: `EMP-${String(teacherIndex + 1).padStart(4, '0')}`,
				department: dept.code,
				position: i === 0 ? 'Department Head' : 'Teacher',
				employmentStatus: Math.random() > 0.1 ? 'PERMANENT' : 'CONTRACTUAL',
				maxHoursPerWeek: 40,
				maxPeriodsPerDay: 8,
				isActive: true,
				isStale: false,
				lastSyncedAt: new Date(),
			});
			teacherIndex++;
		}
	}
	return teachers;
}

function generateSections(schoolId: number, schoolYearId: number) {
	const sections: any[] = [];
	let sectionId = 1;

	const gradeConfigs = [
		{ grade: 7, names: SECTION_NAMES_G7.slice(0, 23), count: 23 },
		{ grade: 8, names: SECTION_NAMES_G8.slice(0, 21), count: 21 },
		{ grade: 9, names: SECTION_NAMES_G9.slice(0, 19), count: 19 },
		{ grade: 10, names: SECTION_NAMES_G10.slice(0, 20), count: 20 },
	];

	for (const config of gradeConfigs) {
		for (let i = 0; i < config.count; i++) {
			const name = config.names[i];
			// First 2-3 sections per grade are special programs
			let programType = 'REGULAR';
			let programCode = null;
			let programName = null;

			if (i === 0) {
				programType = 'STE';
				programCode = 'STE';
				programName = 'Science, Technology, and Engineering';
			} else if (i === 1 && config.grade >= 9) {
				programType = 'SPS';
				programCode = 'SPS';
				programName = 'Special Program in Sports';
			} else if (i === 2 && config.grade === 10) {
				programType = 'SPA';
				programCode = 'SPA';
				programName = 'Special Program in the Arts';
			}

			sections.push({
				id: sectionId,
				name: `${config.grade}-${name}`,
				maxCapacity: 45,
				enrolledCount: 35 + Math.floor(Math.random() * 10),
				gradeLevelId: config.grade - 6, // 1 for G7, 2 for G8, etc.
				gradeLevelName: `Grade ${config.grade}`,
				programType,
				programCode,
				programName,
				admissionMode: programType === 'REGULAR' ? null : 'COMPETITIVE',
			});
			sectionId++;
		}
	}
	return sections;
}

// ─── Main Seeder ───

async function main() {
	const opts = parseArgs();

	if (!opts.schoolId || !opts.schoolYearId) {
		console.error('Usage: npx tsx src/scripts/seed-realistic.ts --schoolId=N --schoolYearId=N [--reset] [--withCachedSnapshots]');
		process.exit(1);
	}

	console.log(`[seed-realistic] Starting with options:`, opts);

	if (opts.reset) {
		console.log('[seed-realistic] Clearing existing data...');
		await prisma.facultyMirror.deleteMany({ where: { schoolId: opts.schoolId } });
		await prisma.facultySnapshot.deleteMany({ where: { schoolId: opts.schoolId } });
		await prisma.sectionSnapshot.deleteMany({ where: { schoolId: opts.schoolId } });
		await prisma.instructionalCohort.deleteMany({ where: { schoolId: opts.schoolId } });
	}

	// Generate and insert teachers
	const teachers = generateTeachers(opts.schoolId);
	console.log(`[seed-realistic] Inserting ${teachers.length} teachers...`);

	for (const t of teachers) {
		await prisma.facultyMirror.upsert({
			where: { schoolId_externalId: { schoolId: t.schoolId, externalId: t.externalId } },
			update: t,
			create: t,
		});
	}

	// Generate sections for snapshots
	const sections = generateSections(opts.schoolId, opts.schoolYearId);
	console.log(`[seed-realistic] Generated ${sections.length} sections for snapshots.`);

	if (opts.withCachedSnapshots) {
		console.log('[seed-realistic] Saving faculty snapshot...');
		const facultyPayload = teachers.map((t) => ({
			id: t.externalId,
			firstName: t.firstName,
			lastName: t.lastName,
			middleName: t.middleName,
			email: t.email,
			employeeId: t.employeeId,
			department: t.department,
			position: t.position,
			employmentStatus: t.employmentStatus,
		}));
		const facultyChecksum = crypto.createHash('sha256').update(JSON.stringify(facultyPayload)).digest('hex');

		await prisma.facultySnapshot.upsert({
			where: { schoolId_schoolYearId: { schoolId: opts.schoolId, schoolYearId: opts.schoolYearId } },
			update: {
				payload: facultyPayload,
				source: 'stub',
				fetchedAt: new Date(),
				checksum: facultyChecksum,
			},
			create: {
				schoolId: opts.schoolId,
				schoolYearId: opts.schoolYearId,
				payload: facultyPayload,
				source: 'stub',
				fetchedAt: new Date(),
				checksum: facultyChecksum,
			},
		});

		console.log('[seed-realistic] Saving section snapshot...');
		const sectionsByGrade = [
			{
				gradeLevelId: 1,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				sections: sections.filter((s) => s.gradeLevelId === 1),
			},
			{
				gradeLevelId: 2,
				gradeLevelName: 'Grade 8',
				displayOrder: 8,
				sections: sections.filter((s) => s.gradeLevelId === 2),
			},
			{
				gradeLevelId: 3,
				gradeLevelName: 'Grade 9',
				displayOrder: 9,
				sections: sections.filter((s) => s.gradeLevelId === 3),
			},
			{
				gradeLevelId: 4,
				gradeLevelName: 'Grade 10',
				displayOrder: 10,
				sections: sections.filter((s) => s.gradeLevelId === 4),
			},
		];
		const sectionChecksum = crypto.createHash('sha256').update(JSON.stringify(sectionsByGrade)).digest('hex');

		await prisma.sectionSnapshot.upsert({
			where: { schoolId_schoolYearId: { schoolId: opts.schoolId, schoolYearId: opts.schoolYearId } },
			update: {
				payload: sectionsByGrade,
				source: 'stub',
				fetchedAt: new Date(),
				checksum: sectionChecksum,
			},
			create: {
				schoolId: opts.schoolId,
				schoolYearId: opts.schoolYearId,
				payload: sectionsByGrade,
				source: 'stub',
				fetchedAt: new Date(),
				checksum: sectionChecksum,
			},
		});
	}

	// Seed TLE cohorts
	console.log('[seed-realistic] Seeding TLE cohorts...');
	const cohorts = [
		{ cohortCode: 'G7-TLE-IA', specializationCode: 'IA', specializationName: 'Industrial Arts', gradeLevel: 7, memberSectionIds: [1, 2, 3, 4, 5, 6], expectedEnrollment: 240, preferredRoomType: 'TLE_WORKSHOP' as const },
		{ cohortCode: 'G7-TLE-HE', specializationCode: 'HE', specializationName: 'Home Economics', gradeLevel: 7, memberSectionIds: [7, 8, 9, 10, 11, 12], expectedEnrollment: 250, preferredRoomType: 'LABORATORY' as const },
		{ cohortCode: 'G7-TLE-AFA', specializationCode: 'AFA', specializationName: 'Agri-Fishery Arts', gradeLevel: 7, memberSectionIds: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], expectedEnrollment: 440, preferredRoomType: 'LABORATORY' as const },
		{ cohortCode: 'G8-TLE-IA', specializationCode: 'IA', specializationName: 'Industrial Arts', gradeLevel: 8, memberSectionIds: [24, 25, 26, 27, 28], expectedEnrollment: 200, preferredRoomType: 'TLE_WORKSHOP' as const },
		{ cohortCode: 'G8-TLE-HE', specializationCode: 'HE', specializationName: 'Home Economics', gradeLevel: 8, memberSectionIds: [29, 30, 31, 32, 33], expectedEnrollment: 200, preferredRoomType: 'LABORATORY' as const },
		{ cohortCode: 'G8-TLE-AFA', specializationCode: 'AFA', specializationName: 'Agri-Fishery Arts', gradeLevel: 8, memberSectionIds: [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44], expectedEnrollment: 440, preferredRoomType: 'LABORATORY' as const },
		{ cohortCode: 'G9-TLE-IA', specializationCode: 'IA', specializationName: 'Industrial Arts', gradeLevel: 9, memberSectionIds: [45, 46, 47, 48, 49], expectedEnrollment: 200, preferredRoomType: 'TLE_WORKSHOP' as const },
		{ cohortCode: 'G9-TLE-HE', specializationCode: 'HE', specializationName: 'Home Economics', gradeLevel: 9, memberSectionIds: [50, 51, 52, 53, 54], expectedEnrollment: 190, preferredRoomType: 'LABORATORY' as const },
		{ cohortCode: 'G9-TLE-AFA', specializationCode: 'AFA', specializationName: 'Agri-Fishery Arts', gradeLevel: 9, memberSectionIds: [55, 56, 57, 58, 59, 60, 61, 62, 63], expectedEnrollment: 360, preferredRoomType: 'LABORATORY' as const },
		{ cohortCode: 'G10-TLE-IA', specializationCode: 'IA', specializationName: 'Industrial Arts', gradeLevel: 10, memberSectionIds: [64, 65, 66, 67, 68], expectedEnrollment: 200, preferredRoomType: 'TLE_WORKSHOP' as const },
		{ cohortCode: 'G10-TLE-HE', specializationCode: 'HE', specializationName: 'Home Economics', gradeLevel: 10, memberSectionIds: [69, 70, 71, 72, 73], expectedEnrollment: 200, preferredRoomType: 'LABORATORY' as const },
		{ cohortCode: 'G10-TLE-AFA', specializationCode: 'AFA', specializationName: 'Agri-Fishery Arts', gradeLevel: 10, memberSectionIds: [74, 75, 76, 77, 78, 79, 80, 81, 82, 83], expectedEnrollment: 400, preferredRoomType: 'LABORATORY' as const },
	];

	for (const c of cohorts) {
		await prisma.instructionalCohort.upsert({
			where: {
				schoolId_schoolYearId_cohortCode: {
					schoolId: opts.schoolId,
					schoolYearId: opts.schoolYearId,
					cohortCode: c.cohortCode,
				},
			},
			update: c,
			create: {
				schoolId: opts.schoolId,
				schoolYearId: opts.schoolYearId,
				...c,
			},
		});
	}

	console.log('[seed-realistic] ✅ Done!');
	console.log(`  - Teachers: ${teachers.length}`);
	console.log(`  - Sections (in snapshot): ${sections.length}`);
	console.log(`  - Cohorts: ${cohorts.length}`);

	await prisma.$disconnect();
}

main().catch((e) => {
	console.error('[seed-realistic] ❌ Error:', e);
	process.exit(1);
});
