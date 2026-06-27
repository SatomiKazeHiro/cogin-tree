<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state.show"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-[400px] rounded-[16px] border border-border bg-surface p-6 shadow-none">
          <h3 class="font-anthropic-serif text-[18px] font-[330] text-ink">
            {{ state.title }}
          </h3>
          <p v-if="state.message" class="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-muted">
            {{ state.message }}
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <AppButton variant="ghost" size="sm" @click="resolve(false)">
              {{ state.cancelText }}
            </AppButton>
            <AppButton
              size="sm"
              :variant="state.confirmVariant"
              @click="resolve(true)"
            >
              {{ state.confirmText }}
            </AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { state, resolve } = useConfirm();
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
