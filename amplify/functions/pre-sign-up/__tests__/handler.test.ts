import { describe, expect, it } from 'vitest';

const { handler } = await import('../handler.js');

describe('pre-sign-up handler', () => {
  it('accepts sign-up requests when both given and family names are present', async () => {
    const event = {
      request: {
        userAttributes: {
          given_name: 'Jane',
          family_name: 'Doe',
        },
      },
    } as any;

    await expect(handler(event, {} as any, () => {})).resolves.toBe(event);
  });

  it('rejects sign-up requests missing given_name', async () => {
    const event = {
      request: {
        userAttributes: {
          family_name: 'Doe',
        },
      },
    } as any;

    await expect(handler(event, {} as any, () => {})).rejects.toThrow(
      'First and last name are required.',
    );
  });

  it('rejects sign-up requests with blank family_name', async () => {
    const event = {
      request: {
        userAttributes: {
          given_name: 'Jane',
          family_name: '   ',
        },
      },
    } as any;

    await expect(handler(event, {} as any, () => {})).rejects.toThrow(
      'First and last name are required.',
    );
  });
});
