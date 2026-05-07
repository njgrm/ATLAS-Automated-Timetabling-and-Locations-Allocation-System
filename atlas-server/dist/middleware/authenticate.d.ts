import type { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    userId: number;
    role: string;
    mustChangePassword?: boolean;
    authSource?: 'bridge' | 'local';
    schoolId?: number;
    accountId?: number;
    email?: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
