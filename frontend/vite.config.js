// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy static session captures if served by Flask
      '/static': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
})
