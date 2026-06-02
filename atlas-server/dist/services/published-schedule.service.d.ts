type PublishedScheduleReadOptions = {
    requestedDate?: string | Date | null;
};
export declare function getPublishedSchedulePayload(schoolId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions, filter?: {
    sectionId?: number;
    facultyId?: number;
    roomId?: number;
}): Promise<{
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
        requestedDate: string | null;
        resolvedForDate: string;
        activeRevisionId: number | null;
        activeRevisionEffectiveDate: string | null;
        appliedRevisionIds: number[];
        revisionMarker: string;
    };
    timeSlots: {
        startTime: string;
        endTime: string;
    }[];
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
            gradeLevel: number | null;
            gradeLevelName: string | null;
            programType: string | null;
            programCode: string | null;
            programName: string | null;
        };
        faculty: {
            id: number | null;
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
        cohortName: string | null;
        specializationCode: string | null;
        specializationLabel: string | null;
    }[];
}>;
export declare function getPublishedSectionSchedule(schoolId: number, sectionId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions): Promise<{
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
        requestedDate: string | null;
        resolvedForDate: string;
        activeRevisionId: number | null;
        activeRevisionEffectiveDate: string | null;
        appliedRevisionIds: number[];
        revisionMarker: string;
    };
    timeSlots: {
        startTime: string;
        endTime: string;
    }[];
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
            gradeLevel: number | null;
            gradeLevelName: string | null;
            programType: string | null;
            programCode: string | null;
            programName: string | null;
        };
        faculty: {
            id: number | null;
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
        cohortName: string | null;
        specializationCode: string | null;
        specializationLabel: string | null;
    }[];
}>;
export declare function getPublishedFacultySchedule(schoolId: number, facultyId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions): Promise<{
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
        requestedDate: string | null;
        resolvedForDate: string;
        activeRevisionId: number | null;
        activeRevisionEffectiveDate: string | null;
        appliedRevisionIds: number[];
        revisionMarker: string;
    };
    timeSlots: {
        startTime: string;
        endTime: string;
    }[];
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
            gradeLevel: number | null;
            gradeLevelName: string | null;
            programType: string | null;
            programCode: string | null;
            programName: string | null;
        };
        faculty: {
            id: number | null;
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
        cohortName: string | null;
        specializationCode: string | null;
        specializationLabel: string | null;
    }[];
}>;
export declare function getPublishedRoomSchedule(schoolId: number, roomId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions): Promise<{
    source: {
        runId: number;
        schoolId: number;
        schoolYearId: number;
        publishedAt: string | null;
        generatedAt: string;
        requestedDate: string | null;
        resolvedForDate: string;
        activeRevisionId: number | null;
        activeRevisionEffectiveDate: string | null;
        appliedRevisionIds: number[];
        revisionMarker: string;
    };
    timeSlots: {
        startTime: string;
        endTime: string;
    }[];
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
            gradeLevel: number | null;
            gradeLevelName: string | null;
            programType: string | null;
            programCode: string | null;
            programName: string | null;
        };
        faculty: {
            id: number | null;
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
        cohortName: string | null;
        specializationCode: string | null;
        specializationLabel: string | null;
    }[];
}>;
export {};
