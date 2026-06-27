<template>
  <div class="animate-pulse" aria-busy="true" :aria-label="ariaLabel">
    <!-- 文本行 -->
    <div v-if="variant === 'text'" class="space-y-2">
      <div
        v-for="i in lines"
        :key="i"
        class="h-4 rounded bg-elevated"
        :class="i === lines ? 'w-2/3' : 'w-full'"
      />
    </div>

    <!-- 圆形 -->
    <div
      v-else-if="variant === 'circle'"
      class="rounded-full bg-elevated"
      :class="sizeClass"
    />

    <!-- 单个卡片 -->
    <div
      v-else-if="variant === 'card'"
      class="rounded-[16px] bg-elevated"
      :class="cardClass"
    />

    <!-- 仪表盘卡片（模拟真实卡片结构） -->
    <DashboardSkeletonCard v-else-if="variant === 'dashboard-card'" :with-progress="withProgress" />

    <!-- 仪表盘卡片网格 -->
    <div
      v-else-if="variant === 'dashboard-cards'"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <DashboardSkeletonCard
        v-for="i in count"
        :key="i"
        :with-progress="withProgress"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'text' | 'circle' | 'card' | 'cards' | 'dashboard-card' | 'dashboard-cards';
  lines?: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  cardHeight?: string;
  withProgress?: boolean;
  ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  lines: 3,
  count: 3,
  size: 'md',
  cardHeight: 'h-32',
  withProgress: true,
  ariaLabel: '加载中…',
});

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-6 w-6';
    case 'lg':
      return 'h-12 w-12';
    default:
      return 'h-8 w-8';
  }
});

const cardClass = computed(() => props.cardHeight);
</script>
