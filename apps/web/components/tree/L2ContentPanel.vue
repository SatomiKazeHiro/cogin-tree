<template>
  <div class="flex h-full flex-col bg-surface">
    <!-- Header -->
    <header class="shrink-0 px-8 pt-8">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <span class="shrink-0 rounded bg-accent px-2 py-0.5 text-[11px] font-[600] tracking-wider text-accent-text">
            L2
          </span>
          <h2 class="font-anthropic-serif text-[26px] font-[330] leading-tight text-ink">
            {{ title }}
          </h2>
        </div>
        <button
          type="button"
          class="rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink"
          aria-label="关闭"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Tabs -->
      <nav class="flex gap-6 border-b border-border" aria-label="学习内容标签">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="relative -mb-px pb-2 text-[14px] transition-colors"
          :class="activeTab === tab.key ? 'text-ink' : 'text-muted hover:text-secondary'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span
            v-if="activeTab === tab.key"
            class="absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-ink"
          />
        </button>
      </nav>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto bg-surface px-8 pb-10 pt-8">
      <TreeL3Content
        v-if="artifacts"
        :artifacts="artifacts"
        :active-tab="activeTab"
        @retry="onRetry"
        @request-exercises="onRequestExercises"
      />
      <div v-else class="flex flex-col items-center justify-center py-24 text-muted">
        <div class="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-border-strong border-t-ink" />
        <p class="text-[15px]">正在读取产物状态…</p>
      </div>
    </main>

    <!-- Learning status actions -->
    <footer class="shrink-0 border-t border-border px-8 py-4">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-muted">学习状态：</span>
        <button
          v-for="option in statusOptions"
          :key="option.value"
          type="button"
          class="rounded-[9.6px] px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50"
          :class="[
            learningStatus === option.value
              ? option.buttonClass
              : 'border border-border bg-surface text-secondary hover:border-strong hover:text-ink',
          ]"
          :disabled="!nodeId"
          @click="setStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { ArtifactKind, GenerationTaskStatus, NodeLearningStatus } from '@skill/shared';
import type { NodeArtifactsResponse } from '@skill/shared';
import { learningStatusMeta } from '../../utils/learning-status';

const props = defineProps<{
  title: string;
  artifacts: NodeArtifactsResponse | null;
  loading?: boolean;
  nodeId?: string | null;
  learningStatus?: NodeLearningStatus;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'status-change', nodeId: string, status: NodeLearningStatus): void;
  (e: 'retry-artifact', nodeId: string, kind: ArtifactKind): void;
  (e: 'request-exercises', nodeId: string): void;
}>();

function setStatus(status: NodeLearningStatus) {
  if (!props.nodeId) return;
  emit('status-change', props.nodeId, status);
}

function onRetry(kind: ArtifactKind) {
  if (props.nodeId) emit('retry-artifact', props.nodeId, kind);
}

function onRequestExercises() {
  if (props.nodeId) emit('request-exercises', props.nodeId);
}

const activeTab = ref<'concept' | 'code' | 'exercise'>('concept');

const statusOptions = [
  { value: NodeLearningStatus.NOT_STARTED, ...learningStatusMeta[NodeLearningStatus.NOT_STARTED] },
  { value: NodeLearningStatus.IN_PROGRESS, ...learningStatusMeta[NodeLearningStatus.IN_PROGRESS] },
  { value: NodeLearningStatus.COMPLETED, ...learningStatusMeta[NodeLearningStatus.COMPLETED] },
  { value: NodeLearningStatus.SKIPPED, ...learningStatusMeta[NodeLearningStatus.SKIPPED] },
];

const tabs = computed(() => {
  const list: { key: 'concept' | 'code' | 'exercise'; label: string }[] = [
    { key: 'concept', label: '概念' },
  ];
  // 生成中/未就绪时不冒出空的 code tab；就绪后才展示
  if (
    props.artifacts?.codeExamples.status === GenerationTaskStatus.READY &&
    props.artifacts.codeExamples.items.length > 0
  ) {
    list.push({ key: 'code', label: '代码演示' });
  }
  list.push({ key: 'exercise', label: '练习题' });
  return list;
});

// 切换节点时回到概念 tab
watch(
  () => props.nodeId,
  () => {
    activeTab.value = 'concept';
  },
);

watch(tabs, (nextTabs) => {
  const keys = nextTabs.map((t) => t.key);
  if (!keys.includes(activeTab.value)) {
    activeTab.value = 'concept';
  }
});

// 练习题按需生成：切到该 tab 时若尚未就绪（PENDING / FAILED）则请求
watch(activeTab, (tab) => {
  if (tab !== 'exercise' || !props.artifacts || !props.nodeId) return;
  const status = props.artifacts.exercises.status;
  if (status === GenerationTaskStatus.PENDING || status === GenerationTaskStatus.FAILED) {
    emit('request-exercises', props.nodeId);
  }
});
</script>
