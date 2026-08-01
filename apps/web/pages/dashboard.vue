<template>
  <div>
    <DashboardHeader :username="auth.user?.username" />

    <DashboardLearningSection
      :records="records"
      :loading="loadingTrees"
      @create="openCreateWizard"
      @delete="deleteTree"
    />

    <DashboardCurrentLearningSection
      :items="currentLearning"
      :loading="loadingCurrentLearning"
    />

    <DashboardRecommendationSection
      :recommendations="recommendations"
      :loading="loadingRecommendations"
      @start="openRecommendationWizard"
    />

    <DashboardSkillTreeWizard
      v-if="wizardState.show"
      :mode="wizardState.mode"
      :initial-name="wizardState.initialName"
      :initial-description="wizardState.initialDescription"
      :initial-type="wizardState.initialType"
      :initial-keywords="wizardState.initialKeywords"
      :recommendation-id="wizardState.recommendationId"
      @success="handleWizardSuccess"
      @cancel="closeWizard"
    />

    <p v-if="submitError" class="mt-4 text-[14px] text-danger">{{ submitError }}</p>
  </div>
</template>

<script setup lang="ts">
import type { SkillTree, DashboardResponse, CurrentLearningItem, Recommendation } from '@skill/shared';

definePageMeta({
  middleware: ['auth'],
});

const auth = useAuthStore();
const { api } = useApi();
const router = useRouter();
const toast = useToast();
const { confirm } = useConfirm();

interface LearningRecordItem {
  skillTree: SkillTree;
  progress: number;
}

const records = ref<LearningRecordItem[]>([]);
const loadingTrees = ref(true);
const currentLearning = ref<CurrentLearningItem[]>([]);
const loadingCurrentLearning = ref(true);
const recommendations = ref<Recommendation[]>([]);
const loadingRecommendations = ref(true);
const submitError = ref('');

const wizardState = ref<{
  show: boolean;
  mode: 'create' | 'recommendation';
  initialName?: string;
  initialDescription?: string;
  initialType?: string;
  initialKeywords?: string;
  recommendationId?: string;
}>({
  show: false,
  mode: 'create',
});

onMounted(async () => {
  await auth.fetchUser();

  if (!auth.hasPortrait) {
    await router.replace('/onboarding');
    return;
  }

  // Load dashboard and recommendations independently so slow AI generation
  // does not block the skill trees section.
  loadDashboard();
  loadRecommendations();
});

async function loadDashboard() {
  try {
    const data = await api<DashboardResponse>('/dashboard');
    records.value = data.learningRecords
      .map((r) => ({ skillTree: r.skillTree, progress: r.progress }))
      .filter((r): r is LearningRecordItem => !!r.skillTree);
    currentLearning.value = data.currentLearning || [];
  } finally {
    loadingTrees.value = false;
    loadingCurrentLearning.value = false;
  }
}

async function loadRecommendations() {
  try {
    recommendations.value = await api<Recommendation[]>('/recommendations');
  } finally {
    loadingRecommendations.value = false;
  }
}

function openCreateWizard() {
  wizardState.value = {
    show: true,
    mode: 'create',
  };
  submitError.value = '';
}

function openRecommendationWizard(item: Recommendation) {
  wizardState.value = {
    show: true,
    mode: 'recommendation',
    initialName: item.title,
    initialDescription: item.description,
    initialType: item.suggestedMode || 'ENTRY',
    initialKeywords: (item.keywords || []).join('，'),
    recommendationId: item.id,
  };
  submitError.value = '';
}

function closeWizard() {
  wizardState.value.show = false;
}

async function handleWizardSuccess(tree: SkillTree) {
  wizardState.value.show = false;
  await router.push(`/skills/${tree.id}/tree`);
}

async function deleteTree(id: string) {
  const tree = records.value.find((r) => r.skillTree.id === id)?.skillTree;
  const confirmed = await confirm({
    title: '删除技能树',
    message: `确定要删除「${tree?.name ?? '该技能树'}」吗？\n相关的学习记录和生成的内容都会被清除，此操作不可恢复。`,
    confirmText: '删除',
    cancelText: '取消',
    confirmVariant: 'danger',
  });
  if (!confirmed) return;

  submitError.value = '';
  try {
    await api(`/skill-trees/${id}`, { method: 'DELETE' });
    records.value = records.value.filter((r) => r.skillTree.id !== id);
    toast.success('技能树已删除');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '删除失败';
    submitError.value = message;
    toast.error(message);
  }
}
</script>
