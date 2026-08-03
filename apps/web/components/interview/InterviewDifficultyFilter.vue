<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="rounded-[9.6px] border px-3.5 py-1.5 text-[13px] transition-colors"
      :class="
        modelValue === opt.value
          ? 'border-strong bg-elevated text-ink'
          : 'border-border bg-surface text-secondary hover:border-strong'
      "
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
      <span v-if="counts[opt.value] !== undefined" class="ml-1 text-muted">
        {{ counts[opt.value] }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { InterviewDifficulty } from '@skill/shared';

export type DifficultyFilter = 'ALL' | InterviewDifficulty;

const options: { value: DifficultyFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: InterviewDifficulty.EASY, label: '简单' },
  { value: InterviewDifficulty.MEDIUM, label: '中等' },
  { value: InterviewDifficulty.HARD, label: '困难' },
];

defineProps<{
  modelValue: DifficultyFilter;
  counts: Partial<Record<DifficultyFilter, number>>;
}>();

defineEmits<{
  (e: 'update:modelValue', value: DifficultyFilter): void;
}>();
</script>
