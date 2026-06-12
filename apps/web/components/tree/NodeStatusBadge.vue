<template>
  <span
    class="rounded-full px-2 py-0.5 text-[12px] font-[500]"
    :class="badgeClass"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  level: number;
}

const props = defineProps<Props>();

const label = computed(() => {
  if (props.level === 1) return 'L1';
  if (props.level === 2) return 'L2';
  if (props.level === 3) return 'L3';
  return '';
});

const badgeClass = computed(() => {
  if (props.level === 1) return 'bg-charcoal text-pure-white';
  if (props.level === 2) return 'bg-dust-blue text-ink-black';
  return 'bg-warm-parchment text-ink-black';
});
</script>
