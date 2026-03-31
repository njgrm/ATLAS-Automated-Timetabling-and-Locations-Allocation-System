import { prisma } from '../lib/prisma.js';

export async function getBuildingsBySchool(schoolId: number) {
	return prisma.building.findMany({
		where: { schoolId },
		include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
		orderBy: { name: 'asc' },
	});
}

export async function getBuilding(id: number) {
	return prisma.building.findUnique({
		where: { id },
		include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
	});
}

export async function upsertBuilding(
	schoolId: number,
	data: { name: string; x: number; y: number; width: number; height: number; color: string; rotation?: number; floorCount?: number; isTeachingBuilding?: boolean },
) {
	return prisma.building.create({
		data: {
			name: data.name,
			x: data.x,
			y: data.y,
			width: data.width,
			height: data.height,
			color: data.color,
			rotation: data.rotation ?? 0,
			floorCount: data.floorCount ?? 1,
			isTeachingBuilding: data.isTeachingBuilding ?? true,
			schoolId,
		},
		include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
	});
}

export async function updateBuilding(
	id: number,
	data: Partial<{ name: string; x: number; y: number; width: number; height: number; color: string; rotation: number; floorCount: number; isTeachingBuilding: boolean }>,
) {
	const building = await prisma.building.update({
		where: { id },
		data,
		include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
	});

	// If isTeachingBuilding was set to false, cascade to all rooms
	if (data.isTeachingBuilding === false) {
		await prisma.room.updateMany({
			where: { buildingId: id },
			data: { isTeachingSpace: false },
		});
		// Refresh rooms after cascade
		const updated = await prisma.building.findUnique({
			where: { id },
			include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
		});
		return updated!;
	}

	return building;
}

export async function deleteBuilding(id: number) {
	return prisma.building.delete({ where: { id } });
}

export async function addRoom(
	buildingId: number,
	data: { name: string; floor?: number; type?: string; capacity?: number; isTeachingSpace?: boolean; floorPosition?: number },
) {
	const floor = data.floor ?? 1;

	// Validate floor does not exceed building floorCount
	const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { floorCount: true } });
	if (!building) {
		throw Object.assign(new Error('Building not found.'), { statusCode: 404, code: 'NOT_FOUND' });
	}
	if (floor < 1 || floor > building.floorCount) {
		throw Object.assign(
			new Error(`Floor ${floor} is invalid. Building has ${building.floorCount} floor(s).`),
			{ statusCode: 400, code: 'INVALID_FLOOR' },
		);
	}

	// Get the max floorPosition on the same floor for auto-ordering
	let pos = data.floorPosition;
	if (pos === undefined) {
		const maxPos = await prisma.room.aggregate({
			where: { buildingId, floor },
			_max: { floorPosition: true },
		});
		pos = (maxPos._max.floorPosition ?? -1) + 1;
	}

	return prisma.room.create({
		data: {
			buildingId,
			name: data.name,
			floor,
			type: (data.type as any) ?? 'CLASSROOM',
			capacity: data.capacity ?? null,
			isTeachingSpace: data.isTeachingSpace ?? true,
			floorPosition: pos,
		},
	});
}

export async function deleteRoom(id: number) {
	return prisma.room.delete({ where: { id } });
}

export async function updateRoom(
	id: number,
	data: Partial<{ name: string; floor: number; type: string; capacity: number | null; isTeachingSpace: boolean; floorPosition: number }>,
) {
	// Validate floor against building floorCount if floor is being changed
	if (data.floor !== undefined) {
		const room = await prisma.room.findUnique({ where: { id }, select: { buildingId: true } });
		if (!room) {
			throw Object.assign(new Error('Room not found.'), { statusCode: 404, code: 'NOT_FOUND' });
		}
		const building = await prisma.building.findUnique({ where: { id: room.buildingId }, select: { floorCount: true } });
		if (building && (data.floor < 1 || data.floor > building.floorCount)) {
			throw Object.assign(
				new Error(`Floor ${data.floor} is invalid. Building has ${building.floorCount} floor(s).`),
				{ statusCode: 400, code: 'INVALID_FLOOR' },
			);
		}
	}

	return prisma.room.update({
		where: { id },
		data: {
			...(data.name !== undefined && { name: data.name }),
			...(data.floor !== undefined && { floor: data.floor }),
			...(data.type !== undefined && { type: data.type as any }),
			...(data.capacity !== undefined && { capacity: data.capacity }),
			...(data.isTeachingSpace !== undefined && { isTeachingSpace: data.isTeachingSpace }),
			...(data.floorPosition !== undefined && { floorPosition: data.floorPosition }),
		},
	});
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
