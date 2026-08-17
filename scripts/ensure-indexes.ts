/**
 * Synchronizes MongoDB indexes with the schemas declared in lib/models.
 *
 * Run on deploy (`npm run db:indexes`), never from the request path: building
 * an index on a populated collection blocks, so it must happen deliberately
 * rather than whenever a cold request happens to arrive first. See
 * lib/models/index.ts for why `syncIndexes` also drops indexes that exist in
 * the database but are no longer declared in a schema.
 *
 * Configuration comes from real environment variables, or from .env.local when
 * present (the npm script passes --env-file-if-exists).
 */
import { ensureIndexes } from "../lib/models";
import { disconnectFromDatabase } from "../lib/mongodb";

async function main(): Promise<void> {
  const results = await ensureIndexes();

  let failures = 0;
  for (const result of results) {
    if (result.ok) {
      console.log(`  ok    ${result.model}`);
    } else {
      failures += 1;
      console.error(`  FAIL  ${result.model}: ${result.error}`);
    }
  }

  await disconnectFromDatabase();

  if (failures > 0) {
    console.error(`\n${failures} of ${results.length} models failed to sync.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${results.length} models' indexes are in sync.`);
}

main().catch((err) => {
  console.error("Index sync failed:", err);
  process.exitCode = 1;
});
