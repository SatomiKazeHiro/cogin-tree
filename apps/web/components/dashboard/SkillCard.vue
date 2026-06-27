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
  </div>
</template>

<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import type { SkillTree } from '@skill/shared';

const props = defineProps<{ tree: SkillTree }>();
const emit = defineEmits<{
  (e: 'delete', id: string): void;
}>();

const router = useRouter();

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
