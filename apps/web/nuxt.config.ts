import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3002/api',
    },
  },
  imports: {
    dirs: ['composables/**'],
  },
  modules: ['@pinia/nuxt'],
  build: {
    transpile: ['@skill/shared'],
  },
  experimental: {
    appManifest: false,
  },
  compatibilityDate: '2024-06-01',
});
