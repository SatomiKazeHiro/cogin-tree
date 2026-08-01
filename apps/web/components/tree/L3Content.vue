<template>
  <div class="space-y-10">
    <!-- Concept -->
    <section v-if="activeTab === 'concept' || !activeTab">
      <article
        class="prose prose-skill max-w-none"
        v-html="renderedCoreText"
      />
    </section>

    <!-- Code examples -->
    <section v-if="(activeTab === 'code' || !activeTab)">
      <div v-if="content.codeExamples?.length" class="space-y-6">
        <article
          v-for="(example, index) in content.codeExamples"
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
            <pre class="m-0 bg-transparent p-5"><code class="block bg-transparent font-mono text-[13px] leading-relaxed" :class="languageClass(example.language)" v-html="highlightCode(example.code, example.language)" /></pre>
          </div>
        </article>
      </div>

      <EmptyState v-else title="暂无代码示例" description="当前知识点尚未生成代码演示。" />
    </section>

    <!-- Exercises -->
    <section v-if="(activeTab === 'exercise' || !activeTab)">
      <div v-if="content.exercises?.length" class="space-y-5">
        <TreeExerciseCard
          v-for="(exercise, index) in content.exercises"
          :key="index"
          :index="index"
          :exercise="exercise"
        />
      </div>

      <EmptyState v-else title="暂无练习题" description="当前知识点尚未生成练习题。" />
    </section>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import { Copy, Check } from 'lucide-vue-next';
import type { FlowContentData } from '../../composables/useTreeLayout';

const props = defineProps<{
  content: FlowContentData;
  activeTab?: 'concept' | 'code' | 'exercise';
}>();

const copiedIndex = ref<number | null>(null);

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        // fall through
      }
    }
    return md.utils.escapeHtml(str);
  },
});

const renderedCoreText = computed(() => {
  return md.render(props.content.coreText || '');
});

function languageClass(lang: string) {
  return `language-${lang.toLowerCase()}`;
}

function highlightCode(code: string, lang: string) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      // fall through
    }
  }
  return md.utils.escapeHtml(code);
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

:deep(pre code.hljs) {
  background: transparent;
}
</style>
