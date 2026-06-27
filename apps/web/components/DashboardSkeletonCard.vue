<template>
  <div
    class="flex h-36 flex-col justify-between rounded-[16px] border border-border bg-surface p-5 animate-pulse"
    aria-hidden="true"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="h-4 flex-1 rounded bg-elevated" />
      <div class="h-4 w-12 shrink-0 rounded-full bg-elevated" />
    </div>

    <div class="space-y-2">
      <div class="h-4 w-full rounded bg-elevated" />
      <div class="h-4 w-5/6 rounded bg-elevated" />
    </div>

    <div v-if="withProgress" class="flex items-center gap-3">
      <div class="h-2 flex-1 rounded-full bg-elevated" />
      <div class="h-3 w-8 rounded bg-elevated" />
    </div>
    <div v-else class="h-2 w-full rounded-full bg-elevated" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  withProgress?: boolean;
}

withDefaults(defineProps<Props>(), {
  withProgress: true,
});
</script>
