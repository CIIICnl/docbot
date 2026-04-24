/**
 * Migration 000: Users table
 *
 * Creates the users table for local development.
 * In production, this table is shared with presentation-system (dreamslides).
 * This migration will skip if the table already exists.
 */

import { sql, getDb } from '../client.js';

export const name = 'Create users table (for local development)';

export async function up(): Promise<void> {
  const db = getDb();

  // Check if users table already exists (shared database scenario)
  const result = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'users'
    )
  `.execute(db);

  if (result.rows[0]?.exists) {
    console.log('  Users table already exists, skipping creation');
    return;
  }

  // Create users table
  await sql`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      email VARCHAR(320) NOT NULL UNIQUE,
      name VARCHAR(255),
      password_hash VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      last_login_at TIMESTAMPTZ
    )
  `.execute(db);

  // Create index on organization_id for faster queries
  await sql`CREATE INDEX idx_users_organization_id ON users(organization_id)`.execute(db);
}

export async function down(): Promise<void> {
  const db = getDb();

  // Only drop if no other tables depend on it
  // In production with shared database, this should not run
  await sql`DROP INDEX IF EXISTS idx_users_organization_id`.execute(db);
  await sql`DROP TABLE IF EXISTS users`.execute(db);
}
