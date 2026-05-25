import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error';

export type ToastMessage = { id: string; message: string; type: ToastType };
export type ToastState = ToastMessage | null;
export type AmplifyErrorLike = { message?: string };
export type AmplifyResult<T> = { data?: T | null; errors?: AmplifyErrorLike[] | null };

let toastIdCounter = 0;

export function createToastMessage(message: string, type: ToastType): ToastMessage {
  let uniqueId: string;

  try {
    uniqueId =
      typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${++toastIdCounter}`;
  } catch {
    uniqueId = `${Date.now()}-${++toastIdCounter}`;
  }

  return {
    id: uniqueId,
    message,
    type,
  };
}

function getAmplifyErrorMessage(errors: AmplifyErrorLike[] | null | undefined): string | null {
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const firstMeaningfulMessage = errors
    .map((entry) => (typeof entry?.message === 'string' ? entry.message.trim() : ''))
    .find(Boolean);

  if (firstMeaningfulMessage) {
    return firstMeaningfulMessage;
  }

  try {
    return JSON.stringify(errors);
  } catch {
    return null;
  }
}

function buildAmplifyMissingDataMessage(fallbackMessage: string): string {
  const baseMessage = fallbackMessage.trim();
  if (!baseMessage) {
    return 'No data was returned by the API.';
  }

  return /[.!?]$/.test(baseMessage)
    ? `${baseMessage} No data was returned by the API.`
    : `${baseMessage}. No data was returned by the API.`;
}

export function assertAmplifyResult<T>(response: AmplifyResult<T>, fallbackMessage: string): T {
  const errorMessage = getAmplifyErrorMessage(response?.errors);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  if (response.data === null || response.data === undefined) {
    throw new Error(buildAmplifyMissingDataMessage(fallbackMessage));
  }

  return response.data;
}

/**
 * Shared toast/error-reporting hook.
 *
 * Usage:
 *   const { toast, showError, showSuccess, clearToast } = useToast();
 *
 * Then render:
 *   {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={clearToast} />}
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const showError = useCallback((message: string) => {
    setToast(createToastMessage(message, 'error'));
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast(createToastMessage(message, 'success'));
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showError, showSuccess, clearToast };
}
