<template>
  <div class="mb-8">
    <h1 class="font-anthropic-serif text-[30px] font-[330] leading-[1.33] text-ink">
      仪表盘
    </h1>
    <p class="mt-1 text-muted">
      欢迎回来，{{ username }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ username?: string }>();
</script>
