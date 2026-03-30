require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const subjectSeeds = [
	{ code: 'FIL', name: 'Filipino', weeklyMinJhs: 240, isCore: true },
	{ code: 'ENG', name: 'English', weeklyMinJhs: 240, isCore: true },
	{ code: 'MATH', name: 'Mathematics', weeklyMinJhs: 240, isCore: true },
	{ code: 'SCI', name: 'Science', weeklyMinJhs: 240, isCore: true },
	{ code: 'AP', name: 'Araling Panlipunan', weeklyMinJhs: 180, isCore: true },
	{ code: 'MAPEH', name: 'MAPEH', weeklyMinJhs: 160, isCore: true },
	{ code: 'ESP', name: 'Edukasyon sa Pagpapakatao', weeklyMinJhs: 120, isCore: true },
	{ code: 'TLE', name: 'Technology and Livelihood Education', weeklyMinJhs: 240, isCore: true },
	{ code: 'HG', name: 'Homeroom Guidance', weeklyMinJhs: 60, isCore: false },
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
				weeklyMinJhs: subject.weeklyMinJhs,
				isCore: subject.isCore,
			},
			create: {
				schoolId: school.id,
				code: subject.code,
				name: subject.name,
				weeklyMinJhs: subject.weeklyMinJhs,
				isCore: subject.isCore,
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
