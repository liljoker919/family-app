import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastMessage } from '../errorReporter';

describe('createToastMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a toast payload with id, message, and type', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-a');

    const toast = createToastMessage('Failed to save.', 'error');

    expect(toast.message).toBe('Failed to save.');
    expect(toast.type).toBe('error');
    expect(toast.id).toBe('uuid-a');
  });

  it('generates a unique id for repeated messages', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2');

    const first = createToastMessage('Failed to save.', 'error');
    const second = createToastMessage('Failed to save.', 'error');

    expect(first.id).not.toBe(second.id);
    expect(first.message).toBe(second.message);
    expect(first.type).toBe(second.type);
  });

  it('falls back to timestamp + random id when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const toast = createToastMessage('Fallback path', 'success');

    expect(toast.id).toBe('1700000000000-4fzzzxjylrx');
    expect(toast.type).toBe('success');
    expect(toast.message).toBe('Fallback path');
  });
});
