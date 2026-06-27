export type ConfirmVariant = 'primary' | 'danger';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ConfirmVariant;
}

interface ConfirmState {
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  confirmVariant: ConfirmVariant;
  resolve: (value: boolean) => void;
}

const state = reactive<ConfirmState>({
  show: false,
  title: '确认操作',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  confirmVariant: 'primary',
  resolve: () => {},
});

export const useConfirm = () => {
  function confirm(options: ConfirmOptions = {}): Promise<boolean> {
    state.title = options.title ?? '确认操作';
    state.message = options.message ?? '';
    state.confirmText = options.confirmText ?? '确认';
    state.cancelText = options.cancelText ?? '取消';
    state.confirmVariant = options.confirmVariant ?? 'primary';
    state.show = true;

    return new Promise<boolean>((resolve) => {
      state.resolve = (value: boolean) => {
        state.show = false;
        resolve(value);
      };
    });
  }

  function resolve(value: boolean) {
    state.resolve(value);
  }

  return {
    state: readonly(state),
    confirm,
    resolve,
  };
};
