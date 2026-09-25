<template>
  <div class="group relative">
    <div
      class="relative flex h-[190px] w-[340px] overflow-hidden rounded-[16px] border bg-surface transition-all duration-300"
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
        <!-- 过期徽标：今天只靠配色/透明度表示过期，用户根本看不出来 -->
        <span
          v-if="outdatedBadge"
          class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-[600] tracking-wider"
          :class="outdatedBadge.class"
          :title="outdatedBadge.title"
        >
          {{ outdatedBadge.label }}
        </span>
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

      <div class="mt-auto flex items-center justify-end pt-3">
        <button
          v-if="actionButton"
          type="button"
          class="rounded-[9.6px] px-4 py-1.5 text-[13px] font-[430] transition-all disabled:opacity-50"
          :class="actionButtonClass"
          :disabled="data.loading"
          @click.stop="emit('focus', id); emit('action', id, actionButton.type)"
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

    <button
      v-if="canCollapse"
      type="button"
      class="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-all hover:border-strong hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      :title="data.collapsed ? '展开子节点' : '收起子节点'"
      @click.stop="emit('focus', id); emit('toggleCollapse', id)"
    >
      <Plus v-if="data.collapsed" class="h-4 w-4" />
      <Minus v-else class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { Plus, Minus } from 'lucide-vue-next';
import { NodeStatus, NodeLearningStatus } from '@skill/shared';
import { getLearningStatusMeta } from '../../utils/learning-status';
import type { FlowNodeData } from '../../composables/useTreeLayout';

const props = defineProps<{
  id: string;
  data: FlowNodeData;
  /**
   * 是否处于「聚焦」态（虚线描边）。
   *
   * 唯一来源是页面状态（`selectedNodeId`）——**不再同时接受 Vue Flow 自己的选中态**：
   * 那样会出现「左侧目录点了 A、画布上点了 B」时两个节点同时带虚线描边。
   * 点击画布节点时通过 `focus` 事件回写页面状态，仍由这一个来源决定。
   */
  highlighted?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', nodeId: string, action: 'expand' | 'generate' | 'open'): void;
  (e: 'toggleCollapse', nodeId: string): void;
  (e: 'focus', nodeId: string): void;
}>();

const isOutlined = computed(() => !!props.highlighted);

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
  const status = props.data.learningStatus;
  if (!status || status === NodeLearningStatus.NOT_STARTED) return null;
  const meta = getLearningStatusMeta(status);
  return { class: meta.dotClass, title: meta.label };
});

const isOutdatedIII = computed(() => props.data.status === NodeStatus.OUTDATED_III);

/** 过期徽标：I/II 提示「建议重新生成」，III 提示「主题已淘汰，建议删除」 */
const outdatedBadge = computed(() => {
  switch (props.data.status) {
    case NodeStatus.OUTDATED_I:
      return {
        label: '过期 I',
        class: 'bg-elevated text-muted',
        title: '内容可能轻微过时，建议重新生成',
      };
    case NodeStatus.OUTDATED_II:
      return {
        label: '过期 II',
        class: 'bg-elevated text-secondary',
        title: '内容明显过时，建议重新生成',
      };
    case NodeStatus.OUTDATED_III:
      return {
        label: '过期 III',
        class: 'bg-danger/10 text-danger',
        title: '主题本身已被淘汰，建议删除该节点',
      };
    default:
      return null;
  }
});

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
  if (props.highlighted) {
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
