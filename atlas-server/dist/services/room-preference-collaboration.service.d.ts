import type { Server as HttpServer } from 'node:http';
export type CollaborationViewMode = 'FACULTY_ACTIVE_DRAFT' | 'SCHEDULER_REVIEW' | 'SCHEDULER_QUEUE';
export type CollaborationSelection = {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    day?: string;
    startTime?: string;
    endTime?: string;
    entryId?: string;
    source?: 'GRID_CELL' | 'REQUEST_CARD' | 'SESSION';
};
export type CollaborationPresence = {
    connectionId: string;
    userId: number;
    role: string;
    email: string | null;
    schoolId: number;
    schoolYearId: number;
    runId: number;
    viewMode: CollaborationViewMode;
    lastActive: string;
};
type CollaborationOptions = {
    path?: string;
    heartbeatTimeoutMs?: number;
    pruneIntervalMs?: number;
};
export declare function registerRoomPreferenceCollaborationSocket(server: HttpServer, options?: CollaborationOptions): {
    path: string;
    dispose: () => void;
};
export {};
