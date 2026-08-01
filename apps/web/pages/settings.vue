<template>
  <div class="mx-auto max-w-[600px]">
    <div class="mb-6 flex items-center gap-3">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-ink"
        @click="$router.back()"
      >
        <ArrowLeft class="h-4 w-4" />
        返回
      </button>
    </div>

    <h1 class="mb-6 font-anthropic-serif text-[30px] font-[330] leading-[1.33] text-ink">
      设置
    </h1>

    <AppCard>
      <h2 class="mb-2 font-anthropic-serif text-[20px] font-[330] text-ink">
        用户肖像
      </h2>
      <p class="mb-4 text-[14px] text-muted">
        重新填写问卷，更新你的学习偏好与目标。
      </p>
      <NuxtLink
        to="/onboarding"
        class="inline-flex rounded-[9.6px] border border-border bg-surface px-4 py-2 text-[14px] text-ink transition-colors hover:bg-elevated"
      >
        重新设置肖像
      </NuxtLink>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

definePageMeta({
  middleware: ['auth'],
});
</script>
