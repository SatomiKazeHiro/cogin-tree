<template>
  <aside
    class="flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-300"
    :class="open ? 'w-[280px]' : 'w-[44px] items-center'"
  >
    <!-- Header / toggle -->
    <div
      class="flex shrink-0 items-center border-b border-border"
      :class="open ? 'h-14 justify-between px-4' : 'h-14 justify-center'"
    >
      <h2 v-if="open" class="truncate text-[14px] font-[500] text-ink">
        目录
      </h2>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-[9.6px] text-muted transition-colors hover:bg-elevated hover:text-ink"
        :title="open ? '收起目录' : '展开目录'"
        @click="emit('toggle')"
      >
        <PanelLeftClose v-if="open" class="h-4 w-4" />
        <PanelLeftOpen v-else class="h-4 w-4" />
      </button>
    </div>

    <!-- Tree -->
    <div v-if="open" class="flex-1 overflow-y-auto py-3">
      <div class="px-3 pb-2">
        <div class="flex items-center gap-2 rounded-[9.6px] px-2 py-1.5 text-[13px] font-[500] text-ink">
          <span class="flex h-5 w-5 items-center justify-center rounded-[5px] bg-ink text-[10px] text-surface">
            R
          </span>
          <span class="truncate">{{ rootName }}</span>
        </div>
      </div>

      <ul class="px-2">
        <li v-for="l1 in l1Nodes" :key="l1.id" class="mb-0.5">
          <button
            type="button"
            class="flex w-full items-center gap-1.5 rounded-[9.6px] px-2 py-1.5 text-[13px] transition-colors"
            :class="l1.id === selectedNodeId ? 'bg-accent/10 text-ink' : 'text-secondary hover:bg-elevated hover:text-ink'"
            @click="handleL1Click(l1.id)"
          >
            <span class="w-4 text-center text-muted">
              {{ expandedL1Ids.has(l1.id) ? '▼' : '▸' }}
            </span>
            <span class="truncate text-left">{{ l1.title }}</span>
            <LearningStatusDot
              v-if="learningStatusByNodeId[l1.id]"
              class="ml-auto"
              :status="learningStatusByNodeId[l1.id]"
            />
          </button>

          <ul v-if="expandedL1Ids.has(l1.id)" class="mt-0.5 space-y-0.5 pl-5">
            <li v-for="l2 in childrenByL1[l1.id] || []" :key="l2.id">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-[9.6px] px-2 py-1.5 text-[13px] transition-colors"
                :class="l2.id === selectedNodeId ? 'bg-accent/10 text-ink' : 'text-muted hover:bg-elevated hover:text-secondary'"
                @click="emit('selectL2', l2.id)"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-accent" />
                <span class="truncate text-left">{{ l2.title }}</span>
                <LearningStatusDot
                  v-if="learningStatusByNodeId[l2.id]"
                  class="ml-auto"
                  :status="learningStatusByNodeId[l2.id]"
                />
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';
import { NodeLearningStatus } from '@skill/shared';
import type { FlowTreeNode } from '../../composables/useTreeLayout';
import LearningStatusDot from './LearningStatusDot.vue';

const props = defineProps<{
  open: boolean;
  rootName: string;
  l1Nodes: FlowTreeNode[];
  childrenByL1: Record<string, FlowTreeNode[]>;
  learningStatusByNodeId: Record<string, NodeLearningStatus>;
  selectedNodeId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'selectL1', l1Id: string): void;
  (e: 'selectL2', l2Id: string): void;
}>();

const expandedL1Ids = ref<Set<string>>(new Set());

watch(
  () => props.l1Nodes,
  (nodes) => {
    expandedL1Ids.value = new Set(nodes.map((n) => n.id));
  },
  { immediate: true },
);

function handleL1Click(l1Id: string) {
  const next = new Set(expandedL1Ids.value);
  if (next.has(l1Id)) {
    next.delete(l1Id);
  } else {
    next.add(l1Id);
  }
  expandedL1Ids.value = next;
  emit('selectL1', l1Id);
}
</script>
