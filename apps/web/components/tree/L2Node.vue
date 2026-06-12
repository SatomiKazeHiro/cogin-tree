<template>
  <div class="rounded-[16px] border border-linen-border bg-pure-white p-4">
    <div class="mb-2 flex items-center gap-2">
      <TreeNodeStatusBadge :level="2" />
      <h4 class="font-anthropic-serif text-[16px] font-[330] text-ink-black">{{ node.title }}</h4>
    </div>
    <p class="mb-3 text-[14px] text-stone-gray">{{ node.description }}</p>
    <TreeExpandButton
      :expanded="contentVisible"
      :loading="loading"
      @click="$emit('toggle', node.id)"
    />

    <div v-if="contentVisible" class="mt-4">
      <TreeL3Content :content="content" />
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
  contentVisible: boolean;
  loading: boolean;
  content: Content;
}>();

defineEmits<{
  (e: 'toggle', id: string): void;
}>();
</script>
