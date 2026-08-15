import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

// The TypeORM CLI boots without Nest, so it never sees ConfigModule. Load the
// same two files in the same order the app does — .env.local stays out of git
// and wins over .env — otherwise `migration:run` would happily connect to the
// placeholder localhost database and report success against nothing.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const url = process.env.DATABASE_URL;
const connection = url
  ? { url, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'invest_platform',
    };

// Globbed rather than listed by hand: this data source exists to compare the
// entities against the database, so missing one would make `migration:generate`
// quietly propose dropping a table.
const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...connection,
  entities: [join(__dirname, '..', '**', `*.entity.${ext}`)],
  migrations: [join(__dirname, 'migrations', `*.${ext}`)],
  // "each" instead of the default "all" so a single migration can opt out of
  // running inside a transaction. Postgres refuses to let a transaction both add
  // a value to an enum and then use it, which is exactly what the referral
  // migration has to do.
  migrationsTransactionMode: 'each',
  synchronize: false,
  logging: ['error', 'schema'],
});
