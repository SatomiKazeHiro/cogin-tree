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
      <ClientOnly>
        <TreeVueFlowGraph
          ref="vueFlowGraphRef"
          :nodes="flowNodes"
          :edges="flowEdges"
          :highlighted-node-id="selectedNodeId"
          @action="onNodeAction"
          @toggle-collapse="toggleCollapse"
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
            :content="selectedL2Content || { coreText: '' }"
            :loading="loadingNodeId === selectedL2Id"
            :node-id="selectedL2Id"
            :learning-status="selectedL2Id ? learningStatusByNodeId[selectedL2Id] : undefined"
            @close="selectedL2Id = null"
            @status-change="handleStatusChange"
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
const pageHeader = usePageHeader();
const vueFlowGraphRef = ref<{ fitViewToNode: (nodeId: string) => void }>();

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
  selectedL2Content,
  loadTreeData,
  onNodeAction,
  toggleCollapse,
  onSelectL1,
  onSelectL2,
  handleStatusChange,
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
