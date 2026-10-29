// Light/dark theme. The setting is 'system' | 'light' | 'dark'; `theme` is what is actually shown.
import { ref } from 'vue'

export const themeSetting = ref('system')
export const theme = ref('light')
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function applyTheme(setting) {
  themeSetting.value = setting
  theme.value = setting === 'system' ? (media.matches ? 'dark' : 'light') : setting
  document.documentElement.dataset.theme = theme.value
}

export async function setTheme(setting) {
  applyTheme(setting)
  try { localStorage.setItem('kassa-theme', setting) } catch {} // browser preview only; Electron keeps it in settings.json
  await window.api?.setTheme(setting)
}

export async function initTheme() {
  let s = null
  try { s = (await window.api?.getTheme()) ?? localStorage.getItem('kassa-theme') } catch {}
  applyTheme(['light', 'dark', 'system'].includes(s) ? s : 'system')
  media.addEventListener('change', () => { if (themeSetting.value === 'system') applyTheme('system') })
}

// ECharts and SVG attributes can't read CSS variables, so 'var(--x)' is looked up here.
export function resolveColor(c) {
  const m = typeof c === 'string' && c.match(/^var\((--[\w-]+)\)$/)
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : c
}

export function resolveDeep(v) {
  if (typeof v === 'string') return resolveColor(v)
  if (Array.isArray(v)) return v.map(resolveDeep)
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveDeep(x)]))
  return v // functions (formatters, renderItem) stay as they are
}
