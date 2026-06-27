export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const toasts = reactive<ToastItem[]>([]);

function remove(id: string) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
  }
}

function push(message: string, type: ToastType, duration = 3000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  toasts.push({ id, message, type, duration });

  if (duration > 0) {
    setTimeout(() => remove(id), duration);
  }
}

export const useToast = () => {
  return {
    toasts: readonly(toasts),
    success: (message: string, duration?: number) => push(message, 'success', duration),
    error: (message: string, duration?: number) => push(message, 'error', duration),
    info: (message: string, duration?: number) => push(message, 'info', duration),
    remove,
  };
};
