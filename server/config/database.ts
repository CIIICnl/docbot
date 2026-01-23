/**
 * Database configuration for PostgreSQL.
 * Used when STORAGE_MODE=postgres
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: false | { rejectUnauthorized: boolean };
  pool: {
    min: number;
    max: number;
  };
}

export function getStorageMode(): 'postgres' | 'file' {
  const mode = (process.env.STORAGE_MODE || '').toLowerCase().trim();
  if (mode === 'postgres' || mode === 'postgresql') {
    return 'postgres';
  }
  return 'file'; // default for OSS self-hosted
}

export function isPostgresMode(): boolean {
  return getStorageMode() === 'postgres';
}

export function getDatabaseConfig(): DatabaseConfig {
  // SSL is enabled by default for non-localhost connections
  const host = process.env.DATABASE_HOST || 'localhost';
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const sslExplicitlyDisabled = process.env.DATABASE_SSL === 'false';
  const sslEnabled = !isLocalhost && !sslExplicitlyDisabled;
  // Allow self-signed certificates (e.g., managed database services)
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

  return {
    host,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'dreamslides',
    user: process.env.DATABASE_USER || 'dreamslides',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: sslEnabled ? { rejectUnauthorized } : false,
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
      max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
    },
  };
}

/**
 * Default organization ID for single-tenant OSS deployments.
 * In multi-tenant SaaS mode, this is used only as a fallback.
 */
export function getDefaultOrganizationId(): string {
  return process.env.DEFAULT_ORGANIZATION_ID || '00000000-0000-0000-0000-000000000001';
}
