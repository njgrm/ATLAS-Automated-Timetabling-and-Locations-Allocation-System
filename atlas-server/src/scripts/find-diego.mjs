// Find Diego Aquino and create his auth account
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../../.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../node_modules/.prisma/client/default.js');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

try {
  // Find Diego Aquino by name
  const diego = await prisma.facultyMirror.findMany({
    where: { schoolId: 1, firstName: { contains: 'DIEGO' }, lastName: { contains: 'AQUINO' } },
    select: { id: true, firstName: true, lastName: true, externalId: true, isStale: true, specialization: true },
  });
  console.log('Diego Aquino records:', JSON.stringify(diego, null, 2));

  // Also check existing auth accounts
  const auth = await prisma.atlasAuthAccount.findMany({
    where: { schoolId: 1, role: 'faculty' },
    select: { id: true, employeeId: true, email: true, facultyId: true, role: true },
  });
  console.log('Existing faculty auth accounts:', JSON.stringify(auth, null, 2));
} finally {
  await prisma.$disconnect();
}
