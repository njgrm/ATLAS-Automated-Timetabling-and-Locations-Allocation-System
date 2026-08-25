type ExportOptions = {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    termIndex?: number | 'active';
};
export declare function exportSummaryWorkbook(options: ExportOptions): Promise<Buffer>;
export declare function exportClassProgramWorkbook(options: ExportOptions): Promise<Buffer>;
export {};
