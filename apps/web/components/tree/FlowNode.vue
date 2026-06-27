<template>
  <div
    class="group relative flex h-[190px] w-[340px] overflow-hidden rounded-[16px] border bg-surface transition-all duration-300"
    :class="[borderColorClass, statusOpacityClass, { 'outline outline-2 outline-dashed outline-ink outline-offset-[3px]': isOutlined }]"
  >
    <Handle
      v-if="data.type !== 'root'"
      type="target"
      :position="Position.Left"
      class="vue-flow-handle"
    />

    <!-- Level stripe -->
    <div class="w-1.5 shrink-0" :class="stripeClass" />

    <!-- Content -->
    <div class="flex min-w-0 flex-1 flex-col p-5">
      <div class="mb-3 flex items-center gap-2">
        <span
          class="shrink-0 rounded px-2 py-0.5 text-[11px] font-[600] tracking-wider"
          :class="badgeClass"
        >
          {{ levelLabel }}
        </span>
        <h3
          class="truncate font-anthropic-serif text-[18px] font-[400] leading-tight text-ink"
          :class="{ 'line-through': isOutdatedIII }"
        >
          {{ data.label }}
        </h3>
        <span
          v-if="learningStatusDot"
          class="ml-auto h-2 w-2 shrink-0 rounded-full"
          :class="learningStatusDot.class"
          :title="learningStatusDot.title"
        />
      </div>

      <p
        v-if="data.description"
        class="line-clamp-2 text-[14px] leading-relaxed text-muted"
      >
        {{ data.description }}
      </p>
      <p
        v-else
        class="line-clamp-2 text-[14px] leading-relaxed italic text-muted"
      >
        暂无描述
      </p>

      <div class="mt-auto flex items-center justify-between pt-3">
        <button
          v-if="canCollapse"
          type="button"
          class="flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-ink"
          @click.stop="selectThisNode(); emit('toggleCollapse', id)"
        >
          <span>{{ data.collapsed ? '▸' : '▼' }}</span>
          <span>{{ data.collapsed ? '展开' : '收起' }}</span>
        </button>
        <span v-else />

        <button
          v-if="actionButton"
          type="button"
          class="rounded-[9.6px] px-4 py-1.5 text-[13px] font-[430] transition-all disabled:opacity-50"
          :class="actionButtonClass"
          :disabled="data.loading"
          @click.stop="selectThisNode(); emit('action', id, actionButton.type)"
        >
          <span v-if="data.loading">生成中…</span>
          <span v-else>{{ actionButton.label }}</span>
        </button>
      </div>
    </div>

    <Handle
      v-if="data.type !== 'l2'"
      type="source"
      :position="Position.Right"
      class="vue-flow-handle"
    />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import { NodeStatus, NodeLearningStatus } from '@skill/shared';
import type { FlowNodeData } from '../../composables/useTreeLayout';

const props = defineProps<{
  id: string;
  data: FlowNodeData;
  selected?: boolean;
  highlighted?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', nodeId: string, action: 'expand' | 'generate' | 'open'): void;
  (e: 'toggleCollapse', nodeId: string): void;
}>();

const { findNode, addSelectedNodes } = useVueFlow();

function selectThisNode() {
  const node = findNode(props.id);
  if (node) {
    addSelectedNodes([node]);
  }
}

const isOutlined = computed(() => props.selected || props.highlighted);

const level = computed(() => {
  if (props.data.type === 'root') return 0;
  if (props.data.type === 'l1') return 1;
  return 2;
});

const levelLabel = computed(() => {
  if (props.data.type === 'root') return 'ROOT';
  if (props.data.type === 'l1') return 'L1';
  return 'L2';
});

const learningStatusDot = computed(() => {
  switch (props.data.learningStatus) {
    case NodeLearningStatus.IN_PROGRESS:
      return { class: 'bg-accent', title: '学习中' };
    case NodeLearningStatus.COMPLETED:
      return { class: 'bg-success', title: '已完成' };
    case NodeLearningStatus.SKIPPED:
      return { class: 'bg-muted', title: '跳过' };
    default:
      return null;
  }
});

const isOutdatedIII = computed(() => props.data.status === NodeStatus.OUTDATED_III);

const canCollapse = computed(() => {
  return props.data.type === 'l1' && props.data.hasChildren;
});

const actionButton = computed(() => {
  if (props.data.type === 'l1' && !props.data.hasChildren) {
    return { label: '初始化', type: 'expand' as const };
  }
  if (props.data.type === 'l2') {
    if (!props.data.hasContent) {
      return { label: '分析', type: 'generate' as const };
    }
    return { label: '详情', type: 'open' as const };
  }
  return null;
});

const borderColorClass = computed(() => {
  if (props.selected) {
    return 'border-ink';
  }
  switch (props.data.status) {
    case NodeStatus.ACTIVE:
      return 'border-border group-hover:border-strong';
    case NodeStatus.OUTDATED_I:
      return 'border-placeholder';
    case NodeStatus.OUTDATED_II:
      return 'border-muted';
    case NodeStatus.OUTDATED_III:
      return 'border-muted';
    default:
      return 'border-border group-hover:border-strong';
  }
});

const statusOpacityClass = computed(() => {
  switch (props.data.status) {
    case NodeStatus.ACTIVE:
      return 'opacity-100';
    case NodeStatus.OUTDATED_I:
      return 'opacity-95';
    case NodeStatus.OUTDATED_II:
      return 'opacity-85';
    case NodeStatus.OUTDATED_III:
      return 'opacity-65 grayscale-[0.3]';
    default:
      return 'opacity-100';
  }
});

const stripeClass = computed(() => {
  switch (props.data.type) {
    case 'root':
      return 'bg-ink';
    case 'l1':
      return 'bg-secondary';
    case 'l2':
      return 'bg-accent';
    default:
      return 'bg-ink';
  }
});

const badgeClass = computed(() => {
  switch (props.data.type) {
    case 'root':
      return 'bg-ink text-surface';
    case 'l1':
      return 'bg-secondary text-surface';
    case 'l2':
      return 'bg-accent text-accent-text';
    default:
      return 'bg-ink text-surface';
  }
});

const actionButtonClass = computed(() => {
  if (props.data.type === 'l2' && props.data.hasContent) {
    return 'border border-border bg-surface text-secondary hover:border-strong hover:bg-elevated';
  }
  if (props.data.type === 'l1' && !props.data.hasChildren) {
    return 'bg-secondary text-surface hover:bg-ink';
  }
  return 'border border-border bg-surface text-secondary hover:border-strong';
});
</script>
