import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const teachers = await prisma.facultyMirror.findMany();
  console.log('Total mirrored teachers:', teachers.length);
  const withSpecialization = teachers.filter(t => t.specialization !== null);
  console.log('With specialization (not null):', withSpecialization.length);
  const withValue = teachers.filter(t => t.specialization && t.specialization.trim() !== '');
  console.log('With value:', withValue.length);
}
main().finally(() => prisma.$disconnect());
