<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="group flex items-center gap-1.5 rounded-lg px-1 text-[14px] text-muted transition-colors hover:bg-elevated hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      :title="`当前用户：${auth.user?.username ?? ''}`"
      aria-label="用户菜单"
      @click="open = !open"
    >
      <User class="h-4 w-4" />
      <span class="hidden max-w-[120px] truncate sm:inline">
        {{ auth.user?.username || '用户' }}
      </span>
      <ChevronDown class="h-3.5 w-3.5 text-muted transition-colors group-hover:text-ink" />
    </button>

    <Transition name="user-menu">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 w-44 rounded-[12px] border border-border bg-surface p-1 shadow-none"
      >
        <div class="px-2.5 py-2">
          <p class="truncate text-[13px] font-[500] text-ink">
            {{ auth.user?.username || '用户' }}
          </p>
          <p class="truncate text-[12px] text-muted">
            {{ auth.user?.email || '' }}
          </p>
        </div>

        <div class="my-1 h-px bg-border" />

        <NuxtLink
          to="/settings"
          class="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] text-secondary transition-colors hover:bg-elevated hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          @click="open = false"
        >
          <Settings class="h-3.5 w-3.5" />
          设置
        </NuxtLink>

        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] text-secondary transition-colors hover:bg-danger-bg hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          @click="handleLogout"
        >
          <LogOut class="h-3.5 w-3.5" />
          退出登录
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, LogOut, Settings, User } from 'lucide-vue-next';

const auth = useAuthStore();
const { confirm } = useConfirm();
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

async function handleLogout() {
  open.value = false;
  const confirmed = await confirm({
    title: '退出登录',
    message: '确定要退出当前账号吗？',
    confirmText: '退出',
    cancelText: '取消',
    confirmVariant: 'primary',
  });
  if (confirmed) {
    auth.logout();
  }
}

function handleClickOutside(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<style scoped>
.user-menu-enter-active,
.user-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.user-menu-enter-from,
.user-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
