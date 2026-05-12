import type { RoomType, SessionPattern } from '@/types';

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
	CLASSROOM: 'Classroom',
	LABORATORY: 'Science Laboratory',
	COMPUTER_LAB: 'ICT / Computer Lab',
	TLE_WORKSHOP: 'TLE Workshop',
	LIBRARY: 'Library',
	GYMNASIUM: 'Gymnasium',
	FACULTY_ROOM: 'Faculty Room',
	OFFICE: 'Office',
	OTHER: 'Other',
};

export const ALL_ROOM_TYPES = Object.keys(ROOM_TYPE_LABELS) as RoomType[];
export const GRADE_OPTIONS = [7, 8, 9, 10];

export const PROGRAM_SCOPE_OPTIONS = [
	{ value: 'REGULAR', label: 'Regular' },
	{ value: 'STE', label: 'STE' },
	{ value: 'SPA', label: 'SPA' },
	{ value: 'SPS', label: 'SPS' },
	{ value: 'OTHER', label: 'Other' },
] as const;

export const PROGRAM_SCOPE_BADGE: Record<string, string> = {
	REGULAR: 'bg-sky-50 text-sky-700 border-sky-200',
	STE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	SPA: 'bg-purple-50 text-purple-700 border-purple-200',
	SPS: 'bg-orange-50 text-orange-700 border-orange-200',
	OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const SESSION_PATTERN_LABELS: Record<SessionPattern, string> = {
	ANY: 'Any Day',
	MWF: 'Mon / Wed / Fri',
	TTH: 'Tue / Thu',
};

export const SESSION_PATTERN_BADGE: Record<SessionPattern, string> = {
	ANY: 'bg-gray-100 text-gray-600 border-gray-300',
	MWF: 'bg-indigo-50 text-indigo-700 border-indigo-200',
	TTH: 'bg-amber-50 text-amber-700 border-amber-200',
};

export type NewSubjectForm = {
	code: string;
	name: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	sessionPattern: SessionPattern;
	gradeLevels: number[];
	interSectionEnabled: boolean;
	interSectionGradeLevels: number[];
	programScopes: string[];
	allowedSpecializations: string[];
	requiredFeatures: string[];
};

export const emptyForm: NewSubjectForm = {
	code: '',
	name: '',
	minMinutesPerWeek: 45,
	preferredRoomType: 'CLASSROOM',
	sessionPattern: 'ANY',
	gradeLevels: [7, 8, 9, 10],
	interSectionEnabled: false,
	interSectionGradeLevels: [],
	programScopes: ['REGULAR'],
	allowedSpecializations: [],
	requiredFeatures: [],
};
