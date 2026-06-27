<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <AppToast />
  <AppConfirmDialog />
</template>

<script setup lang="ts">
useHead({
  title: 'Skill Tree Learning',
  meta: [
    { name: 'description', content: 'AI-powered skill tree learning system' },
  ],
  script: [
    {
      innerHTML: `
        (function() {
          try {
            const cookie = document.cookie.match(/(?:^|; )skill-theme=([^;]*)/);
            const saved = cookie ? decodeURIComponent(cookie[1]) : 'system';
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const resolved = saved === 'system' ? (systemDark ? 'dark' : 'light') : saved;
            document.documentElement.setAttribute('data-theme', resolved);
          } catch (e) {
            document.documentElement.setAttribute('data-theme', 'light');
          }
        })();
      `,
      tagPosition: 'head',
    },
  ],
});
</script>
