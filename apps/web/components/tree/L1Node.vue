<template>
  <div class="rounded-[16px] border border-linen-border bg-pure-white p-5">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <TreeNodeStatusBadge :level="1" />
        <div>
          <h3 class="font-anthropic-serif text-[20px] font-[330] text-ink-black">{{ node.title }}</h3>
          <p class="text-[14px] text-stone-gray">{{ node.description }}</p>
        </div>
      </div>
      <TreeExpandButton
        :expanded="expanded"
        :loading="loading"
        @click="$emit('toggle', node.id)"
      />
    </div>

    <div v-if="children.length" class="mt-4 space-y-3 pl-4">
      <TreeL2Node
        v-for="child in children"
        :key="child.id"
        :node="child"
        :content-visible="selectedL2Id === child.id"
        :loading="loadingL2Id === child.id"
        :content="contents[child.id] || { coreText: '' }"
        @toggle="$emit('toggle-l2', $event)"
      />
    </div>
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

defineProps<{
  node: Node;
  expanded: boolean;
  loading: boolean;
  children: Node[];
  selectedL2Id: string | null;
  loadingL2Id: string | null;
  contents: Record<string, Content>;
}>();

defineEmits<{
  (e: 'toggle', id: string): void;
  (e: 'toggle-l2', id: string): void;
}>();
</script>
