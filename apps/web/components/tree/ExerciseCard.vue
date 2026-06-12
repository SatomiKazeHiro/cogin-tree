<template>
  <div class="rounded-[16px] border border-linen-border bg-pure-white p-5">
    <p class="mb-4 text-[16px] font-[500] text-ink-black">{{ exercise.question }}</p>

    <div class="mb-4 space-y-2">
      <button
        v-for="(option, index) in exercise.options"
        :key="index"
        class="w-full rounded-[9.6px] border px-4 py-2.5 text-left text-[15px] transition-colors"
        :class="optionClass(index)"
        :disabled="answered"
        @click="select(index)"
      >
        {{ option }}
      </button>
    </div>

    <div v-if="answered">
      <p
        class="mb-2 text-[14px] font-[500]"
        :class="isCorrect ? 'text-green-700' : 'text-red-600'"
      >
        {{ isCorrect ? '回答正确' : '回答错误' }}
      </p>
      <p class="text-[14px] leading-relaxed text-stone-gray">
        {{ exercise.explanation }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Exercise {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const props = defineProps<{ exercise: Exercise }>();

const selected = ref<number | null>(null);
const answered = computed(() => selected.value !== null);
const isCorrect = computed(() => selected.value === props.exercise.correctIndex);

function select(index: number) {
  if (answered.value) return;
  selected.value = index;
}

function optionClass(index: number) {
  if (!answered.value) {
    return 'border-linen-border bg-pure-white hover:border-charcoal';
  }
  if (index === props.exercise.correctIndex) {
    return 'border-green-600 bg-green-50 text-green-900';
  }
  if (index === selected.value) {
    return 'border-red-400 bg-red-50 text-red-800';
  }
  return 'border-linen-border bg-pure-white opacity-60';
}
</script>
