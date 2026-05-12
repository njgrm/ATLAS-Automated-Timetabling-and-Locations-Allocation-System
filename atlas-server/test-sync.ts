import 'dotenv/config';
import { syncSectionsFromExternal } from './src/services/section.service.js';

async function test() {
  const schoolId = 1;
  const schoolYearId = 29; // From your console logs
  console.log(`Starting sync for schoolId: ${schoolId}, schoolYearId: ${schoolYearId}...`);
  console.log(`ENROLLPRO_API: ${process.env.ENROLLPRO_API}`);
  
  try {
    const result = await syncSectionsFromExternal(schoolId, schoolYearId);
    console.log('Sync successful!', result);
  } catch (err) {
    console.error('Sync failed:', err.message);
    if (err.statusCode) console.error('Status code:', err.statusCode);
  }
}

test();
