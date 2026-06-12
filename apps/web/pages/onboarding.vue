<template>
  <div class="mx-auto max-w-[720px]">
    <div v-if="loading" class="py-20 text-center text-stone-gray">
      加载中…
    </div>

    <div v-else-if="submitted">
      <PortraitSummary :portrait="portrait" />
      <div class="mt-8 flex justify-end">
        <AppButton @click="finish">
          确认并进入仪表盘
        </AppButton>
      </div>
    </div>

    <div v-else>
      <PortraitProgressBar
        :current="step + 1"
        :total="categoryOrder.length"
        :labels="categoryLabels"
      />

      <AppCard>
        <PortraitQuestionStep
          :title="categoryLabels[step]"
          :questions="currentQuestions"
          v-model="answers"
        />

        <div class="mt-8 flex justify-between">
          <AppButton variant="secondary" :disabled="step === 0" @click="prev">
            上一步
          </AppButton>
          <AppButton :loading="submitting" @click="next">
            {{ isLastStep ? '生成肖像' : '下一步' }}
          </AppButton>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
});

interface Question {
  id: string;
  category: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
}

const { api } = useApi();
const router = useRouter();

const categoryOrder = ['IDENTITY', 'INTEREST', 'GOAL', 'BACKGROUND'];
const categoryLabelMap: Record<string, string> = {
  IDENTITY: '身份与背景',
  INTEREST: '兴趣与偏好',
  GOAL: '目标与期望',
  BACKGROUND: '基础与投入',
};
const categoryLabels = categoryOrder.map((c) => categoryLabelMap[c]);

const questions = ref<Question[]>([]);
const loading = ref(true);
const step = ref(0);
const answers = ref<Record<string, string[]>>({});
const submitting = ref(false);
const submitted = ref(false);
const portrait = ref<Record<string, unknown>>({});

const groupedQuestions = computed(() => {
  return categoryOrder.map((cat) => questions.value.filter((q) => q.category === cat));
});

const currentQuestions = computed(() => groupedQuestions.value[step.value] || []);
const isLastStep = computed(() => step.value === categoryOrder.length - 1);

onMounted(async () => {
  try {
    const data = await api<{ questions: Question[] }>('/portrait/questions');
    questions.value = data.questions;
  } finally {
    loading.value = false;
  }
});

function prev() {
  if (step.value > 0) step.value--;
}

async function next() {
  if (!isCurrentStepAnswered()) return;

  if (isLastStep.value) {
    await submit();
    return;
  }

  step.value++;
}

function isCurrentStepAnswered() {
  return currentQuestions.value.every((q) => answers.value[q.id]?.length > 0);
}

async function submit() {
  submitting.value = true;
  try {
    const payload = Object.entries(answers.value).map(([questionId, selectedOptions]) => ({
      questionId,
      selectedOptions,
    }));
    portrait.value = await api<Record<string, unknown>>('/portrait/submit', {
      method: 'POST',
      body: { answers: payload },
    });
    submitted.value = true;
  } finally {
    submitting.value = false;
  }
}

function finish() {
  router.push('/dashboard');
}
</script>
