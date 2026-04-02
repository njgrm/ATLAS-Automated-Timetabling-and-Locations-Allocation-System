import app from './app.js';
import { prisma } from './lib/prisma.js';

const PORT = Number(process.env.PORT) || 5001;

app.listen(PORT, async () => {
	console.log(`[ATLAS] Server listening on http://localhost:${PORT}`);
	// Startup connectivity check
	try {
		const count = await prisma.school.count();
		console.log(`[prisma] ✔ DB connected, ${count} school(s) found`);
	} catch (e: unknown) {
		const err = e as { code?: string; message?: string };
		console.error(`[prisma] ❌ Startup DB check failed: ${err.code} — ${err.message?.substring(0, 200)}`);
	}
});
