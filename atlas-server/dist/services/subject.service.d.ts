export declare function ensureDefaultSubjects(schoolId: number): Promise<void>;
export declare function getSubjectsBySchool(schoolId: number): Promise<{
    id: number;
    schoolId: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
    minMinutesPerWeek: number;
    preferredRoomType: import("@prisma/client").$Enums.RoomType;
    gradeLevels: number[];
    isActive: boolean;
    isSeedable: boolean;
}[]>;
export declare function getSubjectById(id: number): Promise<{
    id: number;
    schoolId: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
    minMinutesPerWeek: number;
    preferredRoomType: import("@prisma/client").$Enums.RoomType;
    gradeLevels: number[];
    isActive: boolean;
    isSeedable: boolean;
} | null>;
export declare function createSubject(schoolId: number, data: {
    code: string;
    name: string;
    minMinutesPerWeek: number;
    preferredRoomType: string;
    gradeLevels: number[];
}): Promise<{
    id: number;
    schoolId: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
    minMinutesPerWeek: number;
    preferredRoomType: import("@prisma/client").$Enums.RoomType;
    gradeLevels: number[];
    isActive: boolean;
    isSeedable: boolean;
}>;
export declare function updateSubject(id: number, data: Partial<{
    name: string;
    minMinutesPerWeek: number;
    preferredRoomType: string;
    gradeLevels: number[];
    isActive: boolean;
}>): Promise<{
    id: number;
    schoolId: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
    minMinutesPerWeek: number;
    preferredRoomType: import("@prisma/client").$Enums.RoomType;
    gradeLevels: number[];
    isActive: boolean;
    isSeedable: boolean;
} | null>;
export declare function deleteSubject(id: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getSubjectCountBySchool(schoolId: number): Promise<number>;
export declare function getSubjectsWithoutFaculty(schoolId: number): Promise<{
    id: number;
    name: string;
    code: string;
}[]>;
