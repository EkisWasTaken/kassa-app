import { createApp } from 'vue'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/fraunces/opsz.css'
import './style.css'
import App from './App.vue'
import { initTheme } from './theme.js'

initTheme().then(() => createApp(App).mount('#app')) // theme first, so the first paint is already right
