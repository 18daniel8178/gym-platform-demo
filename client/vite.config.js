import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-qrcode': ['qrcode'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true, // escucha en la red local (permite ver desde el celular por IP o ngrok)
    // Permite servir el sitio a través de los dominios de ngrok (si no, Vite bloquea el host)
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.dev', '.ngrok.io'],
    // La API de la demo local corre en otro puerto (npm run demo): API_PORT deja
    // que convivan con el desarrollo normal contra producción.
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 3001}`,
        changeOrigin: true,
      },
    },
  },
})
