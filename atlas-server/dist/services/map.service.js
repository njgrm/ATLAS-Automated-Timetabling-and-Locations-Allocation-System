import { prisma } from '../lib/prisma.js';
import { generateBuildingShortCode } from '../lib/building-short-code.js';
const NON_TEACHING_ROOM_TYPES = new Set(['LIBRARY', 'FACULTY_ROOM', 'OFFICE', 'OTHER']);
export async function getBuildingsBySchool(schoolId) {
    const buildings = await prisma.building.findMany({
        where: { schoolId },
        include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
        orderBy: { name: 'asc' },
    });
    // Backfill missing shortCodes (non-destructive)
    const needsBackfill = buildings.filter((b) => !b.shortCode);
    if (needsBackfill.length > 0) {
        await Promise.all(needsBackfill.map((b) => prisma.building.update({
            where: { id: b.id },
            data: { shortCode: generateBuildingShortCode(b.name) },
        })));
        // Reflect backfilled values in returned data
        for (const b of needsBackfill) {
            b.shortCode = generateBuildingShortCode(b.name);
        }
    }
    return buildings;
}
export async function getBuilding(id) {
    return prisma.building.findUnique({
        where: { id },
        include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
    });
}
export async function upsertBuilding(schoolId, data) {
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
            schoolId,
        },
        include: { rooms: { orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }] } },
    });
}
export async function updateBuilding(id, data) {
    if (data.floorCount !== undefined) {
        const highestAssignedFloor = await prisma.room.aggregate({
            where: { buildingId: id },
            _max: { floor: true },
        });
        const minAllowedFloorCount = highestAssignedFloor._max.floor ?? 1;
        if (data.floorCount < minAllowedFloorCount) {
            throw Object.assign(new Error(`Floor count cannot be set below ${minAllowedFloorCount} while rooms are assigned to that floor.`), { statusCode: 400, code: 'INVALID_FLOOR_COUNT' });
        }
    }
    // If name changed but shortCode not explicitly provided, regenerate
    const updateData = { ...data };
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
        return updated;
    }
    return building;
}
export async function deleteBuilding(id) {
    return prisma.building.delete({ where: { id } });
}
export async function addRoom(buildingId, data) {
    const floor = data.floor ?? 1;
    const roomType = data.type ?? 'CLASSROOM';
    // Validate floor does not exceed building floorCount; also load teaching flag
    const building = await prisma.building.findUnique({
        where: { id: buildingId },
        select: { floorCount: true, isTeachingBuilding: true },
    });
    if (!building) {
        throw Object.assign(new Error('Building not found.'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (floor < 1 || floor > building.floorCount) {
        throw Object.assign(new Error(`Floor ${floor} is invalid. Building has ${building.floorCount} floor(s).`), { statusCode: 400, code: 'INVALID_FLOOR' });
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
export async function deleteRoom(id) {
    return prisma.room.delete({ where: { id } });
}
export async function updateRoom(id, data) {
    const room = await prisma.room.findUnique({
        where: { id },
        select: {
            isTeachingSpace: true,
            type: true,
            building: {
                select: {
                    floorCount: true,
                    isTeachingBuilding: true,
                },
            },
        },
    });
    if (!room) {
        throw Object.assign(new Error('Room not found.'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (data.floor !== undefined && (data.floor < 1 || data.floor > room.building.floorCount)) {
        throw Object.assign(new Error(`Floor ${data.floor} is invalid. Building has ${room.building.floorCount} floor(s).`), { statusCode: 400, code: 'INVALID_FLOOR' });
    }
    const nextType = data.type ?? room.type;
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
export async function getCampusImage(schoolId) {
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { campusImageUrl: true },
    });
    return school?.campusImageUrl ?? null;
}
export async function setCampusImage(schoolId, imageUrl) {
    return prisma.school.update({
        where: { id: schoolId },
        data: { campusImageUrl: imageUrl },
    });
}
//# sourceMappingURL=map.service.js.map