<template>
  <div class="space-y-6">
    <h2 class="font-anthropic-serif text-[24px] font-[330] leading-[1.33] text-ink-black">
      {{ title }}
    </h2>

    <div v-for="question in questions" :key="question.id" class="space-y-3">
      <p class="text-[16px] text-ink-black">{{ question.question }}</p>
      <div class="grid gap-3">
        <template v-for="option in question.options" :key="option">
          <label
            class="flex cursor-pointer items-center gap-3 rounded-[9.6px] border border-linen-border bg-pure-white px-4 py-3 transition-colors hover:bg-warm-parchment"
            :class="{ 'border-charcoal bg-warm-parchment': isSelected(question.id, option) }"
          >
            <input
              :type="question.allowMultiple ? 'checkbox' : 'radio'"
              :name="question.id"
              :value="option"
              :checked="isSelected(question.id, option)"
              class="h-4 w-4 accent-charcoal"
              @change="toggle(question.id, option, question.allowMultiple)"
            />
            <span class="text-[15px] text-charcoal">{{ option }}</span>
          </label>

          <div
            v-if="option === '其他' && isOtherSelected(question.id)"
            class="mt-2"
          >
            <input
              v-model="customText[question.id]"
              type="text"
              placeholder="请补充说明"
              class="w-full rounded-[9.6px] border border-linen-border bg-pure-white px-4 py-2.5 text-[15px] text-ink-black focus:border-charcoal focus:outline-none"
              @input="updateOtherText(question.id)"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';

interface Question {
  id: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
}

interface Props {
  title: string;
  questions: Question[];
  modelValue: Record<string, string[]>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string[]>): void;
}>();

const customText: Record<string, string> = reactive({});

watch(
  () => props.modelValue,
  (value) => {
    for (const question of props.questions) {
      const selected = value[question.id] || [];
      const other = selected.find((o) => o.startsWith('其他：'));
      customText[question.id] = other ? other.slice('其他：'.length) : '';
    }
  },
  { immediate: true, deep: true },
);

function isSelected(questionId: string, option: string) {
  const selected = props.modelValue[questionId] || [];
  if (option === '其他') {
    return selected.some((o) => o === '其他' || o.startsWith('其他：'));
  }
  return selected.includes(option);
}

function isOtherSelected(questionId: string) {
  const selected = props.modelValue[questionId] || [];
  return selected.some((o) => o === '其他' || o.startsWith('其他：'));
}

function toggle(questionId: string, option: string, allowMultiple: boolean) {
  const current = props.modelValue[questionId] || [];
  let next: string[];

  if (option === '其他') {
    const otherSelected = current.some((o) => o === '其他' || o.startsWith('其他：'));
    if (otherSelected) {
      next = current.filter((o) => o !== '其他' && !o.startsWith('其他：'));
      customText[questionId] = '';
    } else {
      const text = customText[questionId]?.trim();
      next = [...current, text ? `其他：${text}` : '其他'];
    }
  } else if (allowMultiple) {
    next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
  } else {
    next = current.includes(option) ? [] : [option];
    if (!next.some((o) => o === '其他' || o.startsWith('其他：'))) {
      customText[questionId] = '';
    }
  }

  emit('update:modelValue', { ...props.modelValue, [questionId]: next });
}

function updateOtherText(questionId: string) {
  const current = props.modelValue[questionId] || [];
  const text = customText[questionId]?.trim();
  const withoutOther = current.filter((o) => o !== '其他' && !o.startsWith('其他：'));
  const next = text
    ? [...withoutOther, `其他：${text}`]
    : [...withoutOther, '其他'];
  emit('update:modelValue', { ...props.modelValue, [questionId]: next });
}
</script>
