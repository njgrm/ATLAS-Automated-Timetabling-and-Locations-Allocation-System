export type RoomType =
	| 'CLASSROOM'
	| 'LABORATORY'
	| 'COMPUTER_LAB'
	| 'TLE_WORKSHOP'
	| 'LIBRARY'
	| 'GYMNASIUM'
	| 'FACULTY_ROOM'
	| 'OFFICE'
	| 'OTHER';

export type Room = {
	id: number;
	name: string;
	floor: number;
	type: RoomType;
	capacity: number | null;
	isTeachingSpace: boolean;
	floorPosition: number;
	buildingId: number;
};

export type Building = {
	id: number;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	color: string;
	floorCount: number;
	isTeachingBuilding: boolean;
	rooms: Room[];
};

export type BridgeUser = {
	userId: number;
	role: string;
	mustChangePassword?: boolean;
};

export type Subject = {
	id: number;
	schoolId: number;
	code: string;
	name: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	gradeLevels: number[];
	isActive: boolean;
	isSeedable: boolean;
	createdAt: string;
	updatedAt: string;
};

export type FacultyMirror = {
	id: number;
	externalId: number;
	schoolId: number;
	firstName: string;
	lastName: string;
	department: string | null;
	contactInfo: string | null;
	localNotes: string | null;
	isActiveForScheduling: boolean;
	maxHoursPerWeek: number;
	lastSyncedAt: string;
	version: number;
	facultySubjects?: FacultySubject[];
};

export type FacultySubject = {
	id: number;
	facultyId: number;
	subjectId: number;
	schoolId: number;
	gradeLevels: number[];
	assignedBy: number;
	assignedAt: string;
	version: number;
	subject?: Subject;
};
