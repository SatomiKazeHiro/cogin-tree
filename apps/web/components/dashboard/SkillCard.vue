<template>
  <div
    class="group block cursor-pointer rounded-[16px] border border-border bg-surface p-5 transition-all hover:border-strong hover:bg-elevated"
    @click="goToTree"
  >
    <div class="mb-2 flex items-start justify-between gap-3">
      <h3 class="font-anthropic-serif text-[18px] font-[330] text-ink">
        {{ tree.name }}
      </h3>
      <div class="flex shrink-0 items-center gap-2">
        <span
          class="rounded-full px-2 py-0.5 text-[12px]"
          :class="typeBadgeClass"
        >
          {{ typeLabel }}
        </span>

        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-[9.6px] text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-elevated hover:text-danger"
          :aria-label="`删除 ${tree.name}`"
          @click.stop="emit('delete', tree.id)"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </div>
    <p class="line-clamp-2 text-[14px] text-muted">
      {{ tree.description || '暂无描述' }}
    </p>

    <div v-if="keywordList.length > 0" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="keyword in keywordList"
        :key="keyword"
        class="rounded-full bg-border px-2 py-0.5 text-[12px] text-secondary"
      >
        {{ keyword }}
      </span>
    </div>

    <div v-if="showProgress" class="mt-4 flex items-center gap-3">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-border">
        <div
          class="h-full rounded-full bg-accent transition-all"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <span class="shrink-0 text-[13px] text-muted">{{ progress }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import type { SkillTree } from '@skill/shared';

const props = withDefaults(
  defineProps<{
    tree: SkillTree;
    progress?: number;
  }>(),
  {
    progress: undefined,
  },
);

const emit = defineEmits<{
  (e: 'delete', id: string): void;
}>();

const router = useRouter();

const showProgress = computed(() => typeof props.progress === 'number');

const keywordList = computed(() => {
  if (!props.tree.keywords) return [];
  return props.tree.keywords
    .split(/[,，]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .slice(0, 4);
});

const typeLabel = computed(() => {
  switch (props.tree.type) {
    case 'ENTRY':
      return '入门';
    case 'EXPERT':
      return '进阶';
    case 'INTERVIEW':
      return '面试';
    default:
      return props.tree.type;
  }
});

const typeBadgeClass = computed(() => {
  switch (props.tree.type) {
    case 'ENTRY':
      return 'bg-accent text-accent-text';
    case 'EXPERT':
      return 'bg-elevated text-ink border border-border';
    case 'INTERVIEW':
      return 'bg-secondary text-surface';
    default:
      return 'bg-accent text-accent-text';
  }
});

function goToTree() {
  router.push(`/skills/${props.tree.id}/tree`);
}
</script>
