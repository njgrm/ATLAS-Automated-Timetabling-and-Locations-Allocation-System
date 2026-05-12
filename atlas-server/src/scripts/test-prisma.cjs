const path = require('path');
const { readFileSync } = require('fs');

// Load .env
const envPath = path.join(__dirname, '../../.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

const mod = require('./../../node_modules/.prisma/client/default.js');
console.log('Module keys:', Object.keys(mod));

const { PrismaClient } = mod;
console.log('PrismaClient:', PrismaClient);

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
console.log('prisma instance:', prisma?.constructor?.name);

(async () => {
  try {
    const count = await prisma.facultyMirror.count();
    console.log('Faculty count:', count);
  } finally {
    await prisma.$disconnect();
  }
})();
