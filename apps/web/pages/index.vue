<script setup lang="ts">
const auth = useAuthStore();
const router = useRouter();

onMounted(() => {
  if (auth.isAuthenticated) {
    router.replace('/dashboard');
  }
});
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-6">
    <div class="w-full max-w-[560px] text-center">
      <h1 class="mb-6 font-anthropic-serif text-display font-[330] leading-display text-ink">
        技能树学习系统
      </h1>
      <p class="mb-10 text-muted">
        AI 驱动的个性化学习路径，从入门到精进的每一步都清晰可见。
      </p>
      <NuxtLink
        to="/login"
        class="inline-flex items-center justify-center rounded-[9.6px] bg-secondary px-5 py-2 font-anthropic-sans text-[15px] font-[430] text-surface transition-colors hover:bg-ink"
      >
        开始使用
      </NuxtLink>
    </div>
  </div>
</template>
