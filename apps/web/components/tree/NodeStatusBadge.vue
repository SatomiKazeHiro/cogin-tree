<template>
  <div class="flex flex-wrap items-center gap-1">
    <span
      class="rounded-full px-2 py-0.5 text-[12px] font-[500]"
      :class="badgeClass"
    >
      {{ levelLabel }}
    </span>
    <span
      v-if="status"
      class="rounded-full border px-2 py-0.5 text-[10px] font-[500]"
      :class="statusBadgeClass"
    >
      {{ statusLabel }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { NodeStatus } from '@skill/shared';

const props = defineProps<{
  level: number;
  status?: NodeStatus;
}>();

const levelLabel = computed(() => {
  if (props.level === 0) return 'ROOT';
  if (props.level === 1) return 'L1';
  if (props.level === 2) return 'L2';
  if (props.level === 3) return 'L3';
  return '';
});

const badgeClass = computed(() => {
  if (props.level === 0) return 'bg-ink text-surface';
  if (props.level === 1) return 'bg-secondary text-surface';
  if (props.level === 2) return 'bg-accent text-accent-text';
  return 'bg-elevated text-ink';
});

const statusLabel = computed(() => {
  switch (props.status) {
    case NodeStatus.ACTIVE:
      return '活跃';
    case NodeStatus.OUTDATED_I:
      return '过期 I';
    case NodeStatus.OUTDATED_II:
      return '过期 II';
    case NodeStatus.OUTDATED_III:
      return '过期 III';
    default:
      return '活跃';
  }
});

const statusBadgeClass = computed(() => {
  switch (props.status) {
    case NodeStatus.ACTIVE:
      return 'border-secondary text-secondary';
    case NodeStatus.OUTDATED_I:
      return 'border-placeholder text-placeholder';
    case NodeStatus.OUTDATED_II:
      return 'border-muted text-muted';
    case NodeStatus.OUTDATED_III:
      return 'border-muted text-muted';
    default:
      return 'border-secondary text-secondary';
  }
});
</script>
