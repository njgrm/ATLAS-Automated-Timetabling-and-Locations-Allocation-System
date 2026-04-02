export declare function syncFacultyFromExternal(schoolId: number, authToken?: string): Promise<{
    synced: boolean;
    error: string;
    count?: undefined;
} | {
    synced: boolean;
    count: number;
    error?: undefined;
}>;
export declare function getFacultyBySchool(schoolId: number): Promise<any>;
export declare function getFacultyById(id: number): Promise<any>;
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
    faculty: any;
    error?: undefined;
}>;
export declare function getFacultyCountBySchool(schoolId: number): Promise<number>;
export declare function getLastSyncTime(schoolId: number): Promise<Date | null>;
