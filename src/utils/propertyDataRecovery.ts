import { fetchAuthSession } from 'aws-amplify/auth';
import { assertAmplifyResult, type AmplifyResult } from './errorReporter';

export interface PropertyDataSnapshot {
  properties: any[];
  transactions: any[];
}

interface ReadPropertyDataOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  verifyPropertyId?: string;
}

interface MutatePropertyDataOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  failureMessage: string;
  syncFamilyAccess?: () => Promise<unknown>;
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
    message.includes('group membership') ||
    message.includes('family access')
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

export async function mutatePropertyDataWithRetry<T>(
  mutateData: () => Promise<AmplifyResult<T>>,
  options: MutatePropertyDataOptions
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 500);
  let finalError: PropertyDataRecoverableError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await mutateData();
      return assertAmplifyResult(result, options.failureMessage);
    } catch (error) {
      if (!isLikelyFamilyClaimPropagationDelay(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        finalError = new PropertyDataRecoverableError(
          'AUTH_SYNC',
          'Family access synchronization is still in progress. Please wait a moment and try again.'
        );
        break;
      }

      if (options.syncFamilyAccess) {
        try {
          await options.syncFamilyAccess();
        } catch {
          // Best-effort: if syncing fails we still refresh the session and retry.
        }
      }

      try {
        await fetchAuthSession({ forceRefresh: true });
      } catch {
        // Best-effort session refresh. The next retry may still succeed.
      }

      await wait(baseDelayMs * attempt);
    }
  }

  if (finalError) {
    throw finalError;
  }

  throw new Error(options.failureMessage);
}

export function getPropertyReadErrorMessage(error: unknown): string {
  if (error instanceof PropertyDataRecoverableError) {
    return error.message;
  }

  return 'Unable to load property data right now. Please try again.';
}
