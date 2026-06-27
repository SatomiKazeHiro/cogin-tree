export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_COOKIE = 'skill-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;

  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.setAttribute('data-theme', resolved);
}

export const useTheme = defineStore('theme', () => {
  const cookie = useCookie<ThemeMode>(THEME_COOKIE, {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
  });

  const mode = ref<ThemeMode>(cookie.value);

  const isDark = computed(() => {
    if (mode.value === 'dark') return true;
    if (mode.value === 'light') return false;
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  function setMode(next: ThemeMode) {
    mode.value = next;
    cookie.value = next;
    applyTheme(next);
  }

  function cycle() {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(mode.value) + 1) % order.length];
    setMode(next);
  }

  // 初始化：客户端与 SSR 后都需要应用一次
  onMounted(() => {
    applyTheme(mode.value);

    // 当模式为 system 时，监听系统变化
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', () => {
        if (mode.value === 'system') {
          applyTheme('system');
        }
      });
    }
  });

  // SSR 时直接应用，避免闪屏
  applyTheme(mode.value);

  return {
    mode,
    isDark,
    setMode,
    cycle,
  };
});
