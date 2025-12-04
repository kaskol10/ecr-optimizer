import React from 'react';
import * as Toast from '@radix-ui/react-toast';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import './Toast.css';

const ToastProvider = Toast.Provider;

function ToastViewport({ children }) {
  return (
    <Toast.Viewport className="toast-viewport" />
  );
}

function ToastComponent({ open, onOpenChange, title, description, variant = 'info' }) {
  const icons = {
    success: <CheckCircle2 className="toast-icon" />,
    error: <XCircle className="toast-icon" />,
    warning: <AlertCircle className="toast-icon" />,
    info: <AlertCircle className="toast-icon" />,
  };

  const variantClass = `toast-${variant}`;

  return (
    <Toast.Root
      className={`toast-root ${variantClass}`}
      open={open}
      onOpenChange={onOpenChange}
      duration={variant === 'error' ? 5000 : 3000}
    >
      <div className="toast-content">
        {icons[variant]}
        <div className="toast-text">
          {title && <Toast.Title className="toast-title">{title}</Toast.Title>}
          {description && (
            <Toast.Description className="toast-description">
              {description}
            </Toast.Description>
          )}
        </div>
      </div>
      <Toast.Close className="toast-close">
        <X size={16} />
      </Toast.Close>
    </Toast.Root>
  );
}

export { ToastProvider, ToastViewport, ToastComponent };

