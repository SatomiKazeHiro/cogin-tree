<template>
  <div class="relative flex h-full w-full overflow-hidden bg-canvas">
    <!-- Directory panel -->
    <TreeDirectoryPanel
      class="absolute left-0 top-0 z-20"
      :open="directoryOpen"
      :l1-nodes="l1Nodes"
      :children-by-l1="childrenByL1"
      :learning-status-by-node-id="learningStatusByNodeId"
      :selected-node-id="selectedNodeId"
      @toggle="directoryOpen = !directoryOpen"
      @select-l1="(id) => onSelectL1(id, vueFlowGraphRef?.fitViewToNode ?? noop)"
      @select-l2="(id) => onSelectL2(id, vueFlowGraphRef?.fitViewToNode ?? noop)"
    />

    <!-- Canvas -->
    <div class="relative h-full flex-1 overflow-hidden">
      <!-- 右上角操作：面试模式（仅面试树）/ AI 分析 -->
      <div class="absolute right-4 top-4 z-20 flex gap-2">
        <button
          v-if="tree?.type === 'INTERVIEW'"
          type="button"
          class="rounded-[9.6px] border border-border bg-surface px-4 py-2 text-[14px] text-ink transition-colors hover:border-strong hover:bg-elevated"
          @click="router.push(`/skills/${route.params.id}/interview`)"
        >
          面试模式
        </button>
        <button
          type="button"
          class="rounded-[9.6px] border border-border bg-surface px-4 py-2 text-[14px] text-ink transition-colors hover:border-strong hover:bg-elevated"
          @click="analysisOpen = true"
        >
          AI 分析
        </button>
      </div>

      <ClientOnly>
        <TreeVueFlowGraph
          ref="vueFlowGraphRef"
          :nodes="flowNodes"
          :edges="flowEdges"
          :highlighted-node-id="selectedNodeId"
          @action="onNodeAction"
          @toggle-collapse="toggleCollapse"
          @select-node="onCanvasNodeClick"
          @clear-selection="onCanvasPaneClick"
        />
        <template #fallback>
          <div class="flex h-full items-center justify-center text-muted">
            加载图形中…
          </div>
        </template>
      </ClientOnly>

      <!-- Detail drawer -->
      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-200 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="showPanel"
          class="absolute right-0 top-0 z-30 h-full w-[50vw] min-w-[560px] max-w-[720px] border-l border-border bg-surface shadow-none"
        >
          <TreeL2ContentPanel
            :title="selectedL2Title"
            :artifacts="selectedArtifacts"
            :node-id="selectedL2Id"
            :learning-status="selectedL2Id ? learningStatusByNodeId[selectedL2Id] : undefined"
            @close="selectedL2Id = null"
            @status-change="handleStatusChange"
            @retry-artifact="retryArtifact"
            @request-exercises="generateExercises"
          />
        </div>
      </Transition>
      <!-- Analysis panel -->
      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-200 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="analysisOpen && tree"
          class="absolute right-0 top-0 z-40 h-full w-[50vw] min-w-[560px] max-w-[720px] border-l border-border bg-surface"
        >
          <AnalysisPanel
            :tree-id="tree.id"
            :l1-nodes="l1Nodes"
            @close="analysisOpen = false"
            @applied="loadTreeData()"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
  layout: 'fullscreen',
});

const route = useRoute();
const router = useRouter();
const pageHeader = usePageHeader();
const vueFlowGraphRef = ref<{ fitViewToNode: (nodeId: string) => void }>();
const analysisOpen = ref(false);

const {
  tree,
  flowNodes,
  flowEdges,
  directoryOpen,
  selectedL2Id,
  loadingNodeId,
  showPanel,
  l1Nodes,
  childrenByL1,
  learningStatusByNodeId,
  selectedNodeId,
  selectedL2Title,
  selectedArtifacts,
  loadTreeData,
  onNodeAction,
  toggleCollapse,
  onSelectL1,
  onSelectL2,
  onCanvasNodeClick,
  onCanvasPaneClick,
  handleStatusChange,
  ensureCoreText,
  generateExercises,
  retryArtifact,
} = useSkillTreePage(route.params.id as string);

function noop() {}

onMounted(async () => {
  try {
    await loadTreeData();
  } catch (err) {
    console.error('[TreePage] load failed', err);
  }
});

watch(
  () => tree.value?.name,
  (name) => {
    if (name) {
      pageHeader.value = { title: name, backTo: '/dashboard' };
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  pageHeader.value = {};
});
</script>
