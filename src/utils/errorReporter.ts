import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error';

export type ToastMessage = { id: string; message: string; type: ToastType };
export type ToastState = ToastMessage | null;

let toastSequence = 0;

export function createToastMessage(message: string, type: ToastType): ToastMessage {
  toastSequence += 1;
  return {
    id: `${Date.now()}-${toastSequence}`,
    message,
    type,
  };
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
