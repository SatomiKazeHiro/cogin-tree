<template>
  <section>
    <h2 class="mb-4 font-anthropic-serif text-[24px] font-[330] text-ink">
      为你推荐
    </h2>

    <AppSkeleton
      v-if="loading"
      variant="dashboard-cards"
      :count="3"
      :with-progress="false"
      aria-label="加载推荐内容…"
    />
    <div v-else-if="!auth.hasPortrait" class="rounded-[16px] border border-border bg-surface p-6">
      <p class="mb-4 text-muted">
        完成肖像问卷后，我们将基于你的兴趣与目标生成个性化推荐。
      </p>
      <NuxtLink
        to="/onboarding"
        class="inline-flex rounded-[9.6px] bg-secondary px-4 py-1.5 text-[14px] text-surface transition-colors hover:bg-ink"
      >
        去设置肖像
      </NuxtLink>
    </div>
    <div v-else-if="recommendations.length === 0" class="text-muted">
      暂无推荐，稍后再来看看。
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardRecommendationCard
        v-for="(item, index) in recommendations"
        :key="index"
        :recommendation="item"
        @start="$emit('start', item)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
const auth = useAuthStore();

interface Recommendation {
  id: string;
  title: string;
  description?: string;
  reason: string;
  matchTags: string[];
  suggestedMode: string;
}

defineProps<{
  recommendations: Recommendation[];
  loading?: boolean;
}>();

defineEmits<{
  (e: 'start', item: Recommendation): void;
}>();
</script>
