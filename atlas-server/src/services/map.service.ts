import { prisma } from '../lib/prisma.js';
import { generateBuildingShortCode } from '../lib/building-short-code.js';

const NON_TEACHING_ROOM_TYPES = new Set(['LIBRARY', 'FACULTY_ROOM', 'OFFICE', 'OTHER']);

export async function getBuildingsBySchool(schoolId: number) {
	const buildings = await prisma.building.findMany({
		where: { schoolId },
		include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
		orderBy: { name: 'asc' },
	});

	// Compute shortCode in-memory for buildings missing one (no writes on GET)
	return buildings.map((b) => ({
		...b,
		shortCode: b.shortCode || generateBuildingShortCode(b.name),
	}));
}

export async function getBuilding(id: number) {
	return prisma.building.findUnique({
		where: { id },
		include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
	});
}

export async function upsertBuilding(
	schoolId: number,
	data: { name: string; x: number; y: number; width: number; height: number; color: string; rotation?: number; floorCount?: number; isTeachingBuilding?: boolean; shortCode?: string; gradeScope?: number[] },
) {
	return prisma.building.create({
		data: {
			name: data.name,
			shortCode: data.shortCode || generateBuildingShortCode(data.name),
			x: data.x,
			y: data.y,
			width: data.width,
			height: data.height,
			color: data.color,
			rotation: data.rotation ?? 0,
			floorCount: data.floorCount ?? 1,
			isTeachingBuilding: data.isTeachingBuilding ?? true,
			gradeScope: data.gradeScope ?? [],
			schoolId,
		},
		include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
	});
}

export async function updateBuilding(
	id: number,
	data: Partial<{ name: string; x: number; y: number; width: number; height: number; color: string; rotation: number; floorCount: number; isTeachingBuilding: boolean; shortCode: string; gradeScope: number[] }>,
	actorSchoolId?: number,
) {
	// Verify building belongs to actor's school if scoped
	if (actorSchoolId !== undefined) {
		const existing = await prisma.building.findUnique({ where: { id }, select: { schoolId: true } });
		if (!existing) {
			throw Object.assign(new Error('Building not found.'), { statusCode: 404, code: 'NOT_FOUND' });
		}
		if (existing.schoolId !== actorSchoolId) {
			throw Object.assign(new Error('Access denied: building belongs to another school.'), { statusCode: 403, code: 'CROSS_SCHOOL_DENIED' });
		}
	}
	if (data.floorCount !== undefined) {
		const highestAssignedFloor = await prisma.room.aggregate({
			where: { buildingId: id },
			_max: { floor: true },
		});
		const minAllowedFloorCount = highestAssignedFloor._max.floor ?? 1;
		if (data.floorCount < minAllowedFloorCount) {
			throw Object.assign(
				new Error(`Floor count cannot be set below ${minAllowedFloorCount} while rooms are assigned to that floor.`),
				{ statusCode: 400, code: 'INVALID_FLOOR_COUNT' },
			);
		}
	}

	// If name changed but shortCode not explicitly provided, regenerate
	const updateData: Record<string, unknown> = { ...data };
	if (data.name && data.shortCode === undefined) {
		const existing = await prisma.building.findUnique({ where: { id }, select: { shortCode: true } });
		// Only auto-generate if there was no custom short code
		if (!existing?.shortCode || existing.shortCode === '') {
			updateData.shortCode = generateBuildingShortCode(data.name);
		}
	}

	const building = await prisma.building.update({
		where: { id },
		data: updateData,
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

export async function deleteBuilding(id: number, actorSchoolId?: number) {
	if (actorSchoolId !== undefined) {
		const existing = await prisma.building.findUnique({ where: { id }, select: { schoolId: true } });
		if (!existing) {
			throw Object.assign(new Error('Building not found.'), { statusCode: 404, code: 'NOT_FOUND' });
		}
		if (existing.schoolId !== actorSchoolId) {
			throw Object.assign(new Error('Access denied: building belongs to another school.'), { statusCode: 403, code: 'CROSS_SCHOOL_DENIED' });
		}
	}
	return prisma.building.delete({ where: { id } });
}

export async function addRoom(
	buildingId: number,
	data: { name: string; floor?: number; type?: string; capacity?: number; isTeachingSpace?: boolean; floorPosition?: number },
	actorSchoolId?: number,
) {
	const floor = data.floor ?? 1;
	const roomType = (data.type as any) ?? 'CLASSROOM';

	// Validate floor does not exceed building floorCount; also load teaching flag
	const building = await prisma.building.findUnique({
		where: { id: buildingId },
		select: { floorCount: true, isTeachingBuilding: true, schoolId: true },
	});
	if (!building) {
		throw Object.assign(new Error('Building not found.'), { statusCode: 404, code: 'NOT_FOUND' });
	}
	if (actorSchoolId !== undefined && building.schoolId !== actorSchoolId) {
		throw Object.assign(new Error('Access denied: building belongs to another school.'), { statusCode: 403, code: 'CROSS_SCHOOL_DENIED' });
	}
	if (floor < 1 || floor > building.floorCount) {
		throw Object.assign(
			new Error(`Floor ${floor} is invalid. Building has ${building.floorCount} floor(s).`),
			{ statusCode: 400, code: 'INVALID_FLOOR' },
		);
	}

	// Non-teaching buildings force rooms to non-teaching regardless of payload
	const isTeachingSpace = building.isTeachingBuilding
		? (NON_TEACHING_ROOM_TYPES.has(roomType) ? false : (data.isTeachingSpace ?? true))
		: false;

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
			type: roomType,
			capacity: data.capacity ?? null,
			isTeachingSpace,
			floorPosition: pos,
		},
	});
}

export async function deleteRoom(id: number, actorSchoolId?: number) {
	if (actorSchoolId !== undefined) {
		const room = await prisma.room.findUnique({
			where: { id },
			select: { building: { select: { schoolId: true } } },
		});
		if (!room) {
			throw Object.assign(new Error('Room not found.'), { statusCode: 404, code: 'NOT_FOUND' });
		}
		if (room.building.schoolId !== actorSchoolId) {
			throw Object.assign(new Error('Access denied: room belongs to another school.'), { statusCode: 403, code: 'CROSS_SCHOOL_DENIED' });
		}
	}
	return prisma.room.delete({ where: { id } });
}

export async function updateRoom(
	id: number,
	data: Partial<{ name: string; floor: number; type: string; capacity: number | null; isTeachingSpace: boolean; floorPosition: number }>,
	actorSchoolId?: number,
) {
	const room = await prisma.room.findUnique({
		where: { id },
		select: {
			isTeachingSpace: true,
			type: true,
			building: {
				select: {
					floorCount: true,
					isTeachingBuilding: true,
					schoolId: true,
				},
			},
		},
	});
	if (!room) {
		throw Object.assign(new Error('Room not found.'), { statusCode: 404, code: 'NOT_FOUND' });
	}
	if (actorSchoolId !== undefined && room.building.schoolId !== actorSchoolId) {
		throw Object.assign(new Error('Access denied: room belongs to another school.'), { statusCode: 403, code: 'CROSS_SCHOOL_DENIED' });
	}

	if (data.floor !== undefined && (data.floor < 1 || data.floor > room.building.floorCount)) {
		throw Object.assign(
			new Error(`Floor ${data.floor} is invalid. Building has ${room.building.floorCount} floor(s).`),
			{ statusCode: 400, code: 'INVALID_FLOOR' },
		);
	}

	const nextType = (data.type as any) ?? room.type;
	const nextIsTeachingSpace = room.building.isTeachingBuilding && !NON_TEACHING_ROOM_TYPES.has(nextType)
		? (data.isTeachingSpace ?? room.isTeachingSpace)
		: false;

	return prisma.room.update({
		where: { id },
		data: {
			...(data.name !== undefined && { name: data.name }),
			...(data.floor !== undefined && { floor: data.floor }),
			...(data.type !== undefined && { type: nextType }),
			...(data.capacity !== undefined && { capacity: data.capacity }),
			isTeachingSpace: nextIsTeachingSpace,
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

/**
 * A9 m1 — the placement, exactly as it was stored, or null.
 *
 * NULL is a MEANINGFUL answer, not a missing one: it is a school whose photo
 * predates the Background step, and the client normalises it to "fit whole image,
 * centred, locked". This function deliberately does NOT normalise, and does NOT
 * default, so the client's guarantee is proved by the client's own arithmetic
 * rather than laundered through a server default that no test can see.
 */
export async function getCampusMapPlacement(schoolId: number): Promise<unknown> {
	const school = await prisma.school.findUnique({
		where: { id: schoolId },
		select: { campusMapPlacement: true },
	});
	return school?.campusMapPlacement ?? null;
}

/**
 * A9 m1 — validate and store the background placement.
 *
 * The WRITE is scoped to the ACTOR's own school, and the path parameter is only
 * used for the lookup AFTER that comparison: `actorSchoolId` comes from the
 * verified token, and a mismatch is refused rather than silently redirected. A
 * privileged role therefore does not grant authority over ANOTHER school's map.
 *
 * The stored shape is checked here rather than trusted: a non-finite coordinate, a
 * non-positive width or an unknown mode is a 400, and the aspect fields are
 * recorded as given so the client can detect a replacement upload and refit.
 */
export async function setCampusMapPlacement(
	schoolId: number,
	actorSchoolId: number | undefined,
	placement: unknown,
) {
	if (actorSchoolId === undefined) {
		throw Object.assign(new Error('Access denied: actor school scope is unknown.'), { statusCode: 403, code: 'CROSS_SCHOOL_DENIED' });
	}
	if (schoolId !== actorSchoolId) {
		throw Object.assign(new Error('Access denied: this school belongs to another account.'), { statusCode: 403, code: 'CROSS_SCHOOL_DENIED' });
	}
	if (!placement || typeof placement !== 'object' || Array.isArray(placement)) {
		throw Object.assign(new Error('A placement object is required.'), { statusCode: 400, code: 'INVALID_PLACEMENT' });
	}

	const raw = placement as Record<string, unknown>;
	const finite = (value: unknown): number | null => {
		const n = typeof value === 'number' ? value : Number(value);
		return Number.isFinite(n) ? n : null;
	};
	const imageWidth = finite(raw.imageWidth);
	const imageHeight = finite(raw.imageHeight);
	const x = finite(raw.x);
	const y = finite(raw.y);
	const width = finite(raw.width);
	if (imageWidth === null || imageHeight === null || x === null || y === null || width === null) {
		throw Object.assign(new Error('imageWidth, imageHeight, x, y and width must all be numbers.'), { statusCode: 400, code: 'INVALID_PLACEMENT' });
	}
	if (imageWidth <= 0 || imageHeight <= 0 || width <= 0) {
		throw Object.assign(new Error('imageWidth, imageHeight and width must be greater than zero.'), { statusCode: 400, code: 'INVALID_PLACEMENT' });
	}
	const mode = raw.mode === 'fill' || raw.mode === 'custom' ? raw.mode : raw.mode === 'fit' ? 'fit' : null;
	if (mode === null) {
		throw Object.assign(new Error("mode must be 'fit', 'fill' or 'custom'."), { statusCode: 400, code: 'INVALID_PLACEMENT' });
	}

	// Rounded to a tenth of a pixel: enough that a stored value round-trips through
	// JSON exactly, small enough that a second save of an unchanged placement is a
	// no-op rather than a drift.
	const stored = {
		imageWidth: Math.round(imageWidth),
		imageHeight: Math.round(imageHeight),
		x: Math.round(x * 10) / 10,
		y: Math.round(y * 10) / 10,
		width: Math.round(width * 10) / 10,
		locked: raw.locked !== false,
		mode,
	};
	return prisma.school.update({
		where: { id: schoolId },
		data: { campusMapPlacement: stored },
		select: { campusMapPlacement: true },
	});
}

export async function setCampusImage(schoolId: number, imageUrl: string) {
	return prisma.school.update({
		where: { id: schoolId },
		data: { campusImageUrl: imageUrl },
	});
}

export async function removeCampusImage(schoolId: number) {
	return prisma.school.update({
		where: { id: schoolId },
		data: { campusImageUrl: null },
	});
}
