import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY': JSON.stringify(process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY || '')
  }
})