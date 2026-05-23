import type { RoomType } from '@/types';

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

export const SUBJECT_OWNER_LABELS: Record<string, string> = {
	SCI: 'Science',
	MATH: 'Mathematics',
	ENG: 'English',
	TLE: 'TLE',
	FIL: 'Filipino',
	ESP: 'ESP/Guidance',
	MAPEH: 'MAPEH',
	AP: 'Araling Panlipunan',
	SPA: 'SPA',
	SPS: 'SPS',
};

export const SUBJECT_OWNER_OPTIONS = [
	{ value: 'UNASSIGNED', label: 'Unassigned' },
	{ value: 'AP', label: SUBJECT_OWNER_LABELS.AP },
	{ value: 'ENG', label: SUBJECT_OWNER_LABELS.ENG },
	{ value: 'ESP', label: SUBJECT_OWNER_LABELS.ESP },
	{ value: 'FIL', label: SUBJECT_OWNER_LABELS.FIL },
	{ value: 'MAPEH', label: SUBJECT_OWNER_LABELS.MAPEH },
	{ value: 'MATH', label: SUBJECT_OWNER_LABELS.MATH },
	{ value: 'SCI', label: SUBJECT_OWNER_LABELS.SCI },
	{ value: 'TLE', label: SUBJECT_OWNER_LABELS.TLE },
	{ value: 'SPA', label: SUBJECT_OWNER_LABELS.SPA },
	{ value: 'SPS', label: SUBJECT_OWNER_LABELS.SPS },
] as const;

export const SUBJECT_OWNER_BADGE: Record<string, string> = {
	SCI: 'bg-blue-50 text-blue-700 border-blue-200',
	MATH: 'bg-cyan-50 text-cyan-700 border-cyan-200',
	ENG: 'bg-violet-50 text-violet-700 border-violet-200',
	TLE: 'bg-amber-50 text-amber-700 border-amber-200',
	FIL: 'bg-rose-50 text-rose-700 border-rose-200',
	ESP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	MAPEH: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
	AP: 'bg-orange-50 text-orange-700 border-orange-200',
	SPA: 'bg-purple-50 text-purple-700 border-purple-200',
	SPS: 'bg-lime-50 text-lime-700 border-lime-200',
};

/** Unified department color dictionary for consistent across-page signaling */
export const DEPARTMENT_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
	SCI: { bg: 'bg-blue-50/50', text: 'text-blue-700', border: 'border-blue-200/50', icon: 'bg-blue-100 text-blue-600' },
	MATH: { bg: 'bg-cyan-50/50', text: 'text-cyan-700', border: 'border-cyan-200/50', icon: 'bg-cyan-100 text-cyan-600' },
	ENG: { bg: 'bg-violet-50/50', text: 'text-violet-700', border: 'border-violet-200/50', icon: 'bg-violet-100 text-violet-600' },
	TLE: { bg: 'bg-amber-50/50', text: 'text-amber-700', border: 'border-amber-200/50', icon: 'bg-amber-100 text-amber-600' },
	FIL: { bg: 'bg-rose-50/50', text: 'text-rose-700', border: 'border-rose-200/50', icon: 'bg-rose-100 text-rose-600' },
	ESP: { bg: 'bg-emerald-50/50', text: 'text-emerald-700', border: 'border-emerald-200/50', icon: 'bg-emerald-100 text-emerald-600' },
	MAPEH: { bg: 'bg-fuchsia-50/50', text: 'text-fuchsia-700', border: 'border-fuchsia-200/50', icon: 'bg-fuchsia-100 text-fuchsia-600' },
	AP: { bg: 'bg-orange-50/50', text: 'text-orange-700', border: 'border-orange-200/50', icon: 'bg-orange-100 text-orange-600' },
	SPA: { bg: 'bg-purple-50/50', text: 'text-purple-700', border: 'border-purple-200/50', icon: 'bg-purple-100 text-purple-600' },
	SPS: { bg: 'bg-lime-50/50', text: 'text-lime-700', border: 'border-lime-200/50', icon: 'bg-lime-100 text-lime-600' },
	UNASSIGNED: { bg: 'bg-gray-50/50', text: 'text-gray-600', border: 'border-gray-200/50', icon: 'bg-gray-100 text-gray-500' },
};

export const QUALIFICATION_PRIORITY_LABELS: Record<'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY', string> = {
	DEPARTMENT_FIRST: 'Department-first',
	SPECIALIZATION_PRIMARY: 'Specialization-first',
};

export const QUALIFICATION_PRIORITY_OPTIONS = [
	{ value: 'DEPARTMENT_FIRST', label: 'Department-first' },
] as const;

export type NewSubjectForm = {
	code: string;
	outputLabel: string;
	name: string;
	ownerDepartment: string;
	allowedOwnerDepartments: string[];
	qualificationPriority: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
	rotationFamily: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	isActive: boolean;
	isSeedable: boolean;
	isSystemManaged: boolean;
	gradeLevels: number[];
	interSectionEnabled: boolean;
	interSectionGradeLevels: number[];
	modularGroupId: string;
	modularOrder: number | null;
	programScopes: string[];
	allowedSpecializations: string[];
	requiredFeatures: string[];
};

export const emptyForm: NewSubjectForm = {
	code: '',
	outputLabel: '',
	name: '',
	ownerDepartment: '',
	allowedOwnerDepartments: [],
	qualificationPriority: 'DEPARTMENT_FIRST',
	rotationFamily: '',
	minMinutesPerWeek: 225,
	preferredRoomType: 'CLASSROOM',
	isActive: true,
	isSeedable: false,
	isSystemManaged: false,
	gradeLevels: [7, 8, 9, 10],
	interSectionEnabled: false,
	interSectionGradeLevels: [],
	modularGroupId: '',
	modularOrder: null,
	programScopes: ['REGULAR'],
	allowedSpecializations: [],
	requiredFeatures: [],
};
