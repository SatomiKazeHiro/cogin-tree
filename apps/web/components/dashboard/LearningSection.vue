<template>
  <section class="mb-10">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-anthropic-serif text-[24px] font-[330] text-ink">
        我的技能树
      </h2>
      <AppButton variant="soft" size="sm" @click="$emit('create')">
        创建技能树
      </AppButton>
    </div>

    <AppSkeleton
      v-if="loading"
      variant="dashboard-cards"
      :count="3"
      :with-progress="true"
      aria-label="加载我的技能树…"
    />
    <div v-else-if="records.length === 0" class="text-muted">
      还没有技能树，从上方创建一个开始。
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardSkillCard
        v-for="record in records"
        :key="record.skillTree.id"
        :tree="record.skillTree"
        :progress="record.progress"
        @delete="$emit('delete', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SkillTree } from '@skill/shared';

interface RecordItem {
  skillTree: SkillTree;
  progress: number;
}

defineProps<{
  records: RecordItem[];
  loading?: boolean;
}>();

defineEmits<{
  (e: 'create'): void;
  (e: 'delete', id: string): void;
}>();
</script>
