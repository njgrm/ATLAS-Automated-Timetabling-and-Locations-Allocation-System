import type { Request, Response, NextFunction } from 'express';
interface ServiceError extends Error {
    statusCode?: number;
    code?: string;
}
export declare function errorHandler(err: ServiceError, _req: Request, res: Response, _next: NextFunction): void;
export {};
