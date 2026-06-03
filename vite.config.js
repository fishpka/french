import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/french/',
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
})
