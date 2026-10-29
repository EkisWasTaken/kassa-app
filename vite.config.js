import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' so the built index.html loads its assets over file:// inside Electron
export default defineConfig({ plugins: [vue()], base: './' })
