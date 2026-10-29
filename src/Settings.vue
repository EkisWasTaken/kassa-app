<script setup>
import { ref, onMounted } from 'vue'
import { themeSetting, setTheme } from './theme.js'

const emit = defineEmits(['restored'])
const info = ref(null)
const busy = ref(false)
const error = ref('')
const desktop = !!window.api

onMounted(async () => { if (desktop) info.value = await window.api.backupInfo() })

async function run(fn) {
  busy.value = true; error.value = ''
  try { return await fn() } catch (e) { error.value = e.message.replace(/^Error invoking remote method '\w+': (Error: )?/, '') } finally { busy.value = false }
}
const backupNow = () => run(async () => { info.value = await window.api.backup() })
const chooseDir = () => run(async () => { info.value = await window.api.chooseBackupDir() })
const openDir = () => run(() => window.api.openBackupDir())
const restore = () => run(async () => {
  const d = await window.api.restore()
  if (d) { emit('restored', d); info.value = await window.api.backupInfo() }
})
const when = (iso) => new Date(iso).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })
</script>

<template>
  <div class="card" style="max-width: 760px">
    <h2>Utseende</h2>
    <div class="seg" role="radiogroup" aria-label="Tema">
      <label v-for="o in [['system', 'Som Windows'], ['light', 'Ljust'], ['dark', 'Mörkt']]" :key="o[0]" :class="{ on: themeSetting === o[0] }">
        <input type="radio" name="theme" :value="o[0]" :checked="themeSetting === o[0]" @change="setTheme(o[0])"> {{ o[1] }}
      </label>
    </div>
  </div>

  <div class="card" style="max-width: 760px">
    <h2>Säkerhetskopior</h2>
    <p v-if="!desktop" class="muted" style="margin: 0">Säkerhetskopior finns bara i skrivbordsappen.</p>
    <template v-else-if="info">
      <p class="muted" style="margin: 0; font-size: 14px">Kassa sparar en kopia efter varje import och en gång per dygn. De 30 senaste behålls. Lägg mappen i OneDrive så finns allt kvar även om datorn går sönder.</p>
      <dl class="facts">
        <dt>Mapp</dt><dd class="mono">{{ info.dir }}</dd>
        <dt>Senaste kopia</dt><dd>{{ info.last ? when(info.last) : 'Ingen än' }} <span class="muted">· {{ info.count }} st sparade</span></dd>
        <dt>Din data</dt><dd class="mono">{{ info.dataFile }}</dd>
      </dl>
      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        <button class="btn" :disabled="busy" @click="backupNow">Säkerhetskopiera nu</button>
        <button class="btn ghost" :disabled="busy" @click="chooseDir">Byt mapp…</button>
        <button class="btn ghost" :disabled="busy" @click="openDir">Öppna mappen</button>
        <button class="btn ghost" :disabled="busy" @click="restore">Återställ från kopia…</button>
      </div>
      <p class="muted" style="margin: 0; font-size: 13px">Vid återställning sparas först en kopia av nuvarande data, så inget går förlorat.</p>
      <p v-if="error" role="alert" style="margin: 0; color: var(--warm-text); font-weight: 600">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--ground); align-self: flex-start; }
.seg label { padding: 10px 18px; border-radius: 999px; font-weight: 600; font-size: 14px; color: var(--muted); cursor: pointer; }
.seg label.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgb(0 0 0 / .15); }
.seg input { position: absolute; opacity: 0; pointer-events: none; }
.seg label:has(input:focus-visible) { outline: 2px solid var(--accent); }
.facts {display: grid; grid-template-columns: max-content 1fr; gap: 8px 20px; margin: 0; font-size: 14px; }
.facts dt { font-weight: 600; color: var(--muted); }
.facts dd { margin: 0; word-break: break-all; }
</style>
