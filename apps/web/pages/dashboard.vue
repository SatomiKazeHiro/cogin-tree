<template>
  <div>
    <DashboardHeader :username="auth.user?.username" />

    <DashboardLearningSection :trees="trees" :loading="loadingTrees" />

    <DashboardRecommendationSection
      v-if="auth.hasPortrait"
      :recommendations="recommendations"
      :starting-index="startingIndex"
      @start="createFromRecommendation"
    />

    <section v-else class="rounded-[16px] border border-linen-border bg-pure-white p-6">
      <h2 class="mb-2 font-anthropic-serif text-[24px] font-[330] text-ink-black">
        为你推荐
      </h2>
      <p class="mb-4 text-stone-gray">
        完成肖像问卷后，我们将基于你的兴趣与目标生成个性化推荐。
      </p>
      <NuxtLink
        to="/onboarding"
        class="inline-flex rounded-[9.6px] bg-charcoal px-4 py-2 text-[14px] text-pure-white hover:opacity-90"
      >
        去设置肖像
      </NuxtLink>
    </section>
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

interface Recommendation {
  title: string;
  description?: string;
}

const auth = useAuthStore();
const { api } = useApi();
const router = useRouter();

const trees = ref<SkillTree[]>([]);
const loadingTrees = ref(true);
const startingIndex = ref<number | null>(null);

const recommendations = ref<Recommendation[]>([
  { title: '前端工程化', description: '从构建工具到代码规范，系统掌握现代前端工程体系。' },
  { title: 'Vue 3 全栈开发', description: '结合 Nuxt 3 与后端接口，独立完成全栈应用。' },
  { title: 'TypeScript 进阶', description: '深入类型系统与设计模式，写出更安全的代码。' },
  { title: 'AI 应用开发', description: '学习如何集成大模型 API，构建智能应用。' },
  { title: '微服务架构', description: '理解服务拆分、通信与治理的核心概念。' },
  { title: 'DevOps 实践', description: 'CI/CD、容器化与监控，提升交付效率。' },
]);

onMounted(async () => {
  await auth.fetchUser();

  if (!auth.hasPortrait) {
    await router.replace('/onboarding');
    return;
  }

  await loadTrees();
});

async function loadTrees() {
  try {
    trees.value = await api<SkillTree[]>('/skill-trees');
  } finally {
    loadingTrees.value = false;
  }
}

async function createFromRecommendation(item: Recommendation, index: number) {
  startingIndex.value = index;
  try {
    const tree = await api<SkillTree>('/skill-trees', {
      method: 'POST',
      body: {
        name: item.title,
        description: item.description || '',
        type: 'ENTRY',
      },
    });
    await router.push(`/skills/${tree.id}/tree`);
  } finally {
    startingIndex.value = null;
  }
}
</script>
