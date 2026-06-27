<template>
  <div class="flex min-h-[calc(100vh-112px)] items-center justify-center px-6">
    <AppCard class="w-full max-w-[420px]">
      <div class="mb-8 text-center">
        <h1 class="mb-2 font-anthropic-serif text-[30px] font-[330] leading-[1.33] text-ink">
          创建账号
        </h1>
        <p class="text-[15px] text-muted">
          注册后即可开始构建你的技能树
        </p>
      </div>

      <form class="space-y-5" @submit.prevent="handleRegister">
        <AppInput
          v-model="username"
          label="用户名"
          placeholder="起一个名字"
          :error="errors.username"
        />

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
          placeholder="至少 6 位字符"
          :error="errors.password"
        />

        <p v-if="submitError" class="text-[14px] text-danger">{{ submitError }}</p>

        <AppButton type="submit" :loading="loading" class="w-full">
          注册
        </AppButton>
      </form>

      <p class="mt-6 text-center text-[14px] text-muted">
        已有账号？
        <NuxtLink to="/login" class="text-ink underline underline-offset-4 hover:text-secondary">
          直接登录
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

const username = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const errors = ref({ username: '', email: '', password: '' });
const submitError = ref('');

async function handleRegister() {
  errors.value = { username: '', email: '', password: '' };
  submitError.value = '';

  if (!username.value) errors.value.username = '请输入用户名';
  if (!email.value) errors.value.email = '请输入邮箱';
  if (!password.value || password.value.length < 6) errors.value.password = '密码至少 6 位';
  if (errors.value.username || errors.value.email || errors.value.password) return;

  loading.value = true;
  try {
    await auth.register(username.value, email.value, password.value);
    await router.push(auth.hasPortrait ? '/dashboard' : '/onboarding');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '注册失败';
    submitError.value = message;
  } finally {
    loading.value = false;
  }
}
</script>
