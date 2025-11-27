'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, [removeToast]);

  const toast = {
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error'),
    info: (message: string) => addToast(message, 'info'),
    warning: (message: string) => addToast(message, 'warning'),
  };

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-zinc-900 border-l-4 border-emerald-500 text-emerald-100',
          icon: Check,
        };
      case 'error':
        return {
          container: 'bg-zinc-900 border-l-4 border-red-500 text-red-100',
          icon: AlertTriangle,
        };
      case 'info':
        return {
          container: 'bg-zinc-900 border-l-4 border-blue-500 text-blue-100',
          icon: Info,
        };
      case 'warning':
        return {
          container: 'bg-zinc-900 border-l-4 border-yellow-500 text-yellow-100',
          icon: AlertTriangle,
        };
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const styles = getToastStyles(toast.type);
            const Icon = styles.icon;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`${styles.container} px-4 py-3 rounded-r-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md pointer-events-auto`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <p className="flex-1 text-sm font-medium">{toast.message}</p>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 hover:opacity-70 transition-opacity"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}

