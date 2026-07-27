import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    //  ADD THIS CONFIGURATION BLOCK TO SPLIT PACKAGES
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Bundles all third-party libraries from node_modules into a separate 'vendor' file
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  define: {
    'import.meta.env.VITE_FLW_PUBLIC_KEY': JSON.stringify(process.env.VITE_FLW_PUBLIC_KEY || '')
  }
})
