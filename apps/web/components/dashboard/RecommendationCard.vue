<template>
  <div class="rounded-[16px] border border-linen-border bg-pure-white p-5">
    <h3 class="mb-2 font-anthropic-serif text-[18px] font-[330] text-ink-black">
      {{ recommendation.title }}
    </h3>
    <p class="mb-4 line-clamp-2 text-[14px] text-stone-gray">
      {{ recommendation.description }}
    </p>
    <AppButton variant="secondary" :loading="loading" @click="$emit('start')">
      开始学习
    </AppButton>
  </div>
</template>

<script setup lang="ts">
interface Recommendation {
  title: string;
  description?: string;
}

defineProps<{
  recommendation: Recommendation;
  loading?: boolean;
}>();

defineEmits<{
  (e: 'start'): void;
}>();
</script>
