/**
 * Config API Route
 * Exposes non-sensitive runtime configuration to the client.
 */

import type { ApiContext } from './index.js';
import { ok } from '../../utils/http.js';

const DEFAULT_BEELDBANK_PICKER_URL = 'https://beeldbank.ciiic.nl/picker';

export async function handleConfig(ctx: ApiContext): Promise<boolean> {
  const { req, res, url } = ctx;

  if (url.pathname === '/api/config' && req.method === 'GET') {
    ok(res, {
      beeldbankPickerUrl:
        process.env.BEELDBANK_PICKER_URL || DEFAULT_BEELDBANK_PICKER_URL,
    });
    return true;
  }

  return false;
}
