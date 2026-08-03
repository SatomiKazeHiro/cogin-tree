<template>
  <div class="mx-auto h-full max-w-[860px] overflow-y-auto px-6 py-8">
    <!-- 加载中（首次访问需等待 AI 生成） -->
    <div v-if="loading" class="space-y-4">
      <p class="text-[14px] text-muted">正在生成面试题，首次生成约需半分钟…</p>
      <AppSkeleton v-for="i in 4" :key="i" variant="card" card-height="h-28" />
    </div>

    <!-- 加载失败 -->
    <div v-else-if="loadError" class="flex flex-col items-center gap-4 py-20">
      <p class="text-[14px] text-danger">{{ loadError }}</p>
      <AppButton @click="loadQuestions">重试</AppButton>
    </div>

    <!-- 空结果 -->
    <EmptyState
      v-else-if="questions.length === 0"
      title="暂无面试题"
      description="稍后再来看看。"
    />

    <!-- Q&A 列表 -->
    <template v-else>
      <div class="mb-6 flex items-center justify-between gap-4">
        <InterviewDifficultyFilter v-model="difficulty" :counts="counts" />
        <span class="shrink-0 text-[13px] text-muted">
          共 {{ filteredQuestions.length }} 题
        </span>
      </div>

      <div
        v-for="group in groupedQuestions"
        :key="group.topic"
        class="mb-8"
      >
        <h2 class="mb-3 font-serif text-[18px] font-[400] text-ink">
          {{ group.topic || '通用' }}
        </h2>
        <div class="space-y-3">
          <InterviewQuestionCard
            v-for="q in group.questions"
            :key="q.id"
            :question="q"
          />
        </div>
      </div>

      <EmptyState
        v-if="filteredQuestions.length === 0"
        title="该难度下暂无题目"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { InterviewDifficulty, type InterviewQuestion, type SkillTree } from '@skill/shared';
import type { DifficultyFilter } from '~/components/interview/InterviewDifficultyFilter.vue';

definePageMeta({
  middleware: ['auth'],
  layout: 'fullscreen',
});

const route = useRoute();
const { api } = useApi();
const pageHeader = usePageHeader();

const treeId = route.params.id as string;

const questions = ref<InterviewQuestion[]>([]);
const loading = ref(true);
const loadError = ref('');
const difficulty = ref<DifficultyFilter>('ALL');

const counts = computed<Partial<Record<DifficultyFilter, number>>>(() => ({
  ALL: questions.value.length,
  [InterviewDifficulty.EASY]: questions.value.filter((q) => q.difficulty === InterviewDifficulty.EASY).length,
  [InterviewDifficulty.MEDIUM]: questions.value.filter((q) => q.difficulty === InterviewDifficulty.MEDIUM).length,
  [InterviewDifficulty.HARD]: questions.value.filter((q) => q.difficulty === InterviewDifficulty.HARD).length,
}));

const filteredQuestions = computed(() =>
  difficulty.value === 'ALL'
    ? questions.value
    : questions.value.filter((q) => q.difficulty === difficulty.value),
);

const groupedQuestions = computed(() => {
  const groups: { topic: string; questions: InterviewQuestion[] }[] = [];
  for (const q of filteredQuestions.value) {
    const existing = groups.find((g) => g.topic === q.topic);
    if (existing) {
      existing.questions.push(q);
    } else {
      groups.push({ topic: q.topic, questions: [q] });
    }
  }
  return groups;
});

async function loadQuestions() {
  loading.value = true;
  loadError.value = '';
  try {
    questions.value = await api<InterviewQuestion[]>(`/skill-trees/${treeId}/interview`);
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : '面试题加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const tree = await api<SkillTree>(`/skill-trees/${treeId}`);
    pageHeader.value = {
      title: `${tree.name} · 面试`,
      backTo: `/skills/${treeId}/tree`,
    };
  } catch {
    pageHeader.value = { title: '面试模式', backTo: '/dashboard' };
  }
  loadQuestions();
});

onUnmounted(() => {
  pageHeader.value = {};
});
</script>
