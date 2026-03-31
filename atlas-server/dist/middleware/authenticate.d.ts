import type { Request, Response, NextFunction } from 'express';
export interface BridgePayload {
    userId: number;
    role: string;
    mustChangePassword?: boolean;
}
declare global {
    namespace Express {
        interface Request {
            user?: BridgePayload;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
