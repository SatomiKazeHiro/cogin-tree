<template>
  <div class="rounded-[9.6px] border border-border bg-surface p-5">
    <div class="flex items-start justify-between gap-3">
      <p class="text-[15px] font-[500] leading-relaxed text-ink">
        {{ question.question }}
      </p>
      <span
        class="shrink-0 rounded-[6px] px-2 py-0.5 text-[12px]"
        :class="difficultyClass"
      >
        {{ difficultyLabel }}
      </span>
    </div>

    <button
      type="button"
      class="mt-3 flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-secondary"
      @click="expanded = !expanded"
    >
      <ChevronDown
        :size="14"
        class="transition-transform duration-200"
        :class="{ 'rotate-180': expanded }"
      />
      {{ expanded ? '收起参考答案' : '查看参考答案' }}
    </button>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <p
        v-if="expanded"
        class="mt-3 border-t border-border pt-3 text-[14px] leading-relaxed text-secondary"
      >
        {{ question.answer }}
      </p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import { InterviewDifficulty, type InterviewQuestion } from '@skill/shared';

const props = defineProps<{
  question: InterviewQuestion;
}>();

const expanded = ref(false);

const difficultyLabel = computed(() => {
  switch (props.question.difficulty) {
    case InterviewDifficulty.EASY:
      return '简单';
    case InterviewDifficulty.MEDIUM:
      return '中等';
    case InterviewDifficulty.HARD:
      return '困难';
    default:
      return props.question.difficulty;
  }
});

const difficultyClass = computed(() => {
  switch (props.question.difficulty) {
    case InterviewDifficulty.EASY:
      return 'bg-elevated text-success';
    case InterviewDifficulty.MEDIUM:
      return 'bg-elevated text-secondary';
    case InterviewDifficulty.HARD:
      return 'bg-elevated text-danger';
    default:
      return 'bg-elevated text-muted';
  }
});
</script>
