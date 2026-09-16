<template>
  <div class="mx-auto h-full max-w-[860px] overflow-y-auto px-6 py-8">
    <!-- 加载中 -->
    <div v-if="loading" class="space-y-4">
      <p class="text-[14px] text-muted">正在加载面试题…</p>
      <AppSkeleton v-for="i in 4" :key="i" variant="card" card-height="h-28" />
    </div>

    <!-- 加载失败 -->
    <div v-else-if="loadError" class="flex flex-col items-center gap-4 py-20">
      <p class="text-[14px] text-danger">{{ loadError }}</p>
      <AppButton @click="loadQuestions">重试</AppButton>
    </div>

    <!-- 空结果 -->
    <EmptyState
      v-else-if="groups.length === 0"
      title="暂无面试题"
      description="先在技能树中展开 L2 节点，再来查看面试题。"
    />

    <!-- 按节点分组的 Q&A -->
    <template v-else>
      <div class="mb-6 flex items-center justify-between gap-4">
        <InterviewDifficultyFilter v-model="difficulty" :counts="counts" />
        <span class="shrink-0 text-[13px] text-muted">
          共 {{ filteredCount }} 题
        </span>
      </div>

      <div
        v-for="group in visibleGroups"
        :key="group.nodeId"
        class="mb-8"
        :class="{ 'opacity-70': isOutdated(group.nodeStatus) }"
      >
        <h2 class="mb-3 flex items-baseline gap-2 font-serif text-[18px] font-[400] text-ink">
          <span class="text-[13px] text-muted">{{ group.l1Title }} /</span>
          {{ group.nodeTitle }}
          <span
            v-if="isOutdated(group.nodeStatus)"
            class="rounded-[6px] bg-elevated px-2 py-0.5 text-[12px] text-muted"
          >
            已过时
          </span>
        </h2>

        <!-- 该节点题目生成中 -->
        <div
          v-if="group.questions.length === 0"
          class="rounded-[9.6px] border border-dashed border-border p-5 text-[13px] text-muted"
        >
          该主题题目生成中，稍后自动出现…
        </div>

        <div v-else class="space-y-3">
          <InterviewQuestionCard
            v-for="q in filterByDifficulty(group.questions)"
            :key="q.id"
            :question="q"
          />
          <p
            v-if="filterByDifficulty(group.questions).length === 0"
            class="text-[13px] text-muted"
          >
            该难度下暂无题目。
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  InterviewDifficulty,
  NodeStatus,
  type InterviewNodeGroup,
  type InterviewQuestion,
  type SkillTree,
} from '@skill/shared';
import type { DifficultyFilter } from '~/components/interview/InterviewDifficultyFilter.vue';

definePageMeta({
  middleware: ['auth'],
  layout: 'fullscreen',
});

const route = useRoute();
const { api } = useApi();
const pageHeader = usePageHeader();

const treeId = route.params.id as string;
const MAX_RETRY = 2;

const groups = ref<InterviewNodeGroup[]>([]);
const loading = ref(true);
const loadError = ref('');
const difficulty = ref<DifficultyFilter>('ALL');
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const allQuestions = computed(() => groups.value.flatMap((g) => g.questions));

const counts = computed<Partial<Record<DifficultyFilter, number>>>(() => ({
  ALL: allQuestions.value.length,
  [InterviewDifficulty.EASY]: allQuestions.value.filter((q) => q.difficulty === InterviewDifficulty.EASY).length,
  [InterviewDifficulty.MEDIUM]: allQuestions.value.filter((q) => q.difficulty === InterviewDifficulty.MEDIUM).length,
  [InterviewDifficulty.HARD]: allQuestions.value.filter((q) => q.difficulty === InterviewDifficulty.HARD).length,
}));

const filteredCount = computed(
  () =>
    groups.value.reduce((sum, g) => sum + filterByDifficulty(g.questions).length, 0),
);

/** 有题的组，或正在生成中的组都展示 */
const visibleGroups = computed(() => groups.value);

function filterByDifficulty(questions: InterviewQuestion[]) {
  return difficulty.value === 'ALL'
    ? questions
    : questions.filter((q) => q.difficulty === difficulty.value);
}

function isOutdated(status: NodeStatus) {
  return status !== NodeStatus.ACTIVE;
}

/** 有空题组（后台懒生成中）时，15s 后静默重取，最多 MAX_RETRY 次 */
function scheduleRetryIfPending() {
  const hasPending = groups.value.some((g) => g.questions.length === 0);
  if (hasPending && retryCount < MAX_RETRY) {
    retryCount += 1;
    retryTimer = setTimeout(() => loadQuestions(true), 15000);
  }
}

async function loadQuestions(silent = false) {
  if (!silent) {
    loading.value = true;
    loadError.value = '';
  }
  try {
    groups.value = await api<InterviewNodeGroup[]>(`/skill-trees/${treeId}/interview`);
    scheduleRetryIfPending();
  } catch (err: unknown) {
    if (!silent) {
      loadError.value = err instanceof Error ? err.message : '面试题加载失败';
    }
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
  if (retryTimer) clearTimeout(retryTimer);
});
</script>
