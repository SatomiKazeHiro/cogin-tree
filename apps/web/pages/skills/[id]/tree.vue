<template>
  <div v-if="loading" class="py-20 text-center text-stone-gray">
    加载中…
  </div>

  <div v-else-if="tree">
    <div class="mb-6">
      <NuxtLink to="/dashboard" class="text-[14px] text-stone-gray hover:text-ink-black">← 返回仪表盘</NuxtLink>
      <h1 class="mt-2 font-anthropic-serif text-[30px] font-[330] leading-[1.33] text-ink-black">
        {{ tree.name }}
      </h1>
      <p v-if="tree.description" class="mt-1 text-stone-gray">{{ tree.description }}</p>
    </div>

    <TreeSkillTree
      :nodes="tree.nodes || []"
      :expanded-l1-id="expandedL1Id"
      :loading-l1-id="loadingL1Id"
      :children-by-l1="childrenByL1"
      :selected-l2-id="selectedL2Id"
      :loading-l2-id="loadingL2Id"
      :contents="contents"
      @toggle-l1="handleToggleL1"
      @toggle-l2="handleToggleL2"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
});

interface TreeNode {
  id: string;
  title: string;
  description?: string;
  level: number;
}

interface SkillTree {
  id: string;
  name: string;
  description?: string;
  nodes: TreeNode[];
}

interface Content {
  coreText: string;
  codeExamples?: {
    title: string;
    language: string;
    code: string;
  }[];
  exercises?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

const route = useRoute();
const { api } = useApi();

const tree = ref<SkillTree | null>(null);
const loading = ref(true);
const expandedL1Id = ref<string | null>(null);
const loadingL1Id = ref<string | null>(null);
const childrenByL1 = ref<Record<string, TreeNode[]>>({});
const selectedL2Id = ref<string | null>(null);
const loadingL2Id = ref<string | null>(null);
const contents = ref<Record<string, Content>>({});

onMounted(async () => {
  try {
    tree.value = await api<SkillTree>(`/skill-trees/${route.params.id}`);
  } finally {
    loading.value = false;
  }
});

async function handleToggleL1(id: string) {
  if (expandedL1Id.value === id) {
    expandedL1Id.value = null;
    return;
  }

  expandedL1Id.value = id;

  if (!childrenByL1.value[id]) {
    loadingL1Id.value = id;
    try {
      const children = await api<TreeNode[]>(`/nodes/${id}/expand`, {
        method: 'POST',
      });
      childrenByL1.value = { ...childrenByL1.value, [id]: children };
    } finally {
      loadingL1Id.value = null;
    }
  }
}

async function handleToggleL2(id: string) {
  if (selectedL2Id.value === id) {
    selectedL2Id.value = null;
    return;
  }

  selectedL2Id.value = id;

  if (!contents.value[id]) {
    loadingL2Id.value = id;
    try {
      const content = await api<Content>(`/nodes/${id}/content`, {
        method: 'POST',
      });
      contents.value = { ...contents.value, [id]: content };
    } finally {
      loadingL2Id.value = null;
    }
  }
}
</script>
