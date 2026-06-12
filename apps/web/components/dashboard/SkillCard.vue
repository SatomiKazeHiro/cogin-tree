<template>
  <NuxtLink
    :to="`/skills/${tree.id}/tree`"
    class="block rounded-[16px] border border-linen-border bg-pure-white p-5 transition-colors hover:border-charcoal"
  >
    <div class="mb-2 flex items-center justify-between">
      <h3 class="font-anthropic-serif text-[18px] font-[330] text-ink-black">
        {{ tree.name }}
      </h3>
      <span class="rounded-full bg-dust-blue px-2 py-0.5 text-[12px] text-ink-black">
        {{ tree.type }}
      </span>
    </div>
    <p class="line-clamp-2 text-[14px] text-stone-gray">
      {{ tree.description || '暂无描述' }}
    </p>
  </NuxtLink>
</template>

<script setup lang="ts">
interface Tree {
  id: string;
  name: string;
  description?: string;
  type: string;
}

defineProps<{ tree: Tree }>();
</script>
