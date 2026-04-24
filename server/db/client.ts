/**
 * PostgreSQL client using Kysely for type-safe queries.
 * Initialize with initializeDatabase() before use.
 */

import pg from 'pg';
import { Kysely, PostgresDialect, sql, Generated } from 'kysely';
import { getDatabaseConfig, isPostgresMode } from '../config/database.js';

const { Pool } = pg;

/**
 * Database table types
 * Use Generated<T> for columns with database defaults (id, created_at)
 */
export interface UsersTable {
  id: Generated<string>;
  organization_id: string;
  email: string;
  name: string | null;
  role: Generated<string>;
  password_hash: string | null;
  password_changed_at: string | null;
  auth_source: string | null;
  created_at: Generated<string>;
  updated_at: string;
}

export interface PasswordResetTokensTable {
  id: Generated<string>;
  user_email: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Generated<string>;
}

export interface MagicLinkTokensTable {
  id: Generated<string>;
  user_email: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Generated<string>;
}

export interface AuthAuditLogTable {
  id: Generated<string>;
  user_email: string | null;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: Generated<string>;
}

export interface DocumentSettings {
  themeId: string;
  generateToc: boolean;
  pageNumbers: boolean;
  coverPage: boolean;
  coverPageOptions?: {
    subtitle?: string;
    version?: string;
    date?: string;
  };
  pageBreakHeadings?: boolean;
}

export interface DocumentsTable {
  id: Generated<string>;
  organization_id: string;
  user_id: string | null;
  owner_email: string;
  title: string;
  content: string;
  settings: DocumentSettings;
  ai_changes: Record<string, unknown> | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  trashed_at: string | null;
  trashed_by: string | null;
}

export interface DocumentVersionsTable {
  id: Generated<string>;
  document_id: string;
  organization_id: string;
  created_by: string | null;
  reason: string;
  label: string | null;
  revision: number | null;
  title: string | null;
  content: string;
  settings: DocumentSettings | null;
  created_at: Generated<string>;
}

export interface DocumentCollaboratorsTable {
  id: Generated<string>;
  document_id: string;
  organization_id: string;
  user_email: string;
  permission: string;
  invited_by: string | null;
  invited_at: Generated<string>;
  revoked_at: string | null;
}

export interface DocumentLocksTable {
  document_id: string;
  holder_email: string;
  holder_name: string | null;
  acquired_at: Generated<string>;
  expires_at: string;
}

export interface DocumentLockRequestsTable {
  id: Generated<string>;
  document_id: string;
  requester_email: string;
  message: string | null;
  status: Generated<string>;
  responded_at: string | null;
  responded_by: string | null;
  created_at: Generated<string>;
}

export interface DocumentCommentsTable {
  id: Generated<string>;
  document_id: string;
  parent_id: string | null;
  organization_id: string;
  author_email: string;
  author_name: string | null;
  body: string;
  anchor_text: string | null;
  anchor_start: number | null;
  anchor_end: number | null;
  status: Generated<string>;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface Database {
  users: UsersTable;
  password_reset_tokens: PasswordResetTokensTable;
  magic_link_tokens: MagicLinkTokensTable;
  auth_audit_log: AuthAuditLogTable;
  documents: DocumentsTable;
  document_versions: DocumentVersionsTable;
  document_collaborators: DocumentCollaboratorsTable;
  document_locks: DocumentLocksTable;
  document_lock_requests: DocumentLockRequestsTable;
  document_comments: DocumentCommentsTable;
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
