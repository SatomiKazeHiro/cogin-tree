<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-muted">
      <Info class="h-5 w-5" />
    </div>
    <h3 class="mb-1 font-anthropic-serif text-[17px] font-[330] text-ink">
      {{ title }}
    </h3>
    <p class="max-w-[280px] text-[14px] leading-relaxed text-muted">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { Info } from 'lucide-vue-next';

defineProps<{
  title: string;
  description?: string;
}>();
</script>
