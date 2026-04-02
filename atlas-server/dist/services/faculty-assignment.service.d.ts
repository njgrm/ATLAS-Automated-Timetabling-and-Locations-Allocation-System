export declare function getAssignmentsByFaculty(facultyId: number): Promise<any>;
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
export declare function getAssignmentSummary(schoolId: number): Promise<any>;
