<template>
  <div class="mx-auto max-w-[560px]">
    <div class="mb-8 text-center">
      <h1 class="font-anthropic-serif text-[30px] font-[330] leading-[1.33] text-ink-black">
        创建技能树
      </h1>
      <p class="mt-1 text-stone-gray">输入一个学习方向，AI 将生成 L1 大纲。</p>
    </div>

    <AppCard>
      <form class="space-y-5" @submit.prevent="create">
        <AppInput
          v-model="name"
          label="方向名称"
          placeholder="例如：前端工程化"
          :error="errors.name"
        />

        <div>
          <label class="mb-2 block text-[13px] font-[500] text-charcoal">类型</label>
          <select
            v-model="type"
            class="w-full rounded-[9.6px] border border-linen-border bg-pure-white px-4 py-2.5 text-[15px] text-ink-black focus:border-charcoal focus:outline-none"
          >
            <option value="ENTRY">入门树</option>
            <option value="EXPERT">进阶树</option>
          </select>
        </div>

        <AppInput
          v-model="description"
          label="描述（可选）"
          placeholder="简单描述你的学习目标"
        />

        <p v-if="submitError" class="text-[14px] text-red-600">{{ submitError }}</p>

        <AppButton type="submit" :loading="loading" class="w-full">
          创建并学习
        </AppButton>
      </form>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
});

interface SkillTree {
  id: string;
  name: string;
  description?: string;
  type: string;
}

const { api } = useApi();
const router = useRouter();

const name = ref('');
const type = ref('ENTRY');
const description = ref('');
const loading = ref(false);
const errors = ref({ name: '' });
const submitError = ref('');

async function create() {
  errors.value = { name: '' };
  submitError.value = '';

  if (!name.value.trim()) errors.value.name = '请输入方向名称';
  if (errors.value.name) return;

  loading.value = true;
  try {
    const tree = await api<SkillTree>('/skill-trees', {
      method: 'POST',
      body: {
        name: name.value,
        type: type.value,
        description: description.value,
      },
    });
    await router.push(`/skills/${tree.id}/tree`);
  } catch (err: unknown) {
    submitError.value = err instanceof Error ? err.message : '创建失败';
  } finally {
    loading.value = false;
  }
}
</script>
