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
  <div class="min-h-screen flex flex-col items-center justify-center px-6">
    <div class="max-w-[560px] w-full text-center">
      <h1 class="text-display leading-display font-anthropic-serif font-[330] mb-6">
        技能树学习系统
      </h1>
      <p class="text-stone-gray mb-10">
        AI 驱动的个性化学习路径，从入门到精进的每一步都清晰可见。
      </p>
      <NuxtLink
        to="/login"
        class="inline-flex items-center justify-center bg-charcoal text-pure-white font-anthropic-sans font-[430] text-[15px] px-5 py-2 rounded-[9.6px] hover:opacity-90 transition-opacity"
      >
        开始使用
      </NuxtLink>
    </div>
  </div>
</template>
