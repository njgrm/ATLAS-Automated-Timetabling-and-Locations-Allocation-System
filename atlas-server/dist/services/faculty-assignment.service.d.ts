export declare function getAssignmentsByFaculty(facultyId: number): Promise<({
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
})[]>;
export declare function setAssignments(facultyId: number, schoolId: number, assignedBy: number, assignments: {
    subjectId: number;
    gradeLevels: number[];
}[]): Promise<{
    success: false;
    error: string;
} | {
    success: true;
    error?: undefined;
}>;
export declare function getAssignmentSummary(schoolId: number): Promise<{
    id: number;
    externalId: number;
    firstName: string;
    lastName: string;
    department: string | null;
    isActiveForScheduling: boolean;
    maxHoursPerWeek: number;
    subjectCount: number;
    subjectHours: number;
    assignments: ({
        subject: {
            id: number;
            name: string;
            code: string;
            minMinutesPerWeek: number;
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
}[]>;
