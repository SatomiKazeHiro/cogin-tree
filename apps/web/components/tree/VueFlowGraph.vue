<template>
  <VueFlow
    ref="vueFlow"
    v-model:nodes="localNodes"
    v-model:edges="localEdges"
    :default-viewport="{ zoom: 1 }"
    :min-zoom="0.6"
    :max-zoom="1.5"
    :default-edge-options="{ type: 'smoothstep', animated: false, style: { strokeDasharray: '6 4' } }"
    fit-view-on-init
    :fit-view-options="{ padding: 0.15, minZoom: 0.6, maxZoom: 1 }"
    class="vue-flow-skill-tree"
    @node-click="onNodeClick"
    @pane-click="onPaneClick"
  >
    <template #node-flowNode="nodeProps">
      <FlowNode
        :id="nodeProps.id"
        :data="nodeProps.data"
        :highlighted="nodeProps.id === highlightedNodeId"
        @action="(...args) => emit('action', ...args)"
        @toggle-collapse="(...args) => emit('toggleCollapse', ...args)"
        @focus="(id) => emit('selectNode', id)"
      />
    </template>

    <Background :pattern-color="backgroundPatternColor" :gap="16" />
    <Controls />
    <MiniMap
      class="rounded-[12px] border border-border bg-surface/90 shadow-none"
      :node-color="miniMapNodeColor"
      :node-stroke-color="miniMapNodeStroke"
      :mask-color="miniMapMaskColor"
      pannable
      zoomable
    />
  </VueFlow>
</template>

<script setup lang="ts">
import { VueFlow } from '@vue-flow/core';
import type { GraphNode, NodeMouseEvent } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/minimap/dist/style.css';
import FlowNode from './FlowNode.vue';
import type { FlowNode as FlowNodeType, FlowEdge, FlowNodeData } from '../../composables/useTreeLayout';

const props = defineProps<{
  nodes: FlowNodeType[];
  edges: FlowEdge[];
  highlightedNodeId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'action', nodeId: string, action: 'expand' | 'generate' | 'open'): void;
  (e: 'toggleCollapse', nodeId: string): void;
  /** 画布上点击节点 → 回写页面聚焦状态（与点左侧目录等价） */
  (e: 'selectNode', nodeId: string): void;
  /** 点击画布空白 → 清掉聚焦（抽屉仍开着时由页面状态回落到该节点） */
  (e: 'clearSelection'): void;
}>();

const vueFlow = ref<InstanceType<typeof VueFlow>>();

function onNodeClick(payload: NodeMouseEvent) {
  if (payload?.node?.id) emit('selectNode', payload.node.id);
}

function onPaneClick() {
  emit('clearSelection');
}

const localNodes = computed<FlowNodeType[]>({
  get: () => props.nodes,
  set: () => {},
});

const localEdges = computed<FlowEdge[]>({
  get: () => props.edges,
  set: () => {},
});

const backgroundPatternColor = computed(() => {
  // 使用 CSS 变量让背景网格随主题变化
  return 'var(--border-strong)';
});

function miniMapNodeColor(node: GraphNode<FlowNodeData, any, any>) {
  if (node.data?.type === 'root') return 'var(--text-primary)';
  if (node.data?.type === 'l1') return 'var(--text-secondary)';
  return 'var(--accent)';
}

function miniMapNodeStroke(_node: GraphNode<FlowNodeData, any, any>) {
  return 'var(--border-strong)';
}

const miniMapMaskColor = 'rgba(0, 0, 0, 0.05)';

function fitViewToNode(nodeId: string) {
  vueFlow.value?.fitView({ nodes: [nodeId], padding: 0.3, duration: 300 });
}

defineExpose({ fitViewToNode });
</script>

<style scoped>
.vue-flow-skill-tree {
  --vf-node-color: var(--text-primary);
  --vf-handle: var(--border-default);
  --vf-connectionline: var(--border-default);
  --vf-edge-color: var(--border-default);
  --vf-edge-stroke: var(--border-default);
  background: transparent;
}

.vue-flow-skill-tree :deep(.vue-flow__node) {
  border: none;
  background: transparent;
  padding: 0;
}

.vue-flow-skill-tree :deep(.vue-flow__node.selected) {
  box-shadow: none;
}

.vue-flow-skill-tree :deep(.vue-flow__edge-path) {
  stroke: var(--border-default);
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
}

.vue-flow-skill-tree :deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background: var(--border-default);
  border: none;
}
</style>
