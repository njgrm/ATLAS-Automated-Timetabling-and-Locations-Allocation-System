export function errorHandler(err, _req, res, _next) {
    const statusCode = err.statusCode ?? 500;
    const code = err.code ?? 'SERVER_ERROR';
    if (statusCode >= 500) {
        console.error('[ATLAS] Unhandled error:', err.message);
    }
    res.status(statusCode).json({ code, message: err.message || 'An internal server error occurred.' });
}
//# sourceMappingURL=errorHandler.js.map