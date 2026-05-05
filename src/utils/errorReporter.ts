import { useState, useCallback } from 'react';

export type ToastState = { message: string; type: 'success' | 'error' } | null;

/**
 * Shared toast/error-reporting hook.
 *
 * Usage:
 *   const { toast, showError, showSuccess, clearToast } = useToast();
 *
 * Then render:
 *   {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const showError = useCallback((message: string) => {
    setToast({ message, type: 'error' });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, type: 'success' });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showError, showSuccess, clearToast };
}
