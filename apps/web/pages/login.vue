<template>
  <div class="flex min-h-[calc(100vh-112px)] items-center justify-center px-6">
    <AppCard class="w-full max-w-[420px]">
      <div class="mb-8 text-center">
        <h1 class="mb-2 font-anthropic-serif text-[30px] font-[330] leading-[1.33] text-ink-black">
          欢迎回来
        </h1>
        <p class="text-[15px] text-stone-gray">
          登录后继续你的学习旅程
        </p>
      </div>

      <form class="space-y-5" @submit.prevent="handleLogin">
        <AppInput
          v-model="email"
          label="邮箱"
          type="email"
          placeholder="your@email.com"
          :error="errors.email"
        />

        <AppInput
          v-model="password"
          label="密码"
          type="password"
          placeholder="输入密码"
          :error="errors.password"
        />

        <p v-if="submitError" class="text-[14px] text-red-600">{{ submitError }}</p>

        <AppButton type="submit" :loading="loading" class="w-full">
          登录
        </AppButton>
      </form>

      <p class="mt-6 text-center text-[14px] text-stone-gray">
        还没有账号？
        <NuxtLink to="/register" class="text-ink-black underline underline-offset-4 hover:text-charcoal">
          立即注册
        </NuxtLink>
      </p>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
});

const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errors = ref({ email: '', password: '' });
const submitError = ref('');

async function handleLogin() {
  errors.value = { email: '', password: '' };
  submitError.value = '';

  if (!email.value) errors.value.email = '请输入邮箱';
  if (!password.value) errors.value.password = '请输入密码';
  if (errors.value.email || errors.value.password) return;

  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    await router.push(auth.hasPortrait ? '/dashboard' : '/onboarding');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '登录失败';
    submitError.value = message;
  } finally {
    loading.value = false;
  }
}
</script>
