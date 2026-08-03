<template>
  <div class="flex h-full flex-col bg-surface">
    <!-- Header -->
    <header class="shrink-0 border-b border-border px-8 pb-4 pt-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="font-anthropic-serif text-[26px] font-[330] leading-tight text-ink">AI 分析</h2>
          <p class="mt-1 text-[13px] text-muted">结合技术趋势，发现缺失主题、标记过时内容</p>
        </div>
        <button
          type="button"
          class="rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink"
          aria-label="关闭"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="mt-4">
        <button
          type="button"
          class="rounded-[9.6px] border border-border bg-surface px-4 py-2 text-[14px] text-ink transition-colors hover:border-strong hover:bg-elevated disabled:opacity-50"
          :disabled="analyzing"
          @click="runAnalysis"
        >
          {{ analyzing ? '分析中，约需半分钟…' : '开始分析' }}
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-8 py-6">
      <!-- 分析中骨架 -->
      <div v-if="analyzing" class="space-y-3">
        <AppSkeleton v-for="i in 3" :key="i" variant="card" card-height="h-24" />
      </div>

      <template v-else>
        <!-- 加载失败 -->
        <div v-if="loadError" class="flex flex-col items-center gap-3 py-16">
          <p class="text-[14px] text-danger">{{ loadError }}</p>
          <AppButton variant="secondary" @click="loadPending">重试</AppButton>
        </div>

        <!-- 空状态 -->
        <EmptyState
          v-else-if="suggestions.length === 0"
          title="暂无待处理建议"
          description="点击「开始分析」让 AI 审视这棵树"
        />

        <template v-else>
          <!-- 建议新增 -->
          <section v-if="addSuggestions.length > 0" class="mb-8">
            <h3 class="mb-3 text-[13px] font-[500] tracking-wide text-muted">
              建议新增（{{ addSuggestions.length }}）
            </h3>
            <div class="space-y-3">
              <div
                v-for="s in addSuggestions"
                :key="s.id"
                class="rounded-[9.6px] border border-border bg-surface p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <p class="text-[15px] font-[500] text-ink">{{ s.title }}</p>
                  <span class="shrink-0 rounded-[6px] bg-elevated px-2 py-0.5 text-[12px] text-success">
                    新增
                  </span>
                </div>
                <p v-if="s.description" class="mt-1.5 text-[13px] leading-relaxed text-secondary">
                  {{ s.description }}
                </p>
                <p v-if="s.reason" class="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {{ s.reason }}
                </p>
                <p class="mt-2 flex items-center gap-1 text-[12px] text-muted">
                  <FolderOpen :size="12" />
                  归类：{{ parentTitle(s) }}
                </p>
                <div class="mt-3 flex gap-2">
                  <button
                    type="button"
                    class="rounded-[9.6px] bg-ink px-3 py-1.5 text-[13px] text-canvas transition-opacity hover:opacity-85 disabled:opacity-50"
                    :disabled="actingId === s.id"
                    @click="apply(s)"
                  >
                    采纳
                  </button>
                  <button
                    type="button"
                    class="rounded-[9.6px] border border-border px-3 py-1.5 text-[13px] text-secondary transition-colors hover:border-strong disabled:opacity-50"
                    :disabled="actingId === s.id"
                    @click="ignore(s)"
                  >
                    忽略
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- 建议过期 -->
          <section v-if="expireSuggestions.length > 0">
            <h3 class="mb-3 text-[13px] font-[500] tracking-wide text-muted">
              建议标记过期（{{ expireSuggestions.length }}）
            </h3>
            <div class="space-y-3">
              <div
                v-for="s in expireSuggestions"
                :key="s.id"
                class="rounded-[9.6px] border border-border bg-surface p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <p class="text-[15px] font-[500] text-ink">{{ s.title }}</p>
                  <span class="shrink-0 rounded-[6px] bg-elevated px-2 py-0.5 text-[12px] text-danger">
                    {{ expireLevelLabel(s.expireLevel) }}
                  </span>
                </div>
                <p v-if="s.reason" class="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {{ s.reason }}
                </p>
                <div class="mt-3 flex gap-2">
                  <button
                    type="button"
                    class="rounded-[9.6px] bg-ink px-3 py-1.5 text-[13px] text-canvas transition-opacity hover:opacity-85 disabled:opacity-50"
                    :disabled="actingId === s.id"
                    @click="apply(s)"
                  >
                    采纳
                  </button>
                  <button
                    type="button"
                    class="rounded-[9.6px] border border-border px-3 py-1.5 text-[13px] text-secondary transition-colors hover:border-strong disabled:opacity-50"
                    :disabled="actingId === s.id"
                    @click="ignore(s)"
                  >
                    忽略
                  </button>
                </div>
              </div>
            </div>
          </section>
        </template>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { X, FolderOpen } from 'lucide-vue-next';
import { ExpireLevel, SuggestionAction, type SuggestedChange } from '@skill/shared';

const props = defineProps<{
  treeId: string;
  l1Nodes: { id: string; title: string }[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  /** 有建议被采纳（ADD/EXPIRE），父组件应刷新树数据 */
  (e: 'applied'): void;
}>();

const { api } = useApi();
const toast = useToast();

const suggestions = ref<SuggestedChange[]>([]);
const analyzing = ref(false);
const actingId = ref('');
const loadError = ref('');

const l1TitleById = computed(() => new Map(props.l1Nodes.map((n) => [n.id, n.title])));

/** ADD 建议的归属说明：挂载的 L1 标题，或「新 L1 主题」 */
function parentTitle(s: SuggestedChange) {
  if (!s.parentNodeId) return '新 L1 主题';
  return l1TitleById.value.get(s.parentNodeId) ?? '（父节点已不存在）';
}

const addSuggestions = computed(() =>
  suggestions.value.filter((s) => s.action === SuggestionAction.ADD),
);
const expireSuggestions = computed(() =>
  suggestions.value.filter((s) => s.action === SuggestionAction.EXPIRE),
);

function expireLevelLabel(level?: ExpireLevel) {
  switch (level) {
    case ExpireLevel.III:
      return '严重过时';
    case ExpireLevel.II:
      return '明显过时';
    default:
      return '轻微过时';
  }
}

async function loadPending() {
  loadError.value = '';
  try {
    suggestions.value = await api<SuggestedChange[]>(
      `/skill-trees/${props.treeId}/analysis/suggestions`,
    );
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : '建议加载失败';
  }
}

async function runAnalysis() {
  analyzing.value = true;
  loadError.value = '';
  try {
    const created = await api<SuggestedChange[]>(`/skill-trees/${props.treeId}/analysis`, {
      method: 'POST',
    });
    // 合并历史待处理建议
    await loadPending();
    if (created.length === 0) {
      toast.info('分析完成，暂无新建议');
    } else {
      toast.success(`分析完成，新增 ${created.length} 条建议`);
    }
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : '分析失败');
  } finally {
    analyzing.value = false;
  }
}

async function apply(s: SuggestedChange) {
  actingId.value = s.id;
  try {
    await api(`/analysis/suggestions/${s.id}/apply`, { method: 'POST' });
    suggestions.value = suggestions.value.filter((x) => x.id !== s.id);
    toast.success(s.action === SuggestionAction.ADD ? '已添加到技能树' : '已标记为过期');
    emit('applied');
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : '操作失败');
  } finally {
    actingId.value = '';
  }
}

async function ignore(s: SuggestedChange) {
  actingId.value = s.id;
  try {
    await api(`/analysis/suggestions/${s.id}/ignore`, { method: 'POST' });
    suggestions.value = suggestions.value.filter((x) => x.id !== s.id);
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : '操作失败');
  } finally {
    actingId.value = '';
  }
}

onMounted(loadPending);
</script>
