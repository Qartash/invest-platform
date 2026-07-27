// Runs once, before any worker starts, so a run that was going to reach the
// wrong database is refused before a single connection is opened rather than
// once per test file. Creating the database here too means `npm run test:e2e`
// works from nothing but `docker compose up -d postgres`.
import {
  assertLocalTarget,
  ensureDatabase,
  loadTestEnv,
} from './local-database';

export default async (): Promise<void> => {
  loadTestEnv();
  await ensureDatabase(assertLocalTarget());
};
