/**
 * Additive disposable campus fixture (05AR correction, DBR-05AR.1).
 *
 * Single source of truth for the deterministic 8-building / 103-room test
 * campus used by both `seed-realistic.ts` and the guarded disposable
 * reconstruction entry point. This module deliberately imports NO
 * teaching-load allocation seeder: the disposable reconstruction path must
 * have zero runtime dependency on the hardcoded allocation module (direct
 * or transitive). Seeding here is additive-only when `resetMap` is false, so
 * operator-created buildings/rooms survive reconstruction and the second
 * pass is a provable no-op.
 */

import type { RoomType } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { generateBuildingShortCode } from '../lib/building-short-code.js';

export interface SeedRoom {
	name: string;
	floor: number;
	type: RoomType;
	capacity: number | null;
	floorPosition: number;
	isTeachingSpace?: boolean;
}

export interface SeedBuilding {
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation?: number;
	color: string;
	floorCount: number;
	isTeachingBuilding?: boolean;
	rooms: SeedRoom[];
}

export interface MapSeedSummary {
	buildingsCreated: number;
	buildingsMatched: number;
	roomsCreated: number;
	roomsMatched: number;
	mapResetApplied: boolean;
}

const NON_TEACHING_ROOM_TYPES = new Set<RoomType>(['LIBRARY', 'FACULTY_ROOM', 'OFFICE', 'OTHER']);

// Helper to build rooms for a grade-level building
function buildGradeLevelRooms(gradeLevel: number, numRoomsPerFloor: number): SeedRoom[] {
	const rooms: SeedRoom[] = [];
	const baseNum = (gradeLevel - 7) * 100 + 1; // G7: 1-20, G8: 101-124, etc.
	let roomNumber = baseNum;

	for (let floor = 1; floor <= 4; floor++) {
		for (let pos = 0; pos < numRoomsPerFloor; pos++) {
			rooms.push({
				name: `G${gradeLevel} Room ${String(floor)}${String(pos + 1).padStart(2, '0')}`,
				floor,
				type: 'CLASSROOM',
				capacity: 45,
				floorPosition: pos,
			});
			roomNumber++;
		}
	}

	return rooms;
}

const REALISTIC_CAMPUS_BUILDINGS: SeedBuilding[] = [
	// ─── Grade-Level Dedicated Buildings (20-24 rooms each, 4 floors) ───
	{
		name: 'Grade 7 Academic Wing',
		x: 20,
		y: 20,
		width: 180,
		height: 280,
		color: '#3b82f6',
		floorCount: 4,
		rooms: buildGradeLevelRooms(7, 5), // 5 rooms × 4 floors = 20 rooms
	},
	{
		name: 'Grade 8 Academic Wing',
		x: 220,
		y: 20,
		width: 200,
		height: 280,
		color: '#8b5cf6',
		floorCount: 4,
		rooms: buildGradeLevelRooms(8, 6), // 6 rooms × 4 floors = 24 rooms
	},
	{
		name: 'Grade 9 Academic Wing',
		x: 440,
		y: 20,
		width: 180,
		height: 280,
		color: '#ec4899',
		floorCount: 4,
		rooms: buildGradeLevelRooms(9, 5), // 5 rooms × 4 floors = 20 rooms
	},
	{
		name: 'Grade 10 Academic Wing',
		x: 640,
		y: 20,
		width: 180,
		height: 280,
		color: '#f59e0b',
		floorCount: 4,
		rooms: buildGradeLevelRooms(10, 5), // 5 rooms × 4 floors = 20 rooms
	},
	// ─── Shared Specialized Facilities ───
	{
		name: 'Science and Innovation Center',
		x: 20,
		y: 320,
		width: 200,
		height: 160,
		color: '#16a34a',
		floorCount: 2,
		rooms: [
			{ name: 'Chemistry Lab', floor: 1, type: 'LABORATORY', capacity: 40, floorPosition: 0 },
			{ name: 'Biology Lab', floor: 1, type: 'LABORATORY', capacity: 40, floorPosition: 1 },
			{ name: 'Physics Lab', floor: 2, type: 'LABORATORY', capacity: 36, floorPosition: 0 },
			{ name: 'Computer Lab 1', floor: 2, type: 'COMPUTER_LAB', capacity: 40, floorPosition: 1 },
			{ name: 'STE Research Room', floor: 2, type: 'CLASSROOM', capacity: 28, floorPosition: 2 },
		],
	},
	{
		name: 'MAPEH and Wellness Hub',
		x: 240,
		y: 320,
		width: 200,
		height: 160,
		color: '#ea580c',
		floorCount: 1,
		rooms: [
			{ name: 'Covered Court', floor: 1, type: 'GYMNASIUM', capacity: 160, floorPosition: 0 },
			{ name: 'Dance Studio', floor: 1, type: 'CLASSROOM', capacity: 32, floorPosition: 1 },
			{ name: 'Music Room', floor: 1, type: 'CLASSROOM', capacity: 30, floorPosition: 2 },
			{ name: 'Arts Studio', floor: 1, type: 'CLASSROOM', capacity: 28, floorPosition: 3 },
		],
	},
	{
		name: 'TLE and Livelihood Center',
		x: 460,
		y: 320,
		width: 200,
		height: 160,
		color: '#d97706',
		floorCount: 2,
		rooms: [
			{ name: 'Industrial Arts Shop', floor: 1, type: 'TLE_WORKSHOP', capacity: 35, floorPosition: 0 },
			{ name: 'Electronics Lab', floor: 1, type: 'TLE_WORKSHOP', capacity: 32, floorPosition: 1 },
			{ name: 'Home Economics Lab', floor: 2, type: 'LABORATORY', capacity: 34, floorPosition: 0 },
			{ name: 'AFA Demonstration Room', floor: 2, type: 'LABORATORY', capacity: 34, floorPosition: 1 },
			{ name: 'Entrepreneurship Room', floor: 2, type: 'CLASSROOM', capacity: 30, floorPosition: 2 },
		],
	},
	{
		name: 'Admin and Learning Commons',
		x: 680,
		y: 320,
		width: 180,
		height: 160,
		color: '#7c3aed',
		floorCount: 2,
		isTeachingBuilding: false,
		rooms: [
			{ name: 'Learning Commons', floor: 1, type: 'LIBRARY', capacity: 80, floorPosition: 0, isTeachingSpace: false },
			{ name: 'Guidance Office', floor: 1, type: 'OFFICE', capacity: 8, floorPosition: 1, isTeachingSpace: false },
			{ name: 'Principal Office', floor: 2, type: 'OFFICE', capacity: 6, floorPosition: 0, isTeachingSpace: false },
			{ name: 'Faculty Room', floor: 2, type: 'FACULTY_ROOM', capacity: 20, floorPosition: 1, isTeachingSpace: false },
			{ name: 'Registrar Annex', floor: 2, type: 'OFFICE', capacity: 6, floorPosition: 2, isTeachingSpace: false },
		],
	},
];

function roomStableKey(name: string, floor: number): string {
	return `${floor}:${name.trim().toLowerCase()}`;
}

async function resetMapData(schoolId: number) {
	await prisma.$transaction([
		prisma.building.deleteMany({ where: { schoolId } }),
		prisma.school.update({
			where: { id: schoolId },
			data: { campusImageUrl: null },
		}),
	]);
}

export async function seedCampusMap(schoolId: number, resetMap: boolean): Promise<MapSeedSummary> {
	if (resetMap) {
		await resetMapData(schoolId);
	}

	let buildingsCreated = 0;
	let buildingsMatched = 0;
	let roomsCreated = 0;
	let roomsMatched = 0;

	for (const building of REALISTIC_CAMPUS_BUILDINGS) {
		const generatedShortCode = generateBuildingShortCode(building.name);
		const existing = await prisma.building.findFirst({
			where: {
				schoolId,
				OR: [{ name: building.name }, { shortCode: generatedShortCode }],
			},
			include: { rooms: true },
		});

		if (!existing) {
			await prisma.building.create({
				data: {
					schoolId,
					name: building.name,
					shortCode: generatedShortCode,
					x: building.x,
					y: building.y,
					width: building.width,
					height: building.height,
					rotation: building.rotation ?? 0,
					color: building.color,
					floorCount: building.floorCount,
					isTeachingBuilding: building.isTeachingBuilding ?? true,
					rooms: {
						create: building.rooms.map((room) => ({
							name: room.name,
							floor: room.floor,
							type: room.type,
							capacity: room.capacity,
							floorPosition: room.floorPosition,
							isTeachingSpace:
								building.isTeachingBuilding === false || NON_TEACHING_ROOM_TYPES.has(room.type)
									? false
									: room.isTeachingSpace ?? true,
						})),
					},
				},
			});

			buildingsCreated++;
			roomsCreated += building.rooms.length;
			continue;
		}

		buildingsMatched++;
		const existingRoomKeys = new Set(existing.rooms.map((room) => roomStableKey(room.name, room.floor)));
		roomsMatched += building.rooms.filter((room) => existingRoomKeys.has(roomStableKey(room.name, room.floor))).length;

		const missingRooms = building.rooms.filter((room) => !existingRoomKeys.has(roomStableKey(room.name, room.floor)));
		if (missingRooms.length > 0) {
			const created = await prisma.room.createMany({
				data: missingRooms.map((room) => ({
					buildingId: existing.id,
					name: room.name,
					floor: room.floor,
					type: room.type,
					capacity: room.capacity,
					floorPosition: room.floorPosition,
					isTeachingSpace:
						existing.isTeachingBuilding === false || NON_TEACHING_ROOM_TYPES.has(room.type)
							? false
							: room.isTeachingSpace ?? true,
				})),
			});
			roomsCreated += created.count;
		}
	}

	return {
		buildingsCreated,
		buildingsMatched,
		roomsCreated,
		roomsMatched,
		mapResetApplied: resetMap,
	};
}
