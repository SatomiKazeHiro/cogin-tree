<template>
  <div class="rounded-[16px] border border-border bg-surface p-5 transition-all hover:border-strong hover:bg-elevated">
    <h3 class="mb-2 font-anthropic-serif text-[18px] font-[330] text-ink">
      {{ recommendation.title }}
    </h3>
    <p class="mb-3 line-clamp-2 text-[14px] text-muted">
      {{ recommendation.description }}
    </p>
    <p class="mb-3 text-[13px] leading-relaxed text-muted">
      推荐理由：{{ recommendation.reason }}
    </p>

    <div v-if="recommendation.matchTags?.length" class="mb-3 flex flex-wrap gap-2">
      <span
        v-for="tag in recommendation.matchTags"
        :key="tag"
        class="rounded-full bg-accent px-2 py-0.5 text-[12px] text-accent-text"
      >
        {{ tag }}
      </span>
    </div>

    <div v-if="recommendation.keywords?.length" class="mb-4">
      <p class="mb-1.5 text-[13px] font-[500] text-secondary">补充关键词</p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="keyword in recommendation.keywords"
          :key="keyword"
          class="rounded-full bg-border px-2 py-0.5 text-[12px] text-ink"
        >
          {{ keyword }}
        </span>
      </div>
    </div>

    <AppButton variant="secondary" size="sm" @click="$emit('start')">
      开始学习
    </AppButton>
  </div>
</template>

<script setup lang="ts">
interface Recommendation {
  id: string;
  title: string;
  description?: string;
  reason: string;
  matchTags: string[];
  suggestedMode: string;
  keywords?: string[];
}

defineProps<{
  recommendation: Recommendation;
}>();

defineEmits<{
  (e: 'start'): void;
}>();
</script>
