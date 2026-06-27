<template>
  <nav class="sticky top-0 z-50 border-b border-border bg-canvas/90 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
      <NuxtLink :to="auth.isAuthenticated ? '/dashboard' : '/'" class="font-anthropic-serif text-[18px] font-[330] text-ink">
        技能树学习
      </NuxtLink>

      <div v-if="auth.isAuthenticated" class="flex items-center gap-2">
        <NuxtLink to="/dashboard" class="px-1 text-[14px] text-muted transition-colors hover:text-ink">
          仪表盘
        </NuxtLink>
        <NuxtLink to="/settings" class="px-1 text-[14px] text-muted transition-colors hover:text-ink">
          设置
        </NuxtLink>

        <ThemeToggle />

        <UserMenu />
      </div>

      <div v-else class="flex items-center gap-4">
        <NuxtLink to="/login" class="text-[14px] text-muted transition-colors hover:text-ink">
          登录
        </NuxtLink>
        <NuxtLink
          to="/register"
          class="rounded-[9.6px] bg-secondary px-4 py-1.5 text-[14px] text-surface transition-colors hover:bg-ink"
        >
          注册
        </NuxtLink>
        <ThemeToggle />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
const auth = useAuthStore();
</script>
