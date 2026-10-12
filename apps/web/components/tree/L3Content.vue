<template>
  <div class="space-y-10">
    <!-- Concept -->
    <section v-if="activeTab === 'concept' || !activeTab">
      <article
        v-if="coreReady"
        class="prose prose-skill max-w-none"
        v-html="renderedCoreText"
      />
      <TreeArtifactStateHint
        v-else
        :status="artifacts.coreText.status"
        :last-error="artifacts.coreText.lastError"
        pending-text="正在生成核心内容…"
        @retry="emit('retry', ArtifactKind.L3_CORE_TEXT)"
      />
    </section>

    <!-- Code examples -->
    <section v-if="(activeTab === 'code' || !activeTab)">
      <!-- 单产物重新生成：仅就绪时提供（未就绪已有各自的提示与「重试」） -->
      <div v-if="canRegenerate(artifacts.codeExamples.status)" class="mb-3 flex justify-end">
        <button
          type="button"
          class="flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink"
          @click="emit('regenerate', ArtifactKind.L3_CODE_EXAMPLES)"
        >
          <RefreshCw class="h-3.5 w-3.5" />
          重新生成示例
        </button>
      </div>

      <div v-if="artifacts.codeExamples.items.length" class="space-y-6">
        <article
          v-for="(example, index) in artifacts.codeExamples.items"
          :key="index"
          class="overflow-hidden rounded-[12px] border border-border bg-code-bg"
        >
          <div class="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div class="flex items-center gap-3">
              <h3 class="text-[15px] font-[500] text-ink">{{ example.title }}</h3>
              <span class="rounded-[6px] bg-accent px-2 py-0.5 text-[11px] font-[500] text-accent-text">
                {{ example.language }}
              </span>
            </div>
            <button
              type="button"
              class="flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink"
              @click="copyCode(example.code, index)"
            >
              <Check v-if="copiedIndex === index" class="h-3.5 w-3.5" />
              <Copy v-else class="h-3.5 w-3.5" />
              {{ copiedIndex === index ? '已复制' : '复制' }}
            </button>
          </div>
          <div class="overflow-x-auto">
            <pre class="m-0 bg-transparent p-5"><code class="block bg-transparent font-mono text-[13px] leading-relaxed text-code-text" :class="languageClass(example.language)" v-html="highlightCode(example.code, example.language)" /></pre>
          </div>
        </article>
      </div>

      <TreeArtifactStateHint
        v-else
        :status="artifacts.codeExamples.status"
        :last-error="artifacts.codeExamples.lastError"
        pending-text="正在生成代码示例…"
        empty-title="该主题无代码示例"
        empty-description="纯概念性主题不提供代码演示。"
        @retry="emit('retry', ArtifactKind.L3_CODE_EXAMPLES)"
      />
    </section>

    <!-- Exercises -->
    <section v-if="(activeTab === 'exercise' || !activeTab)">
      <div v-if="canRegenerate(artifacts.exercises.status)" class="mb-3 flex justify-end">
        <button
          type="button"
          class="flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink"
          @click="emit('regenerate', ArtifactKind.L3_EXERCISES)"
        >
          <RefreshCw class="h-3.5 w-3.5" />
          重新生成练习
        </button>
      </div>

      <div v-if="artifacts.exercises.items.length" class="space-y-5">
        <TreeExerciseCard
          v-for="(exercise, index) in artifacts.exercises.items"
          :key="index"
          :index="index"
          :exercise="exercise"
        />
      </div>

      <TreeArtifactStateHint
        v-else
        :status="artifacts.exercises.status"
        :last-error="artifacts.exercises.lastError"
        pending-text="正在出题…"
        empty-title="暂无练习题"
        @retry="emit('retry', ArtifactKind.L3_EXERCISES)"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import { Copy, Check, RefreshCw } from 'lucide-vue-next';
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import type { NodeArtifactsResponse } from '@skill/shared';
import { highlightCode } from '../../utils/highlight';

const props = defineProps<{
  artifacts: NodeArtifactsResponse;
  activeTab?: 'concept' | 'code' | 'exercise';
}>();

const emit = defineEmits<{
  (e: 'retry', kind: ArtifactKind): void;
  (e: 'request-exercises'): void;
  (e: 'regenerate', kind: ArtifactKind): void;
}>();

/** 只有就绪的产物才提供「重新生成」；未就绪/失败已有各自的提示与重试 */
function canRegenerate(status: GenerationTaskStatus): boolean {
  return status === GenerationTaskStatus.READY;
}

const copiedIndex = ref<number | null>(null);

const coreReady = computed(
  () =>
    props.artifacts.coreText.status === GenerationTaskStatus.READY &&
    !!props.artifacts.coreText.text,
);

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  // 正文里的代码块与「代码演示」区块共用同一套高亮（含语言别名与降级），避免两处行为漂移
  highlight: (str: string, lang: string): string => highlightCode(str, lang),
});

const renderedCoreText = computed(() => {
  return md.render(props.artifacts.coreText.text || '');
});

function languageClass(lang: string) {
  return `language-${lang.toLowerCase()}`;
}

async function copyCode(code: string, index: number) {
  try {
    await navigator.clipboard.writeText(code);
    copiedIndex.value = index;
    setTimeout(() => {
      if (copiedIndex.value === index) {
        copiedIndex.value = null;
      }
    }, 1500);
  } catch {
    // 复制失败时静默处理
  }
}
</script>

<style scoped>
.prose-skill :deep(h1) {
  font-family: var(--font-anthropic-serif);
  font-size: 26px;
  font-weight: 330;
  line-height: 1.3;
  color: var(--text-primary);
  margin-bottom: 0.5em;
}

.prose-skill :deep(h2) {
  font-family: var(--font-anthropic-serif);
  font-size: 21px;
  font-weight: 330;
  line-height: 1.35;
  color: var(--text-primary);
  margin-top: 1.4em;
  margin-bottom: 0.5em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--border-subtle);
}

.prose-skill :deep(h3) {
  font-family: var(--font-anthropic-serif);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--text-primary);
  margin-top: 1.3em;
  margin-bottom: 0.45em;
}

.prose-skill :deep(h4) {
  font-family: var(--font-anthropic-sans);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--text-secondary);
  margin-top: 1.2em;
  margin-bottom: 0.4em;
}

.prose-skill :deep(p) {
  font-size: 15px;
  line-height: 1.72;
  color: var(--text-secondary);
  margin-bottom: 1em;
}

.prose-skill :deep(ul),
.prose-skill :deep(ol) {
  margin-top: 0.6em;
  margin-bottom: 1em;
  padding-left: 1.4em;
}

.prose-skill :deep(li) {
  font-size: 15px;
  line-height: 1.72;
  color: var(--text-secondary);
  margin-bottom: 0.35em;
}

.prose-skill :deep(li::marker) {
  color: var(--text-muted);
}

.prose-skill :deep(strong) {
  font-weight: 600;
  color: var(--text-primary);
}

.prose-skill :deep(em) {
  font-style: italic;
  color: var(--text-secondary);
}

.prose-skill :deep(a) {
  color: var(--accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s ease;
}

.prose-skill :deep(a:hover) {
  color: var(--text-primary);
}

.prose-skill :deep(code) {
  font-family: var(--font-mono);
  font-size: 13px;
  background-color: var(--bg-elevated);
  color: var(--text-secondary);
  padding: 0.15em 0.4em;
  border-radius: 5px;
}

.prose-skill :deep(pre) {
  background-color: var(--code-bg);
  color: var(--code-text);
  padding: 1.25rem;
  border-radius: 12px;
  overflow-x: auto;
  margin: 1em 0;
}

.prose-skill :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  color: inherit;
}

.prose-skill :deep(blockquote) {
  border-left: 2px solid var(--accent);
  padding-left: 1em;
  margin: 1em 0;
  color: var(--text-muted);
  font-style: italic;
}

.prose-skill :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border-default);
  margin: 1.8em 0;
}

.prose-skill :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 14px;
}

.prose-skill :deep(th),
.prose-skill :deep(td) {
  border: 1px solid var(--border-default);
  padding: 0.5em 0.75em;
  text-align: left;
}

.prose-skill :deep(th) {
  background-color: var(--bg-elevated);
  font-weight: 600;
  color: var(--text-primary);
}

/*
 * 语法高亮调色板。
 *
 * 不再引入 highlight.js 的主题 CSS：那些主题是「一套固定 hex + 只适合一种底色」，
 * 而本应用有亮/暗两套底色（--code-bg），主题文件没法按 data-theme 切换
 * （先后 import 会全局互相覆盖，暗色下必然出现「白底配色画在黑底上」）。
 *
 * 这里按官方 github / github-dark 主题的**逐类取值**映射到 9 个语义 token
 * （变量定义在 assets/css/tailwind.css，亮/暗各一套），因此观感与官方一致、又能随主题切换。
 * 未列出的类（params / function / property / punctuation / subst）官方主题本身也不上色，
 * 保持继承 --code-text。
 */
:deep(pre code) {
  color: var(--code-text);
}

/* 注释 */
:deep(.hljs-comment) {
  color: var(--code-comment);
  font-style: italic;
}

/* 红色系：关键字 / 类型 / 变量 / 文档标签 / 模板占位 */
:deep(.hljs-keyword),
:deep(.hljs-type),
:deep(.hljs-variable),
:deep(.hljs-doctag),
:deep(.hljs-template-tag),
:deep(.hljs-template-variable) {
  color: var(--code-keyword);
}

/* 字符串系 */
:deep(.hljs-string),
:deep(.hljs-regexp) {
  color: var(--code-string);
}

/* 蓝色系：数字 / 属性 / 元信息 / 运算符 / 选择器 / 字面量 / 小节 */
:deep(.hljs-number),
:deep(.hljs-attr),
:deep(.hljs-attribute),
:deep(.hljs-meta),
:deep(.hljs-operator),
:deep(.hljs-selector-class),
:deep(.hljs-selector-id),
:deep(.hljs-literal),
:deep(.hljs-section) {
  color: var(--code-number);
}

/* 实体名（函数 / 类） */
:deep(.hljs-title) {
  color: var(--code-title);
}

/* 橙色系：内建 / 符号 */
:deep(.hljs-built_in),
:deep(.hljs-builtin-name),
:deep(.hljs-symbol) {
  color: var(--code-builtin);
}

/* 绿色系：标签名 / 新增行 / 选择器 / 引用 */
:deep(.hljs-tag),
:deep(.hljs-name),
:deep(.hljs-addition),
:deep(.hljs-selector-tag),
:deep(.hljs-selector-pseudo),
:deep(.hljs-quote) {
  color: var(--code-tag);
}

/* diff 删除行 */
:deep(.hljs-deletion) {
  color: var(--code-deletion);
}

/* 列表项圆点 */
:deep(.hljs-bullet) {
  color: var(--code-bullet);
}

/* 强调 */
:deep(.hljs-emphasis) {
  font-style: italic;
}

:deep(.hljs-strong) {
  font-weight: 600;
}
</style>
