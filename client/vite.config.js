import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_three: ['three'],
          vendor_react: ['react', 'react-dom'],
          vendor_socket: ['socket.io-client'],
          vendor_pdf: ['jspdf', 'html2canvas'],
          vendor_icons: ['lucide-react'],
          vendor_supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
})
