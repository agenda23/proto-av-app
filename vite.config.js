import { defineConfig } from 'vite'

export default defineConfig({
  // 開発サーバー設定
  server: {
    host: 'localhost',
    port: 3000,
    open: true,
    cors: true
  },
  
  // ビルド設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three']
        }
      }
    }
  },
  
  // 最適化設定
  optimizeDeps: {
    include: ['three']
  },
  
  // パブリックディレクトリ
  publicDir: 'public',
  
  // ベースパス
  base: './'
})