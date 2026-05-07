import jwt from 'jsonwebtoken';
export function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ code: 'NO_TOKEN', message: 'Authorization header missing or malformed.' });
        return;
    }
    const token = header.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ code: 'SERVER_ERROR', message: 'JWT secret not configured.' });
        return;
    }
    try {
        const decoded = jwt.verify(token, secret);
        req.user = {
            ...decoded,
            authSource: decoded.authSource === 'local' ? 'local' : 'bridge',
        };
        next();
    }
    catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Access token has expired.' });
            return;
        }
        res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid access token.' });
    }
}
//# sourceMappingURL=authenticate.js.map