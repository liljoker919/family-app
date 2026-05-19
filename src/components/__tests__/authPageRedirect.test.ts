import { describe, expect, it, vi } from 'vitest';
import { redirectToDashboardIfAuthenticated } from '../AuthPage';

describe('redirectToDashboardIfAuthenticated', () => {
  it('redirects authenticated users to dashboard', () => {
    const assign = vi.fn();

    redirectToDashboardIfAuthenticated({ username: 'user@example.com' }, { assign });

    expect(assign).toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect when there is no authenticated user', () => {
    const assign = vi.fn();

    redirectToDashboardIfAuthenticated(null, { assign });

    expect(assign).not.toHaveBeenCalled();
  });
});
