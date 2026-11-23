// Builds the local page into the plugin: the app into skills/local-page/app, and (scripts/build.sh) the server beside it.
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const version = JSON.parse(readFileSync(fileURLToPath(new URL('../.claude-plugin/plugin.json', import.meta.url)), 'utf8')).version
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: { __VERSION__: JSON.stringify(version) },
  build: { outDir: fileURLToPath(new URL('../skills/local-page/app', import.meta.url)), emptyOutDir: true },
  // while developing: `node ../skills/local-page/scripts/page.mjs start <runs> --port 5290 --no-open`, then `npm run dev`
  server: { host: '127.0.0.1', port: 5291, strictPort: true, proxy: { '/api': 'http://127.0.0.1:5290' } },
})
