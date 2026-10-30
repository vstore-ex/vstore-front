import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local backend in Docker exposes port 8080 (0.0.0.0:8080:8000), or fallback via env variable
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
})
