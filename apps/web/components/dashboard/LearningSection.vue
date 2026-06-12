<template>
  <section class="mb-10">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-anthropic-serif text-[24px] font-[330] text-ink-black">
        我的技能树
      </h2>
      <NuxtLink
        to="/skills/create"
        class="rounded-[9.6px] bg-charcoal px-4 py-2 text-[14px] text-pure-white hover:opacity-90"
      >
        创建技能树
      </NuxtLink>
    </div>

    <div v-if="loading" class="text-stone-gray">加载中…</div>
    <div v-else-if="trees.length === 0" class="text-stone-gray">
      还没有技能树，从上方创建一个开始。
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardSkillCard v-for="tree in trees" :key="tree.id" :tree="tree" />
    </div>
  </section>
</template>

<script setup lang="ts">
interface Tree {
  id: string;
  name: string;
  description?: string;
  type: string;
}

defineProps<{
  trees: Tree[];
  loading?: boolean;
}>();
</script>
