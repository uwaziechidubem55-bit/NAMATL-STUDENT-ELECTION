import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'NAMATL Student E-Voting',
        short_name: 'NAMATL Vote',
        description: 'Official Election Platform for NAMATL FUPRE',
        theme_color: '#003366',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}']
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
})