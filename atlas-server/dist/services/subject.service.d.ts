export declare function ensureDefaultSubjects(schoolId: number): Promise<void>;
export declare function getSubjectsBySchool(schoolId: number): Promise<any>;
export declare function getSubjectById(id: number): Promise<any>;
export declare function createSubject(schoolId: number, data: {
    code: string;
    name: string;
    minMinutesPerWeek: number;
    preferredRoomType: string;
    gradeLevels: number[];
}): Promise<any>;
export declare function updateSubject(id: number, data: Partial<{
    name: string;
    minMinutesPerWeek: number;
    preferredRoomType: string;
    gradeLevels: number[];
    isActive: boolean;
}>): Promise<any>;
export declare function deleteSubject(id: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getSubjectCountBySchool(schoolId: number): Promise<number>;
export declare function getSubjectsWithoutFaculty(schoolId: number): Promise<any>;
