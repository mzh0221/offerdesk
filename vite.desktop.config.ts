import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  root: fileURLToPath(new URL('./desktop/renderer', import.meta.url)),
  base: './',
  envDir: false,
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': 'undefined',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': 'undefined',
  },
  build: {
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
    outDir: '../renderer-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./desktop/renderer/index.html', import.meta.url)),
        image: fileURLToPath(new URL('./desktop/renderer/image.html', import.meta.url)),
      },
      onwarn(warning, warn) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning);
      },
    },
  },
});
