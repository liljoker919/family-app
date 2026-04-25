import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles =
    type === 'success'
      ? 'bg-green-50 border border-green-200 text-green-800'
      : 'bg-red-50 border border-red-200 text-red-800';

  const iconPath =
    type === 'success'
      ? 'M5 13l4 4L19 7'
      : 'M6 18L18 6M6 6l12 12';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-5 py-4 rounded-xl shadow-lg max-w-sm ${styles}`}
    >
      <svg
        className="w-5 h-5 mt-0.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="text-current opacity-60 hover:opacity-100 transition ml-2 shrink-0"
      >
        &times;
      </button>
    </div>
  );
}
