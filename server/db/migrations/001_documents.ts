/**
 * Migration: Create documents and document_versions tables
 */

import { sql, getDb } from '../client.js';

export const name = 'Create documents and document_versions tables';

export async function up(): Promise<void> {
  const db = getDb();

  // Create documents table
  await sql`
    CREATE TABLE documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      owner_email VARCHAR(320) NOT NULL,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      settings JSONB DEFAULT '{"themeId":"default","generateToc":true,"pageNumbers":true,"coverPage":true}'::jsonb,
      ai_changes JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      trashed_at TIMESTAMPTZ,
      trashed_by VARCHAR(320)
    )
  `.execute(db);

  // Create indexes for documents
  await sql`CREATE INDEX idx_documents_organization ON documents(organization_id)`.execute(db);
  await sql`CREATE INDEX idx_documents_owner_email ON documents(owner_email)`.execute(db);
  await sql`CREATE INDEX idx_documents_user_id ON documents(user_id)`.execute(db);
  await sql`CREATE INDEX idx_documents_trashed_at ON documents(trashed_at)`.execute(db);
  await sql`CREATE INDEX idx_documents_updated_at ON documents(updated_at DESC)`.execute(db);

  // Create document_versions table
  await sql`
    CREATE TABLE document_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      created_by VARCHAR(320),
      reason VARCHAR(50) DEFAULT 'autosave',
      label VARCHAR(255),
      revision INTEGER,
      title VARCHAR(500),
      content TEXT NOT NULL,
      settings JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `.execute(db);

  // Create indexes for document_versions
  await sql`CREATE INDEX idx_document_versions_document_id ON document_versions(document_id)`.execute(db);
  await sql`CREATE INDEX idx_document_versions_created_at ON document_versions(created_at DESC)`.execute(db);

  // Create function for auto-updating updated_at
  await sql`
    CREATE OR REPLACE FUNCTION update_documents_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  // Create trigger for auto-updating updated_at
  await sql`
    CREATE TRIGGER documents_updated_at_trigger
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_updated_at()
  `.execute(db);
}

export async function down(): Promise<void> {
  const db = getDb();

  await sql`DROP TRIGGER IF EXISTS documents_updated_at_trigger ON documents`.execute(db);
  await sql`DROP FUNCTION IF EXISTS update_documents_updated_at()`.execute(db);
  await sql`DROP TABLE IF EXISTS document_versions`.execute(db);
  await sql`DROP TABLE IF EXISTS documents`.execute(db);
}
