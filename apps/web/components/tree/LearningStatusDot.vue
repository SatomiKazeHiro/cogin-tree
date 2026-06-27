<template>
  <span
    class="h-2 w-2 shrink-0 rounded-full"
    :class="meta.dotClass"
    :title="meta.label"
  />
</template>

<script setup lang="ts">
import { NodeLearningStatus } from '@skill/shared';
import { getLearningStatusMeta } from '../../utils/learning-status';

const props = defineProps<{
  status: NodeLearningStatus;
}>();

const meta = computed(() => getLearningStatusMeta(props.status));
</script>
