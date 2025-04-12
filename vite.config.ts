import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';

// 导入 manifest 并修复 background.type
import rawManifest from './src/manifest.json';
const manifest = {
  ...rawManifest,
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module' as const
  },
  content_scripts: [
    {
      js: ['src/content/index.ts'],
      matches: ['<all_urls>']
    }
  ],
  action: {
    ...rawManifest.action,
    default_popup: 'src/popup/index.html'
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  build: {
    outDir: 'dist',
  },
}); 