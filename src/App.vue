<script setup>
import { ref, computed, onMounted } from 'vue'
import * as XLSX from 'xlsx'
import Overview from './Overview.vue'
import Transactions from './Transactions.vue'
import Subscriptions from './Subscriptions.vue'
import Settings from './Settings.vue'
import Checklist from './Checklist.vue'
import Year from './Year.vue'
import Budget from './Budget.vue'
import Investments from './Investments.vue'
import Logo from './Logo.vue'

const TABS = ['Översikt', 'Månadskoll', 'Budget', 'Investeringar', 'År', 'Transaktioner', 'Prenumerationer', 'Inställningar']
import { parseStatement, parseCsv, decodeText, mergeTx, monthsIn, monthLong, checklist } from './logic.js'

// Electron saves to a JSON file via preload; plain browser (vite dev preview) falls back to localStorage.
const store = window.api ?? {
  load: async () => JSON.parse(localStorage.getItem('kassa') || 'null'),
  save: async (d) => localStorage.setItem('kassa', JSON.stringify(d)),
}
// Category names from the first English version
const OLD_CATS = { Housing: 'Boende', 'Insurance & loans': 'Försäkring & lån', Savings: 'Sparande', Subscriptions: 'Prenumerationer',
  'Phone & internet': 'Telefon & internet', 'Clubs & fitness': 'Föreningar & träning', Food: 'Mat', Restaurants: 'Restaurang & café',
  Travel: 'Resor', Bills: 'Räkningar', Transfer: 'Överföring', Other: 'Övrigt' }

const EMPTY = () => ({ tx: [], overrides: {}, goal: 0.15, subs: [], dismissed: [], checked: {}, budgets: {}, goals: [], accounts: [] })
const data = ref(EMPTY())
const loaded = ref(false)
const loadError = ref('')
const message = ref('')
const tab = ref('Översikt')
const query = ref('')
const month = ref('')
const fileInput = ref()

const months = computed(() => monthsIn(data.value.tx))

onMounted(async () => {
  try {
    const d = await store.load()
    if (d) {
      data.value = { ...data.value, ...d }
      for (const [m, c] of Object.entries(data.value.overrides)) data.value.overrides[m] = OLD_CATS[c] ?? c
    }
    month.value = months.value.at(-1) || ''
    loaded.value = true
  } catch (e) {
    loadError.value = 'Kunde inte läsa din sparade data, så sparandet är avstängt för att skydda den. ' + e.message
  }
})

async function save() {
  if (!loaded.value) return // never overwrite a file we failed to read
  try { await store.save(JSON.parse(JSON.stringify(data.value))) } catch (e) { message.value = 'Kunde inte spara: ' + e.message }
}

async function importFiles(e) {
  const files = [...e.target.files]
  e.target.value = ''
  let all = data.value.tx, added = 0
  const errors = []
  for (const f of files) {
    try {
      const buf = new Uint8Array(await f.arrayBuffer())
      let rows
      if (/\.(csv|txt)$/i.test(f.name)) rows = parseCsv(decodeText(buf))
      else { const wb = XLSX.read(buf); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }) } // also reads the HTML ".xls" some banks export
      const r = mergeTx(all, parseStatement(rows))
      all = r.all; added += r.added
    } catch (err) { errors.push(`${f.name}: ${err.message}`) }
  }
  data.value.tx = all
  month.value = months.value.at(-1) || ''
  message.value = `Importerade ${added} nya transaktioner från ${files.length - errors.length} fil(er).` + (errors.length ? ' Hoppade över: ' + errors.join('; ') : '')
  await save()
  if (added) await window.api?.backup().catch((e) => { message.value += ' Säkerhetskopian misslyckades: ' + e.message })
}

function restored(d) {
  data.value = { ...EMPTY(), ...d }
  month.value = months.value.at(-1) || ''
  message.value = 'Data återställd från säkerhetskopia.'
}

function change(fn) { fn(data.value); save() }
const setOverride = (m, cat) => change((d) => { d.overrides = { ...d.overrides, [m]: cat } })
const addSub = (s) => change((d) => { d.subs.push({ name: s.name, match: s.match, kind: s.kind, cycle: s.cycle, category: s.category }) })
const dismiss = (name) => change((d) => { d.dismissed.push(name) })
const undismiss = (name) => change((d) => { d.dismissed = d.dismissed.filter((n) => n !== name) })
const updateSub = (i, patch) => change((d) => { Object.assign(d.subs[i], patch) })
const removeSub = (i) => change((d) => { d.subs.splice(i, 1) })
const toggleChecked = (m, id) => change((d) => {
  const list = d.checked[m] ?? []
  d.checked = { ...d.checked, [m]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] }
})
function go(t, q = '') { query.value = q; tab.value = t }
const setBudgets = (b) => change((d) => { d.budgets = Object.fromEntries(Object.entries(b).filter(([, v]) => v > 0)) })
const setRate = (r) => change((d) => { d.goal = r })
const addGoal = (g) => change((d) => { d.goals.push(g) })
const updateGoal = (i, patch) => change((d) => { Object.assign(d.goals[i], patch) })
const removeGoal = (i) => change((d) => { d.goals.splice(i, 1) })
const addAccount = (a) => change((d) => { d.accounts.push(a) })
const updateAccount = (i, patch) => change((d) => { Object.assign(d.accounts[i], patch) })
const removeAccount = (i) => change((d) => { d.accounts.splice(i, 1) })

const openItems = computed(() => {
  if (!month.value) return 0
  const done = data.value.checked[month.value] ?? []
  return checklist(data.value.tx, data.value.overrides, data.value.subs, data.value.dismissed, month.value, data.value.budgets, data.value.accounts)
    .filter((i) => i.count && !(i.manual && done.includes(i.id))).length
})

function search() { if (query.value) tab.value = 'Transaktioner' }
</script>

<template>
  <header class="titlebar">
    <div class="brand"><Logo :size="28" /><span>kassa<i>.</i></span></div>
    <nav aria-label="Huvudmeny" class="tabs">
      <button v-for="t in TABS" :key="t" :class="{ on: tab === t }" :aria-current="tab === t ? 'page' : undefined" @click="tab = t">
        {{ t }}<span v-if="t === 'Månadskoll' && openItems" class="badge" :aria-label="openItems + ' saker kvar'">{{ openItems }}</span>
      </button>
    </nav>
  </header>

  <div class="toolbar">
    <h1>{{ tab }}<span v-if="month && !['Inställningar', 'År', 'Investeringar', 'Prenumerationer'].includes(tab)" class="muted"> · {{ monthLong(month) }}</span></h1>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
        <label v-if="months.length" class="field">
          <span class="sr-only">Månad</span>
          <select v-model="month" style="border: 0; background: transparent; font-weight: 600">
            <option v-for="m in months.slice().reverse()" :key="m" :value="m">{{ monthLong(m) }}</option>
          </select>
        </label>
        <label class="field">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <span class="sr-only">Sök transaktioner</span>
          <input v-model="query" @keydown.enter="search" @input="search" placeholder="Sök transaktioner" style="border: 0; background: transparent; outline: none; width: 200px">
        </label>
        <button class="btn" :disabled="!!loadError" @click="fileInput.click()">+ Importera</button>
        <input ref="fileInput" type="file" accept=".xls,.xlsx,.csv,.txt" multiple hidden @change="importFiles">
      </div>
  </div>

  <main class="shell">
    <div v-if="loadError" class="banner" role="alert">{{ loadError }}</div>
    <div v-if="message" class="banner" role="status">{{ message }} <button class="link" @click="message = ''">Stäng</button></div>

    <Settings v-if="tab === 'Inställningar'" @restored="restored" />

    <div v-else-if="loaded && !data.tx.length" class="card empty">
      <h2>Importera ditt första kontoutdrag</h2>
      <p class="muted">Logga in på din internetbank och exportera kontoutdraget eller transaktionerna som <b>Excel</b> eller <b>CSV</b>. Det fungerar med de flesta svenska banker, till exempel Swedbank, Handelsbanken, SEB, Nordea, Länsförsäkringar och ICA Banken.</p>
      <p class="muted">Välj gärna flera månader på en gång. Dubbletter hoppas över, så överlappande filer gör inget. Allt stannar på din dator.</p>
      <button class="btn" @click="fileInput.click()">Välj filer</button>
    </div>

    <template v-else-if="month">
      <button v-if="tab === 'Översikt' && openItems" class="banner nudge" @click="tab = 'Månadskoll'">
        <b>Månadskoll för {{ monthLong(month).toLowerCase() }}:</b> {{ openItems }} {{ openItems === 1 ? 'sak' : 'saker' }} kvar att gå igenom →
      </button>
      <Overview v-if="tab === 'Översikt'" :data="data" :month="month" @show-all="query = ''; tab = 'Transaktioner'" @go-subs="tab = 'Prenumerationer'" @go-invest="tab = 'Investeringar'" @override="setOverride" />
      <Checklist v-else-if="tab === 'Månadskoll'" :data="data" :month="month" @go="go" @toggle="toggleChecked" @override="setOverride" />
      <Year v-else-if="tab === 'År'" :data="data" />
      <Investments v-else-if="tab === 'Investeringar'" :data="data" @add-account="addAccount" @update-account="updateAccount" @remove-account="removeAccount" />
      <Budget v-else-if="tab === 'Budget'" :data="data" :month="month" @set-budgets="setBudgets" @set-rate="setRate" @add-goal="addGoal" @update-goal="updateGoal" @remove-goal="removeGoal" />
      <Transactions v-else-if="tab === 'Transaktioner'" :txs="data.tx" :overrides="data.overrides" :query="query" :month="month" @override="setOverride" />
      <Subscriptions v-else-if="tab === 'Prenumerationer'" :data="data" @add="addSub" @dismiss="dismiss" @undismiss="undismiss" @update="updateSub" @remove="removeSub" />
    </template>
  </main>
</template>

<style scoped>
.shell { padding: 8px 40px 48px; display: flex; flex-direction: column; gap: 24px; max-width: 1600px; margin: 0 auto; }

/* Title bar: in Electron this is the window's drag area; Windows draws min/max/close over its right edge */
.titlebar {
  position: sticky; top: 0; z-index: 10; height: 56px; display: flex; align-items: center; gap: 28px;
  padding: 0 calc(100vw - env(titlebar-area-width, 100vw) + 16px) 0 20px; /* leaves room for the window buttons */
  background: var(--card); border-bottom: 1px solid var(--line); -webkit-app-region: drag; user-select: none;
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 20px; letter-spacing: -0.03em; flex: none; }
.brand i { font-style: normal; color: var(--accent); }
.tabs { display: flex; gap: 2px; height: 100%; overflow-x: auto; scrollbar-width: none; -webkit-app-region: no-drag; }
.tabs button { position: relative; border: 0; background: transparent; padding: 0 14px; color: var(--muted); font-weight: 600; font-size: 14px; white-space: nowrap; }
.tabs button:hover { color: var(--ink); }
.tabs button.on { color: var(--ink); }
.tabs button.on::after { content: ''; position: absolute; left: 14px; right: 14px; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--accent); }

.toolbar {
  position: sticky; top: 56px; z-index: 9; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
  max-width: 1600px; margin: 0 auto; padding: 18px 40px; background: color-mix(in srgb, var(--ground) 88%, transparent); backdrop-filter: blur(10px);
}
.toolbar h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.03em; }
.toolbar h1 .muted { font-weight: 600; }
.field { display: flex; align-items: center; gap: 8px; background: var(--card); border-radius: 999px; padding: 0 16px; height: 44px; font-size: 14px; }
.banner { background: var(--card); border-radius: 16px; padding: 12px 16px; font-size: 14px; }
.badge { margin-left: 6px; display: inline-block; min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--warm); color: #fff; font-size: 11px; font-weight: 800; line-height: 18px; }
.nudge { border: 0; text-align: left; background: var(--warm-soft); cursor: pointer; }
.link { border: 0; background: none; color: var(--link); font-weight: 700; margin-left: 8px; }
.empty { max-width: 560px; margin: 80px auto; text-align: center; align-items: center; }
</style>
