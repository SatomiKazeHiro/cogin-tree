<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="flex items-center justify-center rounded-lg gap-1.5 px-1 text-muted transition-colors hover:bg-elevated hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      :title="`当前主题：${label}`"
      aria-label="切换颜色主题"
      @click="open = !open"
    >
      <Sun v-if="theme.mode === 'light'" class="h-4 w-4" />
      <Moon v-else-if="theme.mode === 'dark'" class="h-4 w-4" />
      <Monitor v-else class="h-4 w-4" />
      {{ label }}
    </button>

    <Transition name="theme-menu">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 w-36 rounded-[12px] border border-border bg-surface p-1 shadow-none"
      >
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          :class="theme.mode === option.value ? 'bg-elevated text-ink' : 'text-muted hover:bg-elevated hover:text-ink'"
          @click="select(option.value)"
        >
          <component :is="option.icon" class="h-3.5 w-3.5" />
          {{ option.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next';
import type { ThemeMode } from '../composables/useTheme';

const theme = useTheme();
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const options = [
  { value: 'light' as ThemeMode, label: '白天', icon: Sun },
  { value: 'dark' as ThemeMode, label: '黑夜', icon: Moon },
  { value: 'system' as ThemeMode, label: '系统', icon: Monitor },
];

const label = computed(() => options.find((o) => o.value === theme.mode)?.label ?? '系统');

function select(value: ThemeMode) {
  theme.setMode(value);
  open.value = false;
}

// 点击外部关闭
function handleClickOutside(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.theme-menu-enter-active,
.theme-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.theme-menu-enter-from,
.theme-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
