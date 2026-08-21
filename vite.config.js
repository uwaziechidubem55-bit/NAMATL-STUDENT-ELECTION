import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 📡 Split Firebase database SDK out
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          // 📄 Split PDF generation tools out
          if (id.includes('node_modules/jspdf')) {
            return 'jspdf';
          }
          // 📦 Keep remaining small core libraries (React, Router) here
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
})