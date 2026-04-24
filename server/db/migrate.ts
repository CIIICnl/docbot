/**
 * Database Migration Runner
 * Runs pending migrations in order.
 */

import { loadEnv } from '../config/env.js';
import { getDb, initializeDatabase, closeDatabase, sql } from './client.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables first
await loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Migration {
  id: string;
  name: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTable(): Promise<void> {
  const db = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `.execute(db);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const db = getDb();
  const result = await db
    .selectFrom('_migrations' as any)
    .select(['id'])
    .execute();
  return new Set(result.map((r: any) => r.id));
}

/**
 * Record a migration as applied
 */
async function recordMigration(id: string, name: string): Promise<void> {
  const db = getDb();
  await db
    .insertInto('_migrations' as any)
    .values({ id, name })
    .execute();
}

/**
 * Remove a migration record (for rollback)
 */
async function removeMigrationRecord(id: string): Promise<void> {
  const db = getDb();
  await db
    .deleteFrom('_migrations' as any)
    .where('id', '=', id)
    .execute();
}

/**
 * Load all migrations from the migrations directory
 */
async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = path.join(__dirname, 'migrations');

  try {
    await fs.access(migrationsDir);
  } catch {
    console.log('[migrate] No migrations directory found');
    return [];
  }

  const files = await fs.readdir(migrationsDir);
  const migrationFiles = files
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();

  const migrations: Migration[] = [];

  for (const file of migrationFiles) {
    const id = file.replace(/\.(ts|js)$/, '');
    const modulePath = path.join(migrationsDir, file);
    const module = await import(modulePath);

    migrations.push({
      id,
      name: module.name || id,
      up: module.up,
      down: module.down,
    });
  }

  return migrations;
}

/**
 * Run all pending migrations
 */
export async function migrate(): Promise<void> {
  console.log('[migrate] Starting migrations...');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrations = await loadMigrations();

  let count = 0;
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    console.log(`[migrate] Running: ${migration.id} - ${migration.name}`);

    try {
      await migration.up();
      await recordMigration(migration.id, migration.name);
      count++;
      console.log(`[migrate] Completed: ${migration.id}`);
    } catch (err) {
      console.error(`[migrate] Failed: ${migration.id}`, err);
      throw err;
    }
  }

  if (count === 0) {
    console.log('[migrate] No pending migrations');
  } else {
    console.log(`[migrate] Applied ${count} migration(s)`);
  }
}

/**
 * Rollback the last migration
 */
export async function rollback(): Promise<void> {
  console.log('[migrate] Rolling back last migration...');

  await ensureMigrationsTable();
  const migrations = await loadMigrations();
  const applied = await getAppliedMigrations();

  // Find the last applied migration
  const appliedMigrations = migrations.filter(m => applied.has(m.id));
  const lastMigration = appliedMigrations[appliedMigrations.length - 1];

  if (!lastMigration) {
    console.log('[migrate] No migrations to rollback');
    return;
  }

  if (!lastMigration.down) {
    throw new Error(`Migration ${lastMigration.id} does not have a down function`);
  }

  console.log(`[migrate] Rolling back: ${lastMigration.id} - ${lastMigration.name}`);

  try {
    await lastMigration.down();
    await removeMigrationRecord(lastMigration.id);
    console.log(`[migrate] Rolled back: ${lastMigration.id}`);
  } catch (err) {
    console.error(`[migrate] Rollback failed: ${lastMigration.id}`, err);
    throw err;
  }
}

/**
 * Show migration status
 */
export async function status(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrations = await loadMigrations();

  console.log('\nMigration Status:');
  console.log('─'.repeat(60));

  if (migrations.length === 0) {
    console.log('No migrations found');
    return;
  }

  for (const migration of migrations) {
    const isApplied = applied.has(migration.id);
    const status = isApplied ? '✓' : '○';
    console.log(`${status} ${migration.id} - ${migration.name}`);
  }

  console.log('─'.repeat(60));
  const pendingCount = migrations.filter(m => !applied.has(m.id)).length;
  console.log(`Total: ${migrations.length}, Applied: ${applied.size}, Pending: ${pendingCount}`);
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const command = process.argv[2] || 'up';

  try {
    await initializeDatabase();

    switch (command) {
      case 'up':
        await migrate();
        break;
      case 'down':
        await rollback();
        break;
      case 'status':
        await status();
        break;
      default:
        console.log('Usage: migrate.ts [up|down|status]');
        process.exit(1);
    }
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run if called directly
main();
