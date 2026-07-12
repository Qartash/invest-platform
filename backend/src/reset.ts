import { promises as fs } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

// DESTRUCTIVE: wipes every row from every table and deletes all uploaded
// files, leaving an empty database and empty uploads folders. Intended for
// resetting a dev/test environment to a blank slate. Run: npm run reset
const UPLOAD_SUBDIRS = ['projects', 'attachments', 'avatars'];

async function truncateAllTables(dataSource: DataSource) {
  const rows: Array<{ tablename: string }> = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const tables = rows.map((row) => `"public"."${row.tablename}"`);
  if (tables.length === 0) return;
  // One statement so foreign keys never block the wipe; identities reset too.
  await dataSource.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`Truncated ${tables.length} tables: ${rows.map((r) => r.tablename).join(', ')}`);
}

async function clearUploads() {
  const uploadsRoot = join(__dirname, '..', 'uploads');
  for (const subdir of UPLOAD_SUBDIRS) {
    const dir = join(uploadsRoot, subdir);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue; // folder doesn't exist yet — nothing to clear
    }
    let removed = 0;
    for (const entry of entries) {
      if (entry === '.gitkeep') continue;
      await fs.rm(join(dir, entry), { recursive: true, force: true });
      removed += 1;
    }
    console.log(`Cleared ${removed} file(s) from uploads/${subdir}`);
  }
}

async function reset() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  await truncateAllTables(dataSource);
  await clearUploads();

  console.log('\nDatabase and uploads reset to a blank slate. No users, no projects, no files.');
  await app.close();
}

reset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
