<template>
  <div class="mb-8">
    <div class="mb-3 flex justify-between text-[13px] font-[500] text-charcoal">
      <span>{{ currentLabel }}</span>
      <span>{{ current }} / {{ total }}</span>
    </div>
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-warm-parchment">
      <div
        class="h-full rounded-full bg-charcoal transition-all duration-300"
        :style="{ width: `${(current / total) * 100}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  current: number;
  total: number;
  labels: string[];
}

const props = defineProps<Props>();

const currentLabel = computed(() => props.labels[props.current - 1] || '');
</script>
