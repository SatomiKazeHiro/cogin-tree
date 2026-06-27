<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-fit items-center gap-3 rounded-[9.6px] border px-4 py-2.5 shadow-none"
          :class="typeClass[toast.type]"
          role="status"
        >
          <component :is="icon[toast.type]" class="h-4 w-4 shrink-0" />
          <span class="text-[14px]">{{ toast.message }}</span>
          <button
            type="button"
            class="ml-1 rounded p-0.5 transition-colors hover:bg-ink/5"
            aria-label="关闭"
            @click="remove(toast.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CheckCircle2, XCircle, Info, X } from 'lucide-vue-next';
import type { ToastType } from '../composables/useToast';

const { toasts, remove } = useToast();

const typeClass: Record<ToastType, string> = {
  success: 'border-success/30 bg-success-bg text-success',
  error: 'border-danger/30 bg-danger-bg text-danger',
  info: 'border-accent/30 bg-accent/10 text-accent-text',
};

const icon: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
