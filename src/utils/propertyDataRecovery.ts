export interface PropertyDataSnapshot {
  properties: any[];
  transactions: any[];
}

interface ReadPropertyDataOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  verifyPropertyId?: string;
}

export type PropertyDataRecoveryKind = 'AUTH_SYNC' | 'VISIBILITY_SYNC';

export class PropertyDataRecoverableError extends Error {
  readonly kind: PropertyDataRecoveryKind;

  constructor(kind: PropertyDataRecoveryKind, message: string) {
    super(message);
    this.name = 'PropertyDataRecoverableError';
    this.kind = kind;
  }
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  const graphQLErrors = (error as { errors?: Array<{ message?: string }> })?.errors;
  if (Array.isArray(graphQLErrors) && graphQLErrors.length > 0) {
    const messages = graphQLErrors
      .map((item) => item?.message)
      .filter((message): message is string => Boolean(message));
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return 'Unknown error';
}

export function isLikelyFamilyClaimPropagationDelay(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('not authorized') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('access denied') ||
    message.includes('group')
  );
}

async function wait(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readPropertyDataWithRetry(
  fetchData: () => Promise<PropertyDataSnapshot>,
  options: ReadPropertyDataOptions = {}
): Promise<PropertyDataSnapshot> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 4);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 500);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const snapshot = await fetchData();
      if (options.verifyPropertyId) {
        const visible = snapshot.properties.some((property) => property?.id === options.verifyPropertyId);
        if (!visible) {
          if (attempt === maxAttempts) {
            throw new PropertyDataRecoverableError(
              'VISIBILITY_SYNC',
              'Property saved, but your session is still syncing family access. Please refresh in a few seconds.'
            );
          }
          await wait(baseDelayMs * attempt);
          continue;
        }
      }

      return snapshot;
    } catch (error) {
      if (error instanceof PropertyDataRecoverableError) {
        throw error;
      }

      if (isLikelyFamilyClaimPropagationDelay(error)) {
        if (attempt === maxAttempts) {
          throw new PropertyDataRecoverableError(
            'AUTH_SYNC',
            'We are still syncing your family access. Please wait a moment and tap Refresh.'
          );
        }

        await wait(baseDelayMs * attempt);
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to load property data.');
}

export function getPropertyReadErrorMessage(error: unknown): string {
  if (error instanceof PropertyDataRecoverableError) {
    return error.message;
  }

  return 'Unable to load property data right now. Please try again.';
}
