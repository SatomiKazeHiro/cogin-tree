<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center rounded-[9.6px] font-[500] transition-all disabled:cursor-not-allowed disabled:opacity-50"
    :class="[variantClasses, sizeClasses]"
  >
    <span v-if="loading" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
});

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-secondary text-surface hover:bg-ink';
    case 'secondary':
      return 'bg-surface text-ink border border-border hover:border-strong hover:bg-elevated';
    case 'soft':
      return 'bg-canvas text-secondary border border-border hover:border-strong hover:text-ink hover:bg-elevated';
    case 'ghost':
      return 'bg-transparent text-muted hover:text-ink hover:bg-elevated';
    case 'danger':
      return 'bg-danger text-surface hover:opacity-90';
    default:
      return 'bg-secondary text-surface hover:bg-ink';
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-4 py-1.5 text-[14px]';
    case 'lg':
      return 'px-6 py-3 text-[16px]';
    default:
      return 'px-5 py-2 text-[15px]';
  }
});
</script>
