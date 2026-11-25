import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

// Local Vite serves fixture data. Every packaged build is CRM-only.
export default defineConfig(({ command }) => {
  const isDevServer = command === 'serve';
  const useMockData = isDevServer;

  return {
    plugins: [react(), viteSingleFile()],
    base: './',
    publicDir: 'public',
    resolve: {
      alias: {
        // Only the local dev server keeps Salesforce-shaped fixtures.
        '@/lib/mockData/mockAdapter': path.resolve(
          process.cwd(),
          useMockData
            ? 'src/lib/mockData/mockAdapter.js'
            : 'src/lib/dataservice/mockAdapter.live.js'
        ),
        '@/lib/mockData/marketAccessFixtures': path.resolve(
          process.cwd(),
          useMockData
            ? 'src/lib/mockData/marketAccessFixtures.js'
            : 'src/lib/dataservice/marketAccessFixtures.live.js'
        ),
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    build: {
      outDir: 'dist',
      // es2022 so the inlined pdf.js worker (top-level await + module worker)
      // builds. Supported on the Safari 15+/iPadOS the Veeva client runs.
      target: 'es2022',
      emptyOutDir: true,
      assetsInlineLimit: 100000000,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    worker: {
      format: 'es',
    },
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    server: {
      port: 5173,
      open: true,
    },
  };
});
