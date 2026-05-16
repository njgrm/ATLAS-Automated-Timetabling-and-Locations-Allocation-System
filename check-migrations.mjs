import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  try {
    // List applied migrations using psql
    const { stdout } = await execAsync(
      `psql postgresql://atlas_user:incorrect404@localhost:5432/atlas_db -c "SELECT migration FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"`,
      { shell: true }
    );
    console.log('=== Last 10 Applied Migrations ===');
    console.log(stdout);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
