<template>
  <section class="mb-10">
    <h2 class="mb-4 font-anthropic-serif text-[24px] font-[330] text-ink">
      正在学习
    </h2>

    <AppSkeleton
      v-if="loading"
      variant="dashboard-cards"
      :count="3"
      :with-progress="false"
      aria-label="加载正在学习…"
    />
    <div v-else-if="items.length === 0" class="text-muted">
      还没有正在学习的技能树，打开一个技能树开始学习吧。
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="item in items"
        :key="item.skillTreeId"
        :to="`/skills/${item.skillTreeId}/tree`"
        class="group block rounded-[16px] border border-border bg-surface p-5 transition-all hover:border-strong hover:bg-elevated"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <h3 class="truncate font-anthropic-serif text-[18px] font-[330] text-ink">
            {{ item.skillTree?.name || '未知技能树' }}
          </h3>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-[12px]"
            :class="statusBadgeClass(item.status)"
          >
            {{ statusLabel(item.status) }}
          </span>
        </div>

        <p class="mb-4 line-clamp-2 text-[14px] text-muted">
          {{ item.skillTree?.description || '暂无描述' }}
        </p>

        <div v-if="item.lastNode" class="text-[13px] text-secondary">
          最近学习：{{ item.lastNode.title }}
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SkillTree, NodeLearningStatus } from '@skill/shared';
import { getLearningStatusMeta } from '../../utils/learning-status';

interface CurrentLearningItem {
  skillTreeId: string;
  skillTree: SkillTree | null;
  status: string;
  progress: number;
  lastNode: { id: string; title: string; status: string; updatedAt: string } | null;
}

defineProps<{
  items: CurrentLearningItem[];
  loading?: boolean;
}>();

function statusLabel(status: string | undefined) {
  return getLearningStatusMeta(status as NodeLearningStatus).label;
}

function statusBadgeClass(status: string | undefined) {
  return getLearningStatusMeta(status as NodeLearningStatus).badgeClass;
}
</script>
