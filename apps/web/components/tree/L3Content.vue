<template>
  <div class="space-y-6">
    <AppCard>
      <h3 class="mb-3 font-anthropic-serif text-[18px] font-[330] text-ink-black">
        核心内容
      </h3>
      <p class="whitespace-pre-line text-[15px] leading-relaxed text-charcoal">{{ content.coreText }}</p>
    </AppCard>

    <div v-if="content.codeExamples?.length">
      <h3 class="mb-3 font-anthropic-serif text-[18px] font-[330] text-ink-black">
        代码示例
      </h3>
      <div class="space-y-4">
        <AppCard v-for="(example, index) in content.codeExamples" :key="index">
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-[15px] font-[500] text-ink-black">{{ example.title }}</h4>
            <span class="rounded-[6px] bg-dust-blue px-2 py-0.5 text-[12px] text-ink-black">
              {{ example.language }}
            </span>
          </div>
          <pre class="overflow-x-auto rounded-[9.6px] bg-[#f5f5f0] p-4"><code class="text-[13px] leading-relaxed text-charcoal">{{ example.code }}</code></pre>
        </AppCard>
      </div>
    </div>

    <div v-if="content.exercises?.length">
      <h3 class="mb-3 font-anthropic-serif text-[18px] font-[330] text-ink-black">
        练习题
      </h3>
      <div class="space-y-4">
        <TreeExerciseCard
          v-for="(exercise, index) in content.exercises"
          :key="index"
          :exercise="exercise"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface CodeExample {
  title: string;
  language: string;
  code: string;
}

interface Exercise {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Content {
  coreText: string;
  codeExamples?: CodeExample[];
  exercises?: Exercise[];
}

defineProps<{ content: Content }>();
</script>
