import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastMessage } from '../errorReporter';

describe('createToastMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a toast payload with id, message, and type', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-a');

    const toast = createToastMessage('Failed to save.', 'error');

    expect(toast.message).toBe('Failed to save.');
    expect(toast.type).toBe('error');
    expect(toast.id).toBe('1700000000000-uuid-a');
  });

  it('generates a unique id for repeated messages', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2');

    const first = createToastMessage('Failed to save.', 'error');
    const second = createToastMessage('Failed to save.', 'error');

    expect(first.id).not.toBe(second.id);
    expect(first.message).toBe(second.message);
    expect(first.type).toBe(second.type);
  });
});
