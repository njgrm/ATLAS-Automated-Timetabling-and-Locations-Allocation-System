/**
 * Section service — Wave 5 Durable Mirroring
 * Bridges to section adapter and maintains a local SectionMirror
 * for high availability and local overrides.
 */
import { type SectionSummary } from './section-adapter.js';
type HomeRoomProgramType = 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER';
type HomeRoomControlSection = {
    id: number;
    externalId: number;
    name: string;
    gradeLevelId: number;
    gradeLevelName: string;
    programType: HomeRoomProgramType;
    homeRoomId: number | null;
    buildingZoneId: string | null;
};
type HomeRoomControlRoom = {
    id: number;
    name: string;
    type: string;
    capacity: number | null;
    buildingId: number;
    buildingName: string;
    shortCode: string | null;
    buildingZoneId: string | null;
};
export type HomeRoomControlPayload = {
    schoolId: number;
    schoolYearId: number;
    sections: HomeRoomControlSection[];
    rooms: HomeRoomControlRoom[];
};
export declare function syncSectionsFromExternal(schoolId: number, schoolYearId: number, authToken?: string): Promise<{
    synced: boolean;
    count: number;
    removed: number;
    source: string;
    fetchedAt: Date;
}>;
export declare function getSectionSummary(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionSummary>;
export declare function getHomeRoomControlData(schoolYearId: number, schoolId: number): Promise<HomeRoomControlPayload>;
export declare function updateSectionHomeRooms(schoolId: number, schoolYearId: number, assignments: Array<{
    sectionId: number;
    homeRoomId: number | null;
}>): Promise<{
    updated: number;
}>;
type SpecialProgramPlacementIssueCode = 'NO_PROGRAM_ROOM_AVAILABLE';
type SpecialProgramPlacementIssue = {
    sectionId: number;
    externalId: number;
    gradeLevelId: number;
    programType: 'SPA' | 'SPS';
    sectionName: string;
    issueCode: SpecialProgramPlacementIssueCode;
    message: string;
};
type SpecialProgramPlacementResult = {
    affectedSections: number;
    missingHomeRoomBefore: number;
    missingBuildingZoneBefore: number;
    updated: number;
    remainingMissingHomeRoom: number;
    remainingMissingBuildingZone: number;
    issues: SpecialProgramPlacementIssue[];
    assignments: Array<{
        sectionId: number;
        externalId: number;
        gradeLevelId: number;
        programType: 'SPA' | 'SPS';
        sectionName: string;
        homeRoomId: number;
        buildingZoneId: string;
        roomName: string;
    }>;
};
export declare function applySpecialProgramPlacementOverlay(schoolId: number, schoolYearId: number): Promise<SpecialProgramPlacementResult>;
export {};
