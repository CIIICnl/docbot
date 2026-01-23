/**
 * PostgreSQL client using Kysely for type-safe queries.
 * Initialize with initializeDatabase() before use.
 */

import pg from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { getDatabaseConfig, isPostgresMode } from '../config/database.js';

const { Pool } = pg;

/**
 * Database table types
 */
export interface UsersTable {
  id: string;
  organization_id: string;
  email: string;
  name: string | null;
  role: string;
  password_hash: string | null;
  password_changed_at: string | null;
  auth_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface PasswordResetTokensTable {
  id: string;
  user_email: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface MagicLinkTokensTable {
  id: string;
  user_email: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuthAuditLogTable {
  id: string;
  user_email: string | null;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Database {
  users: UsersTable;
  password_reset_tokens: PasswordResetTokensTable;
  magic_link_tokens: MagicLinkTokensTable;
  auth_audit_log: AuthAuditLogTable;
}

let db: Kysely<Database> | null = null;
let pool: pg.Pool | null = null;

/**
 * Initialize the database connection pool.
 * Only initializes if STORAGE_MODE=postgres.
 */
export async function initializeDatabase(): Promise<Kysely<Database> | null> {
  if (!isPostgresMode()) {
    console.log('[DB] Storage mode is file-based, skipping PostgreSQL initialization');
    return null;
  }

  if (db) {
    return db;
  }

  const config = getDatabaseConfig();
  console.log(`[DB] Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}`);

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    min: config.pool.min,
    max: config.pool.max,
  });

  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[DB] PostgreSQL connection successful');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DB] PostgreSQL connection failed:', message);
    throw err;
  }

  db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool,
    }),
  });

  return db;
}

/**
 * Get the Kysely database instance.
 * @throws {Error} If database not initialized
 */
export function getDb(): Kysely<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first or check STORAGE_MODE.');
  }
  return db;
}

/**
 * Get the raw pg Pool for direct queries if needed.
 * @throws {Error} If database not initialized
 */
export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first or check STORAGE_MODE.');
  }
  return pool;
}

/**
 * Check if database is initialized and available.
 */
export function isDatabaseAvailable(): boolean {
  return db !== null;
}

/**
 * Close the database connection pool.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
    pool = null; // Pool is closed by db.destroy()
    console.log('[DB] Database connections closed');
  }
}

// Re-export sql for tagged template literals
export { sql };
