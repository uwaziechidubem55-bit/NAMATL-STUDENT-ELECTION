import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    // 📱 Progressive Web App configuration using your native platform logo
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'NAMATL Student E-Voting Platform',
        short_name: 'NAMATL Voting',
        description: 'Official Election Portal for National Association of Maritime Transport and Logistics Students, FUPRE',
        theme_color: '#003366', // Matches your portal's deep blue brand identity
        background_color: '#003366',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
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
          // 💳 Split Flutterwave payments out
          if (id.includes('node_modules/flutterwave-react-v3')) {
            return 'flutterwave';
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
  define: {
    'import.meta.env.VITE_FLW_PUBLIC_KEY': JSON.stringify(process.env.VITE_FLW_PUBLIC_KEY || '')
  }
})
