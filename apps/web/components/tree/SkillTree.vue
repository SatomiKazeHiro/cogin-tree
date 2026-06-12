<template>
  <div class="space-y-6">
    <TreeL1Node
      v-for="node in l1Nodes"
      :key="node.id"
      :node="node"
      :expanded="expandedL1Id === node.id"
      :loading="loadingL1Id === node.id"
      :children="childrenByL1[node.id] || []"
      :selected-l2-id="selectedL2Id"
      :loading-l2-id="loadingL2Id"
      :contents="contents"
      @toggle="toggleL1"
      @toggle-l2="toggleL2"
    />
  </div>
</template>

<script setup lang="ts">
interface Node {
  id: string;
  title: string;
  description?: string;
  level: number;
}

interface Content {
  coreText: string;
  exercises?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

const props = defineProps<{
  nodes: Node[];
  expandedL1Id: string | null;
  loadingL1Id: string | null;
  childrenByL1: Record<string, Node[]>;
  selectedL2Id: string | null;
  loadingL2Id: string | null;
  contents: Record<string, Content>;
}>();

const emit = defineEmits<{
  (e: 'toggle-l1', id: string): void;
  (e: 'toggle-l2', id: string): void;
}>();

const l1Nodes = computed(() => props.nodes.filter((n) => n.level === 1));

function toggleL1(id: string) {
  emit('toggle-l1', id);
}

function toggleL2(id: string) {
  emit('toggle-l2', id);
}
</script>
