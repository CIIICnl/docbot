/**
 * Environment Configuration
 * Loads .env file and provides typed access to config.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

/**
 * Load .env file into process.env
 */
export async function loadEnv(): Promise<void> {
  try {
    const envPath = join(ROOT, '.env');
    const content = await readFile(envPath, 'utf-8');

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Don't override existing env vars
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file is optional
  }
}

/**
 * Get typed configuration
 */
export function getConfig() {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV !== 'production',
    // Auth configuration
    authSecret: process.env.AUTH_SECRET,
    authUsersJson: process.env.AUTH_USERS_JSON,
    authUsersB64: process.env.AUTH_USERS_B64,
    authAdminEmail: process.env.AUTH_ADMIN_EMAIL || 'jaap@ciiic.nl',
    authDevBypass: process.env.AUTH_DEV_BYPASS === '1' || process.env.AUTH_DEV_BYPASS === 'true',
    secureCookies: process.env.SECURE_COOKIES === '1' || process.env.SECURE_COOKIES === 'true',
    cookieDomain: process.env.COOKIE_DOMAIN || '', // e.g. '.ciiic.nl' for cross-subdomain SSO
    demoMode: process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1',
  };
}

/**
 * Get the project root directory
 */
export function getRoot(): string {
  return ROOT;
}
