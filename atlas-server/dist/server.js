import app from './app.js';
const PORT = Number(process.env.PORT) || 5001;
app.listen(PORT, () => {
    console.log(`[ATLAS] Server listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map