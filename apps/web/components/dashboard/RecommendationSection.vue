<template>
  <section>
    <h2 class="mb-4 font-anthropic-serif text-[24px] font-[330] text-ink">
      为你推荐
    </h2>

    <div v-if="loading" class="text-muted">
      正在生成个性化推荐…
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
