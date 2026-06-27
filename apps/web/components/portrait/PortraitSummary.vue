<template>
  <div class="space-y-6">
    <div class="text-center">
      <h2 class="mb-2 font-anthropic-serif text-[24px] font-[330] leading-[1.33] text-ink">
        你的学习肖像
      </h2>
      <p class="text-muted">基于问卷答案，AI 为你生成的学习画像</p>
    </div>

    <AppCard>
      <div class="mb-4">
        <h3 class="mb-2 text-[14px] font-[500] uppercase tracking-wide text-placeholder">
          摘要
        </h3>
        <p class="text-[16px] leading-relaxed text-ink">{{ portrait.summary }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div v-if="identityTags.length">
          <h4 class="mb-2 text-[13px] font-[500] text-secondary">身份标签</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in identityTags"
              :key="tag"
              class="rounded-full bg-accent px-3 py-1 text-[13px] text-accent-text"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <div v-if="interestTags.length">
          <h4 class="mb-2 text-[13px] font-[500] text-secondary">兴趣标签</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in interestTags"
              :key="tag"
              class="rounded-full bg-elevated px-3 py-1 text-[13px] text-ink"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <div v-if="goalTags.length">
          <h4 class="mb-2 text-[13px] font-[500] text-secondary">目标标签</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in goalTags"
              :key="tag"
              class="rounded-full border border-border px-3 py-1 text-[13px] text-ink"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
interface Props {
  portrait: Record<string, unknown>;
}

const props = defineProps<Props>();

const identityTags = computed(() => (props.portrait.identityTags as string[]) || []);
const interestTags = computed(() => (props.portrait.interestTags as string[]) || []);
const goalTags = computed(() => (props.portrait.goalTags as string[]) || []);
</script>
