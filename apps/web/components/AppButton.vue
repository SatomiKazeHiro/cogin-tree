<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center rounded-[9.6px] px-5 py-2.5 text-[15px] font-[430] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
    :class="variantClasses"
  >
    <span v-if="loading" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  loading: false,
  disabled: false,
});

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-charcoal text-pure-white hover:opacity-90';
    case 'secondary':
      return 'bg-pure-white text-ink-black border border-linen-border hover:bg-warm-parchment';
    case 'ghost':
      return 'bg-transparent text-stone-gray hover:text-ink-black';
    default:
      return 'bg-charcoal text-pure-white hover:opacity-90';
  }
});
</script>
