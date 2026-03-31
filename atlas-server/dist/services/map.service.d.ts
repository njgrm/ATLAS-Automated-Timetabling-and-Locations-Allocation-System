export declare function getBuildingsBySchool(schoolId: number): Promise<({
    rooms: {
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        floorPosition: number;
        floor: number;
        buildingId: number;
        type: import("@prisma/client").$Enums.RoomType;
        capacity: number | null;
        isTeachingSpace: boolean;
    }[];
} & {
    id: number;
    schoolId: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
    floorCount: number;
    isTeachingBuilding: boolean;
    createdAt: Date;
    updatedAt: Date;
})[]>;
export declare function getBuilding(id: number): Promise<({
    rooms: {
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        floorPosition: number;
        floor: number;
        buildingId: number;
        type: import("@prisma/client").$Enums.RoomType;
        capacity: number | null;
        isTeachingSpace: boolean;
    }[];
} & {
    id: number;
    schoolId: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
    floorCount: number;
    isTeachingBuilding: boolean;
    createdAt: Date;
    updatedAt: Date;
}) | null>;
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
}): Promise<{
    rooms: {
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        floorPosition: number;
        floor: number;
        buildingId: number;
        type: import("@prisma/client").$Enums.RoomType;
        capacity: number | null;
        isTeachingSpace: boolean;
    }[];
} & {
    id: number;
    schoolId: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
    floorCount: number;
    isTeachingBuilding: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
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
}>): Promise<{
    rooms: {
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        floorPosition: number;
        floor: number;
        buildingId: number;
        type: import("@prisma/client").$Enums.RoomType;
        capacity: number | null;
        isTeachingSpace: boolean;
    }[];
} & {
    id: number;
    schoolId: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
    floorCount: number;
    isTeachingBuilding: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deleteBuilding(id: number): Promise<{
    id: number;
    schoolId: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
    floorCount: number;
    isTeachingBuilding: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function addRoom(buildingId: number, data: {
    name: string;
    floor?: number;
    type?: string;
    capacity?: number;
    isTeachingSpace?: boolean;
    floorPosition?: number;
}): Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    floorPosition: number;
    floor: number;
    buildingId: number;
    type: import("@prisma/client").$Enums.RoomType;
    capacity: number | null;
    isTeachingSpace: boolean;
}>;
export declare function deleteRoom(id: number): Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    floorPosition: number;
    floor: number;
    buildingId: number;
    type: import("@prisma/client").$Enums.RoomType;
    capacity: number | null;
    isTeachingSpace: boolean;
}>;
export declare function updateRoom(id: number, data: Partial<{
    name: string;
    floor: number;
    type: string;
    capacity: number | null;
    isTeachingSpace: boolean;
    floorPosition: number;
}>): Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    floorPosition: number;
    floor: number;
    buildingId: number;
    type: import("@prisma/client").$Enums.RoomType;
    capacity: number | null;
    isTeachingSpace: boolean;
}>;
export declare function getCampusImage(schoolId: number): Promise<string | null>;
export declare function setCampusImage(schoolId: number, imageUrl: string): Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    shortName: string;
    campusImageUrl: string | null;
}>;
