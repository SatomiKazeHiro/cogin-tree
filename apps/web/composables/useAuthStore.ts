export const useAuthStore = defineStore('auth', () => {
  const token = useCookie('skill-token', { maxAge: 60 * 60 * 24 * 7 });
  const user = ref<{
    id: string;
    username: string;
    email: string;
    role: string;
    avatar?: string;
    portrait?: Record<string, unknown> | null;
  } | null>(null);

  const isAuthenticated = computed(() => !!token.value);
  const hasPortrait = computed(() => !!user.value?.portrait);

  async function login(email: string, password: string) {
    const { api } = useApi();
    const data = await api<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    token.value = data.accessToken;
    await nextTick();
    await fetchUser();
  }

  async function register(username: string, email: string, password: string) {
    const { api } = useApi();
    const data = await api<{ accessToken: string }>('/auth/register', {
      method: 'POST',
      body: { username, email, password },
    });
    token.value = data.accessToken;
    await nextTick();
    await fetchUser();
  }

  async function fetchUser() {
    if (!token.value) {
      user.value = null;
      return;
    }
    const { api } = useApi();
    try {
      user.value = await api('/users/me');
    } catch {
      user.value = null;
      token.value = null;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    navigateTo('/login');
  }

  return {
    token,
    user,
    isAuthenticated,
    hasPortrait,
    login,
    register,
    fetchUser,
    logout,
  };
});
