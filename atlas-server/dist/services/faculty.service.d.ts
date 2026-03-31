export declare function syncFacultyFromExternal(schoolId: number, authToken?: string): Promise<{
    synced: boolean;
    error: string;
    count?: undefined;
} | {
    synced: boolean;
    count: number;
    error?: undefined;
}>;
export declare function getFacultyBySchool(schoolId: number): Promise<({
    facultySubjects: ({
        subject: {
            id: number;
            name: string;
            code: string;
        };
    } & {
        id: number;
        schoolId: number;
        createdAt: Date;
        updatedAt: Date;
        gradeLevels: number[];
        facultyId: number;
        subjectId: number;
        assignedBy: number;
        assignedAt: Date;
        version: number;
    })[];
} & {
    id: number;
    schoolId: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    externalId: number;
    firstName: string;
    lastName: string;
    department: string | null;
    contactInfo: string | null;
    localNotes: string | null;
    isActiveForScheduling: boolean;
    maxHoursPerWeek: number;
    lastSyncedAt: Date;
})[]>;
export declare function getFacultyById(id: number): Promise<({
    facultySubjects: ({
        subject: {
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
        };
    } & {
        id: number;
        schoolId: number;
        createdAt: Date;
        updatedAt: Date;
        gradeLevels: number[];
        facultyId: number;
        subjectId: number;
        assignedBy: number;
        assignedAt: Date;
        version: number;
    })[];
} & {
    id: number;
    schoolId: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    externalId: number;
    firstName: string;
    lastName: string;
    department: string | null;
    contactInfo: string | null;
    localNotes: string | null;
    isActiveForScheduling: boolean;
    maxHoursPerWeek: number;
    lastSyncedAt: Date;
}) | null>;
export declare function updateFacultyMirror(id: number, data: Partial<{
    localNotes: string;
    isActiveForScheduling: boolean;
    maxHoursPerWeek: number;
}>, expectedVersion: number): Promise<{
    success: false;
    error: string;
    faculty?: undefined;
} | {
    success: true;
    faculty: {
        id: number;
        schoolId: number;
        createdAt: Date;
        updatedAt: Date;
        version: number;
        externalId: number;
        firstName: string;
        lastName: string;
        department: string | null;
        contactInfo: string | null;
        localNotes: string | null;
        isActiveForScheduling: boolean;
        maxHoursPerWeek: number;
        lastSyncedAt: Date;
    };
    error?: undefined;
}>;
export declare function getFacultyCountBySchool(schoolId: number): Promise<number>;
export declare function getLastSyncTime(schoolId: number): Promise<Date | null>;
