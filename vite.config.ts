import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(),],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(mode === 'production' ? packageJson.version : 'dev'),
  },
}))
