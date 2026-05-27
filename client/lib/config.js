/**
 * Runtime client configuration.
 * Fetches /api/config once and caches it for the session.
 */

import { get } from './api.js';

let cache = null;

async function getConfig() {
  if (cache) return cache;
  const res = await get('/api/config');
  cache = res.ok && res.data ? res.data : {};
  return cache;
}

/**
 * Base URL of the Beeldbank media picker, or '' when not configured.
 */
export async function getBeeldbankPickerUrl() {
  const cfg = await getConfig();
  return cfg.beeldbankPickerUrl || '';
}
