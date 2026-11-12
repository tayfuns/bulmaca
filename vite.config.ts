import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Göreli yollar: GitHub Pages alt klasöründe (/bulmaca/) de çalışır
  base: './',
  plugins: [react()],
})
