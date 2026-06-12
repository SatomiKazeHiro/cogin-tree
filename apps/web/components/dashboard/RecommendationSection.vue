<template>
  <section>
    <h2 class="mb-4 font-anthropic-serif text-[24px] font-[330] text-ink-black">
      为你推荐
    </h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardRecommendationCard
        v-for="(item, index) in recommendations"
        :key="index"
        :recommendation="item"
        :loading="startingIndex === index"
        @start="$emit('start', item, index)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
interface Recommendation {
  title: string;
  description?: string;
}

defineProps<{
  recommendations: Recommendation[];
  startingIndex?: number | null;
}>();

defineEmits<{
  (e: 'start', item: Recommendation, index: number): void;
}>();
</script>
