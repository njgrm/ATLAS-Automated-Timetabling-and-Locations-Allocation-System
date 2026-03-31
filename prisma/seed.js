require('dotenv').config();

const { PrismaClient } = require('../atlas-server/node_modules/.prisma/client');

const prisma = new PrismaClient();

const subjectSeeds = [
	{ code: 'FIL', name: 'Filipino', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'SCI', name: 'Science', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 200, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'VE', name: 'Values Education', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 200, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
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
			},
			create: {
				schoolId: school.id,
				code: subject.code,
				name: subject.name,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
				isActive: true,
			},
		});
	}

	console.log(`Seeded ${subjectSeeds.length} ATLAS subjects for school ${school.name}.`);

	// Seed demo buildings + rooms
	const buildingSeeds = [
		{
			name: 'Main Academic Building',
			x: 70, y: 80, width: 280, height: 170, color: '#2563eb',
			rooms: [
				{ name: 'G7-A', floor: 1, type: 'CLASSROOM', capacity: 45 },
				{ name: 'G7-B', floor: 1, type: 'CLASSROOM', capacity: 45 },
				{ name: 'G7-C', floor: 2, type: 'CLASSROOM', capacity: 45 },
				{ name: 'G8-A', floor: 2, type: 'CLASSROOM', capacity: 40 },
			],
		},
		{
			name: 'Science and Labs',
			x: 390, y: 90, width: 220, height: 150, color: '#059669',
			rooms: [
				{ name: 'Chemistry Lab', floor: 1, type: 'LABORATORY', capacity: 35 },
				{ name: 'Biology Lab', floor: 1, type: 'LABORATORY', capacity: 35 },
				{ name: 'Physics Lab', floor: 2, type: 'LABORATORY', capacity: 30 },
			],
		},
		{
			name: 'Gym and Covered Court',
			x: 100, y: 300, width: 270, height: 170, color: '#ea580c',
			rooms: [
				{ name: 'Court A', floor: 1, type: 'GYMNASIUM', capacity: 200 },
				{ name: 'Court B', floor: 1, type: 'GYMNASIUM', capacity: 150 },
			],
		},
		{
			name: 'Library and Admin',
			x: 420, y: 285, width: 250, height: 185, color: '#7c3aed',
			rooms: [
				{ name: 'Library', floor: 1, type: 'LIBRARY', capacity: 80 },
				{ name: 'Principal Office', floor: 2, type: 'OFFICE', capacity: 5 },
				{ name: 'Faculty Room', floor: 2, type: 'FACULTY_ROOM', capacity: 20 },
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
					x: b.x,
					y: b.y,
					width: b.width,
					height: b.height,
					color: b.color,
					rooms: {
						create: b.rooms.map((r) => ({
							name: r.name,
							floor: r.floor,
							type: r.type,
							capacity: r.capacity,
						})),
					},
				},
			});
		}
	}
	console.log(`Seeded ${buildingSeeds.length} buildings for school ${school.name}.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
