import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Basic chunking to keep the main bundle smaller for reviewers.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('chart.js') || id.includes('vue-chartjs')) return 'charts';
          if (id.includes('@zxing')) return 'scanner';
          if (id.includes('papaparse') || id.includes('file-saver')) return 'csv';
          return 'vendor';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_API_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});
