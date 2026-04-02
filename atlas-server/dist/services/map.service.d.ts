export declare function getBuildingsBySchool(schoolId: number): Promise<any>;
export declare function getBuilding(id: number): Promise<any>;
export declare function upsertBuilding(schoolId: number, data: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    rotation?: number;
    floorCount?: number;
    isTeachingBuilding?: boolean;
}): Promise<any>;
export declare function updateBuilding(id: number, data: Partial<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    rotation: number;
    floorCount: number;
    isTeachingBuilding: boolean;
}>): Promise<any>;
export declare function deleteBuilding(id: number): Promise<any>;
export declare function addRoom(buildingId: number, data: {
    name: string;
    floor?: number;
    type?: string;
    capacity?: number;
    isTeachingSpace?: boolean;
    floorPosition?: number;
}): Promise<any>;
export declare function deleteRoom(id: number): Promise<any>;
export declare function updateRoom(id: number, data: Partial<{
    name: string;
    floor: number;
    type: string;
    capacity: number | null;
    isTeachingSpace: boolean;
    floorPosition: number;
}>): Promise<any>;
export declare function getCampusImage(schoolId: number): Promise<any>;
export declare function setCampusImage(schoolId: number, imageUrl: string): Promise<any>;
