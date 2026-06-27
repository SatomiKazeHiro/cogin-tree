<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
    <div class="flex w-full max-w-[640px] flex-col rounded-[16px] border border-border bg-surface">
      <!-- Header -->
      <header class="flex items-center justify-between border-b border-border px-6 py-4">
        <div class="flex items-center gap-3">
          <h2 class="font-anthropic-serif text-[18px] font-[330] text-ink">
            {{ isRecommendation ? '从推荐创建技能树' : '创建技能树' }}
          </h2>
          <span class="text-[13px] text-muted">步骤 {{ step }} / 3</span>
        </div>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-[9.6px] text-muted transition-colors hover:bg-elevated hover:text-ink"
          @click="emit('cancel')"
        >
          <X class="h-4 w-4" />
        </button>
      </header>

      <!-- Step indicator -->
      <div class="border-b border-border px-6 py-4">
        <div class="flex items-center justify-center gap-2">
          <div
            v-for="(s, index) in steps"
            :key="s.key"
            class="flex items-center gap-2"
          >
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-[500]"
              :class="step > index + 1 ? 'bg-secondary text-surface' : step === index + 1 ? 'bg-accent text-accent-text' : 'bg-elevated text-muted'"
            >
              {{ index + 1 }}
            </div>
            <span
              class="text-[13px]"
              :class="step >= index + 1 ? 'text-ink' : 'text-muted'"
            >
              {{ s.label }}
            </span>
            <div
              v-if="index < steps.length - 1"
              class="mx-1 h-px w-5 bg-border"
            />
          </div>
        </div>
      </div>

      <!-- Content -->
      <main class="max-h-[55vh] overflow-y-auto px-6 py-5">
        <!-- Step 1: Info -->
        <div v-if="step === 1" class="space-y-4">
          <AppInput
            v-model="form.name"
            label="方向名称"
            placeholder="例如：前端工程化"
            :error="errors.name"
          />

          <div>
            <label class="mb-1.5 block text-[13px] font-[500] text-secondary">类型</label>
            <select
              v-model="form.type"
              class="w-full rounded-[9.6px] border border-border bg-surface px-4 py-2 text-[15px] text-ink focus:border-strong focus:outline-none"
            >
              <option value="ENTRY">入门树</option>
              <option value="EXPERT">进阶树</option>
            </select>
          </div>

          <AppInput
            v-model="form.description"
            label="描述（可选）"
            placeholder="简单描述你的学习目标"
          />

          <div>
            <label class="mb-1.5 block text-[13px] font-[500] text-secondary">补充关键词（可选）</label>
            <textarea
              v-model="form.keywords"
              rows="2"
              placeholder="例如：React, 性能优化, 工程化"
              class="w-full resize-none rounded-[9.6px] border border-border bg-surface px-4 py-2 text-[15px] text-ink placeholder:text-placeholder focus:border-strong focus:outline-none"
            />
            <p class="mt-1 text-[12px] text-muted">AI 会根据这些关键词优先返回相关知识点。</p>
          </div>
        </div>

        <!-- Step 2: Loading -->
        <div v-if="step === 2" class="flex flex-col items-center justify-center py-12 text-muted">
          <div class="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
          <p class="text-[15px]">AI 正在梳理知识点…</p>
        </div>

        <!-- Step 3: Select points -->
        <div v-if="step === 3">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h3 class="font-anthropic-serif text-[17px] font-[330] text-ink">
                选择要包含的知识点
              </h3>
              <p class="text-[13px] text-muted">
                已选 {{ selectedPoints.length }} / {{ candidatePoints.length }} 项
              </p>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-[9.6px] px-2.5 py-1 text-[12px] text-muted transition-colors hover:bg-elevated hover:text-ink"
                @click="selectAll"
              >
                全选
              </button>
              <button
                type="button"
                class="rounded-[9.6px] px-2.5 py-1 text-[12px] text-muted transition-colors hover:bg-elevated hover:text-ink"
                @click="clearAll"
              >
                清空
              </button>
            </div>
          </div>

          <div class="grid max-h-[32vh] gap-2 overflow-y-auto sm:grid-cols-2">
            <label
              v-for="point in candidatePoints"
              :key="point"
              class="flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 transition-colors"
              :class="selectedPoints.includes(point) ? 'border-strong bg-elevated' : 'border-border bg-surface hover:border-strong'"
            >
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 accent-secondary"
                :value="point"
                :checked="selectedPoints.includes(point)"
                @change="togglePoint(point)"
              />
              <span class="text-[14px] leading-snug text-ink">{{ point }}</span>
            </label>
          </div>

          <p v-if="errors.points" class="mt-2 text-[13px] text-danger">{{ errors.points }}</p>
        </div>
      </main>

      <!-- Footer -->
      <footer class="flex items-center justify-between border-t border-border px-6 py-4">
        <AppButton
          v-if="step === 3"
          variant="ghost"
          size="sm"
          :disabled="loading"
          @click="step = 1"
        >
          上一步
        </AppButton>
        <span v-else />

        <div class="flex gap-3">
          <AppButton
            variant="ghost"
            size="sm"
            :disabled="loading"
            @click="emit('cancel')"
          >
            取消
          </AppButton>

          <AppButton
            v-if="step === 1"
            size="sm"
            :loading="loading"
            @click="goToStep2"
          >
            下一步
          </AppButton>

          <AppButton
            v-if="step === 3"
            size="sm"
            :loading="loading"
            :disabled="selectedPoints.length === 0"
            @click="submit"
          >
            生成技能树
          </AppButton>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { SkillTree } from '@skill/shared';

const props = defineProps<{
  mode: 'create' | 'recommendation';
  initialName?: string;
  initialDescription?: string;
  initialType?: string;
  initialKeywords?: string;
  recommendationId?: string;
}>();

const emit = defineEmits<{
  (e: 'success', tree: SkillTree): void;
  (e: 'cancel'): void;
}>();

const { api } = useApi();

const step = ref(1);
const form = ref({
  name: props.initialName || '',
  description: props.initialDescription || '',
  type: props.initialType || 'ENTRY',
  keywords: props.initialKeywords || '',
});
const candidatePoints = ref<string[]>([]);
const selectedPoints = ref<string[]>([]);
const loading = ref(false);
const errors = ref({ name: '', points: '' });

const isRecommendation = computed(() => props.mode === 'recommendation');

const steps = [
  { key: 'info', label: '填写信息' },
  { key: 'points', label: '梳理知识点' },
  { key: 'select', label: '选择知识点' },
];

async function goToStep2() {
  errors.value.name = '';
  if (!form.value.name.trim()) {
    errors.value.name = '请输入方向名称';
    return;
  }

  step.value = 2;
  loading.value = true;
  try {
    const result = await api<{ points: string[] }>('/skill-trees/knowledge-points', {
      method: 'POST',
      body: {
        title: form.value.name,
        description: form.value.description,
        type: form.value.type,
        keywords: form.value.keywords,
      },
    });
    candidatePoints.value = result.points || [];
    selectedPoints.value = [...candidatePoints.value];
    step.value = 3;
  } catch (err: unknown) {
    step.value = 1;
    errors.value.name = err instanceof Error ? err.message : '知识点生成失败';
  } finally {
    loading.value = false;
  }
}

function togglePoint(point: string) {
  const index = selectedPoints.value.indexOf(point);
  if (index > -1) {
    selectedPoints.value.splice(index, 1);
  } else {
    selectedPoints.value.push(point);
  }
}

function selectAll() {
  selectedPoints.value = [...candidatePoints.value];
}

function clearAll() {
  selectedPoints.value = [];
}

async function submit() {
  errors.value.points = '';
  if (selectedPoints.value.length === 0) {
    errors.value.points = '请至少选择一个知识点';
    return;
  }

  loading.value = true;
  try {
    let tree: SkillTree;
    if (props.mode === 'recommendation' && props.recommendationId) {
      tree = await api<SkillTree>('/recommendations/from-recommendation', {
        method: 'POST',
        body: {
          recommendationId: props.recommendationId,
          type: form.value.type,
          selectedPoints: selectedPoints.value,
        },
      });
    } else {
      tree = await api<SkillTree>('/skill-trees', {
        method: 'POST',
        body: {
          name: form.value.name,
          description: form.value.description,
          type: form.value.type,
          selectedPoints: selectedPoints.value,
        },
      });
    }
    emit('success', tree);
  } catch (err: unknown) {
    errors.value.points = err instanceof Error ? err.message : '生成技能树失败';
  } finally {
    loading.value = false;
  }
}
</script>
