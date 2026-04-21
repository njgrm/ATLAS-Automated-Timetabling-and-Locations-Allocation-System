/**
 * ATLAS Local Smoke Test
 *
 * Hits all critical endpoints and reports status.
 * Usage:  cd atlas-server && npx tsx src/scripts/smoke-test.ts
 *
 * Requires:
 *   - Server running on http://localhost:5001
 *   - Valid JWT_SECRET in .env (generates a test token locally)
 */
import 'dotenv/config';
