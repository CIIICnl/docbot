import { describe, expect, it } from 'vitest';
import { isEmailVerified } from '../../server/auth/oidc';

describe('isEmailVerified', () => {
  it('telt alleen email_verified true als bevestigd', () => {
    expect(isEmailVerified({ email_verified: true })).toBe(true);
    expect(isEmailVerified({ email_verified: false })).toBe(false);
    expect(isEmailVerified({})).toBe(false);
    expect(isEmailVerified({ email_verified: 'true' })).toBe(false);
  });
});
