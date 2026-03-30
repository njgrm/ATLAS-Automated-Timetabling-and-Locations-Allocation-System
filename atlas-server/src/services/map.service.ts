import { prisma } from '../lib/prisma.js';

export async function getBuildingsBySchool(schoolId: number) {
	return prisma.building.findMany({
		where: { schoolId },
		include: { rooms: true },
		orderBy: { name: 'asc' },
	});
}

export async function getBuilding(id: number) {
	return prisma.building.findUnique({
		where: { id },
		include: { rooms: true },
	});
}

export async function upsertBuilding(
	schoolId: number,
	data: { name: string; x: number; y: number; width: number; height: number; color: string },
) {
	return prisma.building.create({
		data: { ...data, schoolId },
		include: { rooms: true },
	});
}

export async function updateBuilding(
	id: number,
	data: Partial<{ name: string; x: number; y: number; width: number; height: number; color: string }>,
) {
	return prisma.building.update({
		where: { id },
		data,
		include: { rooms: true },
	});
}

export async function deleteBuilding(id: number) {
	return prisma.building.delete({ where: { id } });
}

export async function addRoom(
	buildingId: number,
	data: { name: string; floor?: number; type?: string; capacity?: number },
) {
	return prisma.room.create({
		data: {
			buildingId,
			name: data.name,
			floor: data.floor ?? 1,
			type: (data.type as any) ?? 'CLASSROOM',
			capacity: data.capacity ?? null,
		},
	});
}

export async function deleteRoom(id: number) {
	return prisma.room.delete({ where: { id } });
}

export async function getCampusImage(schoolId: number) {
	const school = await prisma.school.findUnique({
		where: { id: schoolId },
		select: { campusImageUrl: true },
	});
	return school?.campusImageUrl ?? null;
}

export async function setCampusImage(schoolId: number, imageUrl: string) {
	return prisma.school.update({
		where: { id: schoolId },
		data: { campusImageUrl: imageUrl },
	});
}
