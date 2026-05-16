// Check if sections have homeRoomId populated
import { spawn } from 'child_process';

const cmd = `
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN "homeRoomId" IS NOT NULL THEN 1 END) as with_homeroom,
       COUNT(CASE WHEN "homeRoomId" IS NULL THEN 1 END) as without_homeroom
FROM section_mirrors 
WHERE "schoolId" = 1 AND "schoolYearId" = 55 AND "isStale" = false;
`;

const psql = spawn('psql', [
  '-h', 'localhost',
  '-U', 'postgres',
  '-d', 'atlas_dev',
  '-c', cmd
]);

let output = '';
psql.stdout.on('data', (data) => {
  output += data.toString();
});

psql.on('close', (code) => {
  console.log('=== HomeRoomId Population Check ===');
  console.log(output);
});

