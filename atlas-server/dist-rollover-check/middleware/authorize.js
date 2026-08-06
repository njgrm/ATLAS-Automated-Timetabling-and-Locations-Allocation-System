const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
export function hasPrivilegedRole(role) {
    if (!role)
        return false;
    return PRIVILEGED_ROLES.has(role);
}
export function requirePrivilegedRole(req, res, next) {
    if (hasPrivilegedRole(req.user?.role)) {
        next();
        return;
    }
    res.status(403).json({
        code: 'FORBIDDEN',
        message: 'This endpoint is restricted to scheduler officers and administrators.',
    });
}
