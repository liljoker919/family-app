import { describe, expect, it } from 'vitest';
import { isRegistrationExpired, isRegistrationExpiringSoon } from '../registrationExpiry';

describe('registrationExpiry utils', () => {
  const today = new Date(2026, 4, 10); // 2026-05-10

  it('detects expired registrations', () => {
    expect(isRegistrationExpired('2026-05-09', today)).toBe(true);
    expect(isRegistrationExpired('2026-05-10', today)).toBe(false);
  });

  it('detects soon-to-expire registrations within 30 days', () => {
    expect(isRegistrationExpiringSoon('2026-05-11', today)).toBe(true);
    expect(isRegistrationExpiringSoon('2026-06-09', today)).toBe(true);
    expect(isRegistrationExpiringSoon('2026-06-10', today)).toBe(false);
  });
});
