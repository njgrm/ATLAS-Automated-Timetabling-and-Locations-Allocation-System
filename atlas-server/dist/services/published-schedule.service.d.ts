export declare function getPublishedSchedulePayload(schoolId: number, schoolYearId?: number): Promise<{
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
    };
    specialEvents: {
        eventName: string | undefined;
        startTime: string;
        endTime: string;
        days: string[];
    }[];
    entries: {
        entryId: string;
        day: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
        subject: {
            id: number;
            code: string;
            name: string;
        };
        section: {
            id: number;
            name: string;
        };
        faculty: {
            id: number;
            name: string;
        };
        room: {
            id: number;
            name: string;
            type: string;
            floor: number | null;
            buildingId: number | null;
            buildingName: string | null;
        };
        entryKind: "SECTION" | "COHORT";
        cohortCode: string | null;
    }[];
}>;
export declare function getPublishedSectionSchedule(schoolId: number, sectionId: number, schoolYearId?: number): Promise<{
    entries: {
        entryId: string;
        day: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
        subject: {
            id: number;
            code: string;
            name: string;
        };
        section: {
            id: number;
            name: string;
        };
        faculty: {
            id: number;
            name: string;
        };
        room: {
            id: number;
            name: string;
            type: string;
            floor: number | null;
            buildingId: number | null;
            buildingName: string | null;
        };
        entryKind: "SECTION" | "COHORT";
        cohortCode: string | null;
    }[];
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
    };
    specialEvents: {
        eventName: string | undefined;
        startTime: string;
        endTime: string;
        days: string[];
    }[];
}>;
export declare function getPublishedFacultySchedule(schoolId: number, facultyId: number, schoolYearId?: number): Promise<{
    entries: {
        entryId: string;
        day: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
        subject: {
            id: number;
            code: string;
            name: string;
        };
        section: {
            id: number;
            name: string;
        };
        faculty: {
            id: number;
            name: string;
        };
        room: {
            id: number;
            name: string;
            type: string;
            floor: number | null;
            buildingId: number | null;
            buildingName: string | null;
        };
        entryKind: "SECTION" | "COHORT";
        cohortCode: string | null;
    }[];
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
    };
    specialEvents: {
        eventName: string | undefined;
        startTime: string;
        endTime: string;
        days: string[];
    }[];
}>;
export declare function getPublishedRoomSchedule(schoolId: number, roomId: number, schoolYearId?: number): Promise<{
    entries: {
        entryId: string;
        day: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
        subject: {
            id: number;
            code: string;
            name: string;
        };
        section: {
            id: number;
            name: string;
        };
        faculty: {
            id: number;
            name: string;
        };
        room: {
            id: number;
            name: string;
            type: string;
            floor: number | null;
            buildingId: number | null;
            buildingName: string | null;
        };
        entryKind: "SECTION" | "COHORT";
        cohortCode: string | null;
    }[];
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
    };
    specialEvents: {
        eventName: string | undefined;
        startTime: string;
        endTime: string;
        days: string[];
    }[];
}>;
