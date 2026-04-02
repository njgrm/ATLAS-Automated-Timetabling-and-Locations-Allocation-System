/**
 * Scheduling policy service — CRUD and default-fallback for school/year policy.
 * Business logic only; no transport concerns.
 */
export declare const POLICY_DEFAULTS: {
    readonly maxConsecutiveTeachingMinutesBeforeBreak: 120;
    readonly minBreakMinutesAfterConsecutiveBlock: 15;
    readonly maxTeachingMinutesPerDay: 400;
    readonly earliestStartTime: "07:00";
    readonly latestEndTime: "17:00";
    readonly enforceConsecutiveBreakAsHard: false;
};
export interface SchedulingPolicyData {
    maxConsecutiveTeachingMinutesBeforeBreak: number;
    minBreakMinutesAfterConsecutiveBlock: number;
    maxTeachingMinutesPerDay: number;
    earliestStartTime: string;
    latestEndTime: string;
    enforceConsecutiveBreakAsHard: boolean;
}
export interface PolicyInput {
    maxConsecutiveTeachingMinutesBeforeBreak?: unknown;
    minBreakMinutesAfterConsecutiveBlock?: unknown;
    maxTeachingMinutesPerDay?: unknown;
    earliestStartTime?: unknown;
    latestEndTime?: unknown;
    enforceConsecutiveBreakAsHard?: unknown;
}
export declare function validatePolicyInput(input: PolicyInput): {
    data: SchedulingPolicyData;
    errors: string[];
};
export declare function getOrCreatePolicy(schoolId: number, schoolYearId: number): Promise<any>;
export declare function upsertPolicy(schoolId: number, schoolYearId: number, input: PolicyInput): Promise<any>;
