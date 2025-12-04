import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((title, description, variant = 'info') => {
    const id = Date.now().toString();
    const newToast = { id, title, description, variant, open: true };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    const duration = variant === 'error' ? 5000 : 3000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title, description) => {
    return showToast(title, description, 'success');
  }, [showToast]);

  const error = useCallback((title, description) => {
    return showToast(title, description, 'error');
  }, [showToast]);

  const warning = useCallback((title, description) => {
    return showToast(title, description, 'warning');
  }, [showToast]);

  const info = useCallback((title, description) => {
    return showToast(title, description, 'info');
  }, [showToast]);

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}

