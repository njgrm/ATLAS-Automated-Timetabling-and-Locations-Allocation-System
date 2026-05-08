import type { Request, Response, NextFunction } from 'express';
export declare function hasPrivilegedRole(role: string | undefined): boolean;
export declare function requirePrivilegedRole(req: Request, res: Response, next: NextFunction): void;
