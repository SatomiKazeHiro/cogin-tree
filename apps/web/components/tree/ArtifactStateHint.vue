<template>
  <div v-if="status === GenerationTaskStatus.FAILED" class="rounded-[9.6px] border border-border p-5">
    <p class="mb-3 text-[14px] text-danger">生成失败：{{ lastError || '未知原因' }}</p>
    <button
      type="button"
      class="rounded-[9.6px] border border-border bg-surface px-4 py-1.5 text-[13px] text-ink transition-colors hover:bg-elevated"
      @click="emit('retry')"
    >
      重试
    </button>
  </div>

  <div
    v-else-if="status === GenerationTaskStatus.GENERATING || status === GenerationTaskStatus.PENDING"
    class="flex items-center gap-3 rounded-[9.6px] border border-dashed border-border p-5 text-[13px] text-muted"
  >
    <div class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border-strong border-t-ink" />
    <span>{{ pendingText }}</span>
  </div>

  <EmptyState v-else :title="emptyTitle" :description="emptyDescription" />
</template>

<script setup lang="ts">
import { GenerationTaskStatus } from '@skill/shared';

withDefaults(
  defineProps<{
    status: GenerationTaskStatus;
    lastError?: string | null;
    pendingText?: string;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  {
    lastError: null,
    pendingText: '正在生成…',
    emptyTitle: '暂无内容',
    emptyDescription: '',
  },
);

const emit = defineEmits<{ (e: 'retry'): void }>();
</script>
