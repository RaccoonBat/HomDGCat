import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { siteAssets } from './build/site-assets.ts';

export default defineConfig({
  plugins: [react(), siteAssets()],
  publicDir: false,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/site/**', '**/.sr-update-*/**'] },
  },
  preview: { port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/]react/, priority: 20 },
            { name: 'ui-vendor', test: /node_modules[\\/](?:antd|@ant-design)[\\/]/, priority: 15 },
            { name: 'vendor', test: /node_modules/, priority: 10 },
          ],
        },
      },
    },
  },
});
