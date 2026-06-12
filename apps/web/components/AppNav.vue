<template>
  <nav class="sticky top-0 z-50 border-b border-linen-border bg-ivory-canvas/90 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
      <NuxtLink :to="auth.isAuthenticated ? '/dashboard' : '/'" class="font-anthropic-serif text-[18px] font-[330] text-ink-black">
        技能树学习
      </NuxtLink>

      <div v-if="auth.isAuthenticated" class="flex items-center gap-4">
        <NuxtLink to="/dashboard" class="text-[14px] text-stone-gray hover:text-ink-black">
          仪表盘
        </NuxtLink>
        <NuxtLink to="/settings" class="text-[14px] text-stone-gray hover:text-ink-black">
          设置
        </NuxtLink>
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-dust-blue text-[13px] font-[500] text-ink-black">
            {{ initials }}
          </div>
          <button
            class="flex items-center gap-1 text-[14px] text-stone-gray hover:text-ink-black"
            @click="auth.logout"
          >
            <LogOut class="h-4 w-4" />
            退出
          </button>
        </div>
      </div>

      <div v-else class="flex items-center gap-4">
        <NuxtLink to="/login" class="text-[14px] text-stone-gray hover:text-ink-black">
          登录
        </NuxtLink>
        <NuxtLink
          to="/register"
          class="rounded-[9.6px] bg-charcoal px-4 py-1.5 text-[14px] text-pure-white hover:opacity-90"
        >
          注册
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { LogOut } from 'lucide-vue-next';

const auth = useAuthStore();

const initials = computed(() => {
  const name = auth.user?.username || '';
  return name.slice(0, 2).toUpperCase() || 'U';
});
</script>
