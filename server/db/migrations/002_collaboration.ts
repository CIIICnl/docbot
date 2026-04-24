/**
 * Migration: Create collaboration tables
 * - document_collaborators: Share documents with other users
 * - document_locks: Turn-based editing locks
 * - document_lock_requests: Request access to locked documents
 * - document_comments: Inline comments and discussions
 */

import { sql, getDb } from '../client.js';

export const name = 'Create collaboration tables';

export async function up(): Promise<void> {
  const db = getDb();

  // Create document_collaborators table
  await sql`
    CREATE TABLE document_collaborators (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      user_email VARCHAR(320) NOT NULL,
      permission VARCHAR(20) NOT NULL DEFAULT 'view',
      invited_by VARCHAR(320),
      invited_at TIMESTAMPTZ DEFAULT now(),
      revoked_at TIMESTAMPTZ,
      UNIQUE (document_id, user_email)
    )
  `.execute(db);

  // Create indexes for document_collaborators
  await sql`CREATE INDEX idx_collaborators_document ON document_collaborators(document_id)`.execute(db);
  await sql`CREATE INDEX idx_collaborators_email ON document_collaborators(user_email)`.execute(db);
  await sql`CREATE INDEX idx_collaborators_active ON document_collaborators(document_id) WHERE revoked_at IS NULL`.execute(db);

  // Create document_locks table
  await sql`
    CREATE TABLE document_locks (
      document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
      holder_email VARCHAR(320) NOT NULL,
      holder_name VARCHAR(255),
      acquired_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `.execute(db);

  // Create document_lock_requests table
  await sql`
    CREATE TABLE document_lock_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
      requester_email VARCHAR(320) NOT NULL,
      message TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      responded_at TIMESTAMPTZ,
      responded_by VARCHAR(320),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `.execute(db);

  // Create indexes for document_lock_requests
  await sql`CREATE INDEX idx_lock_requests_document ON document_lock_requests(document_id)`.execute(db);
  await sql`CREATE INDEX idx_lock_requests_pending ON document_lock_requests(document_id) WHERE status = 'pending'`.execute(db);

  // Create document_comments table
  await sql`
    CREATE TABLE document_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      author_email VARCHAR(320) NOT NULL,
      author_name VARCHAR(255),
      body TEXT NOT NULL,
      anchor_text TEXT,
      anchor_start INTEGER,
      anchor_end INTEGER,
      status VARCHAR(20) DEFAULT 'open',
      resolved_by VARCHAR(320),
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `.execute(db);

  // Create indexes for document_comments
  await sql`CREATE INDEX idx_comments_document ON document_comments(document_id)`.execute(db);
  await sql`CREATE INDEX idx_comments_parent ON document_comments(parent_id)`.execute(db);
  await sql`CREATE INDEX idx_comments_open ON document_comments(document_id) WHERE status = 'open'`.execute(db);

  // Create function for auto-updating updated_at on comments
  await sql`
    CREATE OR REPLACE FUNCTION update_comments_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  // Create trigger for auto-updating updated_at on comments
  await sql`
    CREATE TRIGGER comments_updated_at_trigger
    BEFORE UPDATE ON document_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comments_updated_at()
  `.execute(db);
}

export async function down(): Promise<void> {
  const db = getDb();

  await sql`DROP TRIGGER IF EXISTS comments_updated_at_trigger ON document_comments`.execute(db);
  await sql`DROP FUNCTION IF EXISTS update_comments_updated_at()`.execute(db);
  await sql`DROP TABLE IF EXISTS document_comments`.execute(db);
  await sql`DROP TABLE IF EXISTS document_lock_requests`.execute(db);
  await sql`DROP TABLE IF EXISTS document_locks`.execute(db);
  await sql`DROP TABLE IF EXISTS document_collaborators`.execute(db);
}
