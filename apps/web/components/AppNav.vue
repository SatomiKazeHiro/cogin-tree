<template>
  <nav class="sticky top-0 z-50 border-b border-border bg-canvas/90 backdrop-blur">
    <div
      class="relative mx-auto flex h-14 items-center justify-between px-6"
      :class="isFullWidth ? 'max-w-none' : 'max-w-[1200px]'"
    >
      <NuxtLink
        v-if="!pageHeader.backTo"
        :to="auth.isAuthenticated ? '/dashboard' : '/'"
        class="font-anthropic-serif text-[18px] font-[330] text-ink"
      >
        技能树学习
      </NuxtLink>
      <NuxtLink
        v-else
        :to="pageHeader.backTo"
        class="flex items-center gap-1.5 rounded-[9.6px] px-2 py-1.5 text-[14px] text-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <ArrowLeft class="h-4 w-4" />
        返回
      </NuxtLink>

      <h1
        v-if="pageHeader.title"
        class="pointer-events-none absolute left-1/2 top-1/2 max-w-[50%] -translate-x-1/2 -translate-y-1/2 truncate text-center font-anthropic-serif text-[18px] font-[330] text-ink"
      >
        {{ pageHeader.title }}
      </h1>

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
import { ArrowLeft } from 'lucide-vue-next';

const auth = useAuthStore();
const route = useRoute();
const pageHeader = usePageHeader();

const isFullWidth = computed(() =>
  route.meta.layout === 'fullscreen' || route.path.startsWith('/skills/'),
);
</script>
