#!/usr/bin/env node
// Creates or refreshes the STAGING-ONLY QA login so planners can render real staging data (2026-09-29, operator).
// - Refuses any database other than `atlas_staging` on a loopback host: it can never touch live.
// - The password lives only in D:\ATLAS-runtime-config\atlas-staging-qa.env (outside the repo); it is generated
//   on first run and never printed. This script prints the identifier only.
// - Staging is re-streamed from live on every A4 deploy, which drops the account: A4 re-runs this after each
//   staging deploy. Usage: node scripts/dev/ensure-staging-qa-account.cjs
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const CONFIG_DIR = 'D:/ATLAS-runtime-config';
const STAGING_ENV = path.join(CONFIG_DIR, 'atlas-staging.env');
const QA_ENV = path.join(CONFIG_DIR, 'atlas-staging-qa.env');
const SERVER_MODULES = 'D:/ATLAS/atlas-server/node_modules';
const EMAIL = 'qa-planner@atlas-staging.test';
const ACCOUNT_NAME = 'qa-planner-staging';

function readEnv(file) {
	const out = {};
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
	}
	return out;
}

(async () => {
	const url = readEnv(STAGING_ENV).DATABASE_URL;
	const parsed = new URL(url);
	if (parsed.pathname !== '/atlas_staging' || !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
		console.error('REFUSED: not the loopback atlas_staging database');
		process.exit(2);
	}

	let password = fs.existsSync(QA_ENV) ? readEnv(QA_ENV).ATLAS_STAGING_QA_PASSWORD : '';
	if (!password) {
		password = crypto.randomBytes(18).toString('base64url');
		fs.writeFileSync(QA_ENV, [
			'# STAGING-ONLY QA login (never exists on live). Created by scripts/dev/ensure-staging-qa-account.cjs.',
			`ATLAS_STAGING_QA_IDENTIFIER=${EMAIL}`,
			`ATLAS_STAGING_QA_PASSWORD=${password}`,
			'',
		].join('\n'));
	}

	const bcrypt = require(path.join(SERVER_MODULES, 'bcryptjs'));
	const { PrismaClient } = require(path.join(SERVER_MODULES, '@prisma/client'));
	const prisma = new PrismaClient({ datasources: { db: { url } } });
	try {
		const school = await prisma.school.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
		const passwordHash = await bcrypt.hash(password, 12);
		const data = { schoolId: school.id, role: 'officer', passwordHash, isActive: true, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null, accountName: ACCOUNT_NAME };
		const existing = await prisma.atlasAuthAccount.findUnique({ where: { email: EMAIL }, select: { id: true } });
		if (existing) await prisma.atlasAuthAccount.update({ where: { id: existing.id }, data });
		else await prisma.atlasAuthAccount.create({ data: { ...data, email: EMAIL } });
		console.log(`STAGING QA ACCOUNT READY: ${EMAIL} (school ${school.id}, officer). Password: ${QA_ENV}`);
	} finally {
		await prisma.$disconnect();
	}
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
