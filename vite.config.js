import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // Optional: Only add this if you want to use process.env in code
  // But the best way is to use import.meta.env directly
  define: {
    'import.meta.env.VITE_FLW_PUBLIC_KEY': JSON.stringify(process.env.VITE_FLW_PUBLIC_KEY || '')
  }
})