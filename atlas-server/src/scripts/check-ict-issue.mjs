// Check why ICT sessions exist and why faculty IDs 1,2 are being used
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
  // Check faculty with IDs 1 and 2
  const faculty12 = await prisma.facultyMirror.findMany({
    where: { id: { in: [1, 2] } },
    select: { id: true, firstName: true, lastName: true, externalId: true, isStale: true, isActiveForScheduling: true, specialization: true, department: true },
  });
  console.log('Faculty IDs 1 and 2:', JSON.stringify(faculty12, null, 2));

  // Check subject with ID=10 (ICT)
  const ict = await prisma.subject.findFirst({ where: { id: 10, schoolId: 1 }, select: { id: true, code: true, name: true, isSeedable: true, isActive: true, gradeLevels: true } });
  console.log('\nSubject 10:', JSON.stringify(ict, null, 2));

  // Check assignments for faculty 1 and 2
  const assignments12 = await prisma.facultySubject.findMany({
    where: { facultyId: { in: [1, 2] } },
    include: { subject: { select: { code: true, isSeedable: true } } },
  });
  console.log('\nAssignments for faculty 1,2:', JSON.stringify(assignments12, null, 2));

  // Check ICT assignments (subjectId=10)
  const ictAssignments = await prisma.facultySubject.count({ where: { subjectId: 10 } });
  console.log('\nICT assignments count:', ictAssignments);

  // Check section snapshot to see if ICT is in sections
  const snapshot = await prisma.sectionSnapshot.findFirst({
    where: { schoolId: 1 },
    select: { sections: true },
  });
  if (snapshot?.sections) {
    const sections = Array.isArray(snapshot.sections) ? snapshot.sections : [];
    const ictSections = sections.filter(s => 
      (s.subjectIds && s.subjectIds.includes(10)) ||
      (s.subjectCodes && s.subjectCodes.some(c => c === 'ICT'))
    );
    console.log(`\nSections with ICT: ${ictSections.length} out of ${sections.length} total`);
    if (ictSections.length > 0) {
      console.log('Sample ICT section:', JSON.stringify(ictSections[0], null, 2));
    }
  }
} finally {
  await prisma.$disconnect();
}
