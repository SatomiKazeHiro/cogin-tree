<template>
  <div class="rounded-[12px] border border-border bg-surface p-5">
    <div class="mb-4 flex items-start gap-3">
      <span class="mt-0.5 shrink-0 rounded bg-elevated px-2 py-0.5 text-[12px] font-[500] text-muted">
        {{ label }}
      </span>
      <p class="text-[16px] font-[500] leading-snug text-ink">{{ exercise.question }}</p>
    </div>

    <div class="mb-4 space-y-2">
      <button
        v-for="(option, idx) in exercise.options"
        :key="idx"
        class="group flex w-full items-start gap-3 rounded-[9.6px] border px-4 py-3 text-left transition-all"
        :class="optionClass(idx)"
        :disabled="answered"
        @click="select(idx)"
      >
        <span
          class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-[600] transition-colors"
          :class="badgeClass(idx)"
        >
          {{ optionLetter(idx) }}
        </span>
        <span class="text-[15px] leading-snug">{{ option }}</span>
      </button>
    </div>

    <div v-if="answered" class="rounded-[9.6px] border p-4" :class="resultBoxClass">
      <p class="mb-1 flex items-center gap-1.5 text-[14px] font-[500]">
        <CheckCircle2 v-if="isCorrect" class="h-4 w-4" />
        <XCircle v-else class="h-4 w-4" />
        {{ isCorrect ? '回答正确' : '回答错误' }}
      </p>
      <p class="text-[14px] leading-relaxed text-muted">
        {{ exercise.explanation }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle2, XCircle } from 'lucide-vue-next';

interface Exercise {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const props = defineProps<{
  exercise: Exercise;
  index: number;
}>();

const selected = ref<number | null>(null);
const answered = computed(() => selected.value !== null);
const isCorrect = computed(() => selected.value === props.exercise.correctIndex);

const label = computed(() => `第 ${props.index + 1} 题`);

function optionLetter(idx: number) {
  return String.fromCharCode(65 + idx);
}

function select(index: number) {
  if (answered.value) return;
  selected.value = index;
}

function optionClass(idx: number) {
  if (!answered.value) {
    return 'border-border bg-surface text-secondary hover:border-strong hover:bg-elevated';
  }
  if (idx === props.exercise.correctIndex) {
    return 'border-success bg-success-bg text-success';
  }
  if (idx === selected.value) {
    return 'border-danger bg-danger-bg text-danger';
  }
  return 'border-border bg-surface text-muted opacity-60';
}

function badgeClass(idx: number) {
  if (!answered.value) {
    return 'border-border bg-surface text-muted group-hover:border-strong group-hover:text-ink';
  }
  if (idx === props.exercise.correctIndex) {
    return 'border-success bg-success text-surface';
  }
  if (idx === selected.value) {
    return 'border-danger bg-danger text-surface';
  }
  return 'border-border bg-surface text-muted';
}

const resultBoxClass = computed(() =>
  isCorrect.value ? 'border-success bg-success-bg' : 'border-danger bg-danger-bg',
);
</script>
