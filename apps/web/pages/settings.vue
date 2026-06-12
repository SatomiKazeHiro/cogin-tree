<template>
  <div class="mx-auto max-w-[600px]">
    <div class="mb-6 flex items-center gap-3">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[14px] text-stone-gray hover:text-ink-black"
        @click="$router.back()"
      >
        <ArrowLeft class="h-4 w-4" />
        返回
      </button>
    </div>

    <DashboardHeader username="AI 设置" />

    <AppCard>
      <form class="space-y-5" @submit.prevent="save">
        <div>
          <label class="mb-2 block text-[13px] font-[500] text-charcoal">Provider</label>
          <select
            v-model="config.provider"
            class="w-full rounded-[9.6px] border border-linen-border bg-pure-white px-4 py-2.5 text-[15px] text-ink-black focus:border-charcoal focus:outline-none"
          >
            <option value="MOCK">Mock（开发测试）</option>
            <option value="DEEPSEEK">DeepSeek</option>
          </select>
        </div>

        <AppInput
          v-model="config.model"
          label="模型"
          placeholder="例如 deepseek-chat"
        />

        <AppInput
          v-model="config.apiKey"
          label="API Key"
          type="password"
          placeholder="留空则使用环境变量"
        />

        <AppInput
          v-model="config.baseUrl"
          label="Base URL"
          placeholder="例如 https://api.deepseek.com"
        />

        <p v-if="message" class="text-[14px]" :class="error ? 'text-red-600' : 'text-stone-gray'">
          {{ message }}
        </p>

        <AppButton type="submit" :loading="saving" class="w-full">
          保存设置
        </AppButton>
      </form>
    </AppCard>

    <AppCard class="mt-6">
      <h2 class="mb-2 font-anthropic-serif text-[20px] font-[330] text-ink-black">
        用户肖像
      </h2>
      <p class="mb-4 text-[14px] text-stone-gray">
        重新填写问卷，更新你的学习偏好与目标。
      </p>
      <NuxtLink
        to="/onboarding"
        class="inline-flex rounded-[9.6px] border border-linen-border px-4 py-2 text-[14px] text-ink-black hover:bg-ivory-canvas"
      >
        重新设置肖像
      </NuxtLink>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

definePageMeta({
  middleware: ['auth'],
});

interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

const { api } = useApi();

const config = ref<AIConfig>({
  provider: 'MOCK',
  model: 'deepseek-chat',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
});
const saving = ref(false);
const message = ref('');
const error = ref(false);

onMounted(async () => {
  try {
    const data = await api<Partial<AIConfig>>('/config/ai');
    config.value = { ...config.value, ...data };
  } catch {
    // ignore
  }
});

async function save() {
  saving.value = true;
  message.value = '';
  error.value = false;
  try {
    await api('/config/ai', {
      method: 'PUT',
      body: config.value,
    });
    message.value = '设置已保存';
  } catch (err: unknown) {
    error.value = true;
    message.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    saving.value = false;
  }
}
</script>
