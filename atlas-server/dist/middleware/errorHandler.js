export function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode ?? 500;
    const code = err.code ?? 'SERVER_ERROR';
    if (statusCode >= 500) {
        const route = `${req.method} ${req.originalUrl}`;
        console.error(`[ATLAS] 500 on ${route}:`, err.code ?? '', err.message);
        if (err.stack) {
            console.error(err.stack);
        }
    }
    res.status(statusCode).json({
        code,
        message: err.message || 'An internal server error occurred.',
        ...(err.actionHint ? { actionHint: err.actionHint } : {}),
        ...(err.details ? { details: err.details } : {}),
    });
}
//# sourceMappingURL=errorHandler.js.map