import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastMessage } from '../errorReporter';

describe('createToastMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a toast payload with id, message, and type', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const toast = createToastMessage('Failed to save.', 'error');

    expect(toast).toEqual({
      id: '1700000000000-1',
      message: 'Failed to save.',
      type: 'error',
    });
  });

  it('generates a unique id for repeated messages', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const first = createToastMessage('Failed to save.', 'error');
    const second = createToastMessage('Failed to save.', 'error');

    expect(first.id).not.toBe(second.id);
    expect(first.message).toBe(second.message);
    expect(first.type).toBe(second.type);
  });
});
