import fs from 'node:fs';
import type { Plugin } from 'vite';

// DEV-ONLY (`vite serve`), STAGING-ONLY planner sign-in (Lane C, 2026-09-29).
// Planners must render real staging data, but reading the QA password into a browser tool echoed it into their
// transcripts. Opening `/__dev/staging-login` on a preview instead signs in server-side with the STAGING-ONLY QA
// login and stores the token in the preview's sessionStorage, so the password never passes through any tool.
// It refuses unless the preview's API is the loopback staging API (:5101) — never live (:5001).
const QA_ENV = 'D:/ATLAS-runtime-config/atlas-staging-qa.env';

export function devStagingLogin(apiBase: string | undefined): Plugin {
	return {
		name: 'atlas-dev-staging-login',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__dev/staging-login', async (_req, res) => {
				const send = (status: number, body: string) => {
					res.statusCode = status;
					res.setHeader('content-type', 'text/html; charset=utf-8');
					res.setHeader('cache-control', 'no-store');
					res.end(body);
				};
				let api: URL;
				try {
					api = new URL(apiBase ?? '');
				} catch {
					return send(403, 'Refused: VITE_ATLAS_API is not an absolute staging URL.');
				}
				if (!['127.0.0.1', 'localhost'].includes(api.hostname) || api.port !== '5101') {
					return send(403, 'Refused: staging login only works against the loopback staging API :5101.');
				}
				try {
					const env = fs.readFileSync(QA_ENV, 'utf8');
					const identifier = env.match(/^ATLAS_STAGING_QA_IDENTIFIER=(.*)$/m)?.[1]?.trim();
					const password = env.match(/^ATLAS_STAGING_QA_PASSWORD=(.*)$/m)?.[1]?.trim();
					if (!identifier || !password) return send(500, 'Staging QA login not set up: run scripts/dev/ensure-staging-qa-account.cjs');
					const r = await fetch(`${api.origin}/api/v1/auth/login`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ identifier, password }),
					});
					const j = (await r.json()) as { token?: string };
					if (!r.ok || !j.token) return send(502, `Staging login failed (${r.status}). Run scripts/dev/ensure-staging-qa-account.cjs once.`);
					return send(200, `<!doctype html><title>Signed in</title><p>Signed in to STAGING. Redirecting…</p><script>sessionStorage.setItem('atlas_local_token', ${JSON.stringify(j.token)});location.replace('/');</script>`);
				} catch (e) {
					return send(500, `Staging login error: ${(e as Error).message}`);
				}
			});
		},
	};
}
