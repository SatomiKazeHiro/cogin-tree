<template>
  <button
    class="rounded-[9.6px] border border-linen-border bg-pure-white px-3 py-1.5 text-[13px] text-charcoal transition-colors hover:border-charcoal disabled:opacity-50"
    :disabled="loading"
    @click="$emit('click')"
  >
    <span v-if="loading">生成中…</span>
    <span v-else>{{ expanded ? '收起' : '展开' }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  expanded?: boolean;
  loading?: boolean;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>
