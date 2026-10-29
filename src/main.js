import { createApp } from 'vue'
import '@fontsource-variable/manrope'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './style.css'
import App from './App.vue'
import { initTheme } from './theme.js'

initTheme().then(() => createApp(App).mount('#app')) // theme first, so the first paint is already right
