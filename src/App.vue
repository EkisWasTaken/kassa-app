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
import { parseStatement, parseCsv, decodeText, mergeTx, monthsIn, monthLong, checklist, withMoves, withRules, displayName, title } from './logic.js'

// Electron saves to a JSON file via preload; plain browser (vite dev preview) falls back to localStorage.
const store = window.api ?? {
  load: async () => JSON.parse(localStorage.getItem('kassa') || 'null'),
  save: async (d) => localStorage.setItem('kassa', JSON.stringify(d)),
}
// Category names from the first English version
const OLD_CATS = { Housing: 'Boende', 'Insurance & loans': 'Försäkring & lån', Savings: 'Sparande', Subscriptions: 'Prenumerationer',
  'Phone & internet': 'Telefon & internet', 'Clubs & fitness': 'Föreningar & träning', Food: 'Mat', Restaurants: 'Restaurang & café',
  Travel: 'Resor', Bills: 'Räkningar', Transfer: 'Överföring', Other: 'Övrigt' }

const EMPTY = () => ({ tx: [], overrides: {}, goal: 0.15, subs: [], dismissed: [], checked: {}, budgets: {}, goals: [], accounts: [], moves: {}, rules: [], names: {} })
const data = ref(EMPTY())
const loaded = ref(false)
const loadError = ref('')
const message = ref('')
const tab = ref('Översikt')
const query = ref('')
const month = ref('')
const fileInput = ref()

// What every view reads: transactions with their chosen month applied (data.moves: txKey -> 'YYYY-MM')
const view = computed(() => ({ ...data.value, tx: withRules(withMoves(data.value.tx, data.value.moves), data.value.rules) }))
const months = computed(() => monthsIn(view.value.tx))

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

// Every change keeps a copy of the data from before it, so the latest one can be undone from the toast
const undoState = ref(null) // { label, before }
let undoTimer
function change(fn, label) {
  const before = JSON.parse(JSON.stringify(data.value))
  fn(data.value)
  save()
  clearTimeout(undoTimer)
  undoState.value = label ? { label, before } : null
  if (label) undoTimer = setTimeout(() => { undoState.value = null }, 8000)
}
function undo() {
  data.value = undoState.value.before
  undoState.value = null
  save()
}
const setOverride = (m, cat) => change((d) => { d.overrides = { ...d.overrides, [m]: cat } }, `${title(m)} är nu ${cat}`)
const addSub = (s) => change((d) => { d.subs.push({ name: s.name, match: s.match, kind: s.kind, cycle: s.cycle, category: s.category }) })
const dismiss = (name) => change((d) => { d.dismissed.push(name) }, `${name} föreslås inte igen`)
const undismiss = (name) => change((d) => { d.dismissed = d.dismissed.filter((n) => n !== name) })
const updateSub = (i, patch) => change((d) => { Object.assign(d.subs[i], patch) })
const removeSub = (i) => change((d) => { d.subs.splice(i, 1) }, `${data.value.subs[i].name} borttagen`)
const toggleChecked = (m, id) => change((d) => {
  const list = d.checked[m] ?? []
  d.checked = { ...d.checked, [m]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] }
})
function go(t, q = '') { query.value = q; tab.value = t }
const setBudgets = (b) => change((d) => { d.budgets = Object.fromEntries(Object.entries(b).filter(([, v]) => v > 0)) })
const setRate = (r) => change((d) => { d.goal = r })
const addGoal = (g) => change((d) => { d.goals.push(g) })
const updateGoal = (i, patch) => change((d) => { Object.assign(d.goals[i], patch) })
const removeGoal = (i) => change((d) => { d.goals.splice(i, 1) }, `Sparmålet ${data.value.goals[i].name} borttaget`)
const addAccount = (a) => change((d) => { d.accounts.push(a) })
const updateAccount = (i, patch) => change((d) => { Object.assign(d.accounts[i], patch) })
const removeAccount = (i) => change((d) => { d.accounts.splice(i, 1) }, `Kontot ${data.value.accounts[i].name} borttaget`)
const setMove = (key, m) => change((d) => { const { [key]: _, ...rest } = d.moves; d.moves = m ? { ...rest, [key]: m } : rest },
  `${displayName(key.split('|')[1], data.value.names)} räknas nu till ${monthLong(m ?? key.slice(0, 7)).toLowerCase()}`)
const setName = (m, name) => change((d) => { const { [m]: _, ...rest } = d.names; d.names = name ? { ...rest, [m]: name } : rest },
  name ? `${title(m)} heter nu ${name}` : `${title(m)} har sitt vanliga namn igen`)
const addRule = (r) => change((d) => { d.rules = [...d.rules, r] }, `Regel skapad: ${r.text} blir ${r.category}`)
const removeRule = (i) => change((d) => { d.rules = d.rules.filter((_, j) => j !== i) }, `Regeln för ${data.value.rules[i].text} borttagen`)

const openItems = computed(() => {
  if (!month.value) return 0
  const done = data.value.checked[month.value] ?? []
  return checklist(view.value.tx, data.value.overrides, data.value.subs, data.value.dismissed, month.value, data.value.budgets, data.value.accounts)
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
    <h1>{{ tab }}<span v-if="month && !['Inställningar', 'År', 'Investeringar', 'Prenumerationer'].includes(tab)" class="muted">&nbsp;{{ monthLong(month).toLowerCase() }}</span></h1>
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

    <Settings v-if="tab === 'Inställningar'" :rules="data.rules" :txs="view.tx" @restored="restored" @add-rule="addRule" @remove-rule="removeRule" />

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
      <Overview v-if="tab === 'Översikt'" :data="view" :month="month" @show-all="query = ''; tab = 'Transaktioner'" @go-subs="tab = 'Prenumerationer'" @go-invest="tab = 'Investeringar'" @override="setOverride" />
      <Checklist v-else-if="tab === 'Månadskoll'" :data="view" :month="month" @go="go" @toggle="toggleChecked" @override="setOverride" @move="setMove" />
      <Year v-else-if="tab === 'År'" :data="view" />
      <Investments v-else-if="tab === 'Investeringar'" :data="view" @add-account="addAccount" @update-account="updateAccount" @remove-account="removeAccount" />
      <Budget v-else-if="tab === 'Budget'" :data="view" :month="month" @set-budgets="setBudgets" @set-rate="setRate" @add-goal="addGoal" @update-goal="updateGoal" @remove-goal="removeGoal" />
      <Transactions v-else-if="tab === 'Transaktioner'" :txs="view.tx" :overrides="data.overrides" :names="data.names" :query="query" :month="month" @override="setOverride" @move="setMove" @add-rule="addRule" @rename="setName" />
      <Subscriptions v-else-if="tab === 'Prenumerationer'" :data="view" @add="addSub" @dismiss="dismiss" @undismiss="undismiss" @update="updateSub" @remove="removeSub" />
    </template>
  </main>

  <div v-if="undoState" class="toast" role="status">
    <span>{{ undoState.label }}</span>
    <button @click="undo">Ångra</button>
  </div>
</template>

<style scoped>
.shell { padding: 8px 40px 48px; display: flex; flex-direction: column; gap: 24px; max-width: 1600px; margin: 0 auto; }

/* Title bar: in Electron this is the window's drag area; Windows draws min/max/close over its right edge */
.titlebar {
  position: sticky; top: 0; z-index: 10; height: 56px; display: flex; align-items: center; gap: 28px;
  padding: 0 calc(100vw - env(titlebar-area-width, 100vw) + 16px) 0 20px; /* leaves room for the window buttons */
  background: var(--cover); color: var(--cover-ink); -webkit-app-region: drag; user-select: none;
}
.brand { display: flex; align-items: center; gap: 10px; font-family: var(--serif); font-weight: 650; font-size: 21px; letter-spacing: -0.02em; color: var(--hero-ink); flex: none; }
.brand i { font-style: normal; color: var(--warm); }
.tabs { display: flex; align-items: flex-end; gap: 2px; height: 100%; overflow-x: auto; scrollbar-width: none; -webkit-app-region: no-drag; }
.tabs button { position: relative; border: 0; background: transparent; height: 40px; padding: 0 14px; border-radius: 10px 10px 0 0; color: inherit; font-weight: 600; font-size: 14px; white-space: nowrap; }
.tabs button:hover { color: var(--hero-ink); background: color-mix(in srgb, var(--ground) 10%, transparent); }
.tabs button.on { color: var(--ink); background: var(--ground); } /* an index tab cut into the cover */
.tabs button:focus-visible { outline-color: var(--hero-ink); outline-offset: -3px; }

.toolbar {
  position: sticky; top: 56px; z-index: 9; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
  max-width: 1600px; margin: 0 auto; padding: 18px 40px; background: color-mix(in srgb, var(--ground) 88%, transparent); backdrop-filter: blur(10px);
}
.toolbar h1 { margin: 0; font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
.toolbar h1 .muted { font-weight: 400; font-style: italic; }
.field { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 0 14px; height: 40px; font-size: 14px; }
.field:focus-within { border-color: var(--accent); }
.banner { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; font-size: 14px; }
.badge { margin-left: 6px; display: inline-block; min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--warm); color: var(--on-warm); font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 18px; }
.nudge { text-align: left; background: var(--note); border-color: var(--note-line); cursor: pointer; }
.nudge b { color: var(--warm-text); }
.link { border: 0; background: none; color: var(--link); font-weight: 700; margin-left: 8px; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 20; display: flex; gap: 16px; align-items: center; max-width: calc(100vw - 32px);
  background: var(--hero); color: var(--hero-ink); border-radius: 10px; padding: 10px 12px 10px 16px; font-size: 14px; box-shadow: 0 6px 24px rgb(0 0 0 / .25); animation: rise .2s ease-out; }
.toast button { border: 1px solid var(--hero-muted); background: transparent; color: var(--hero-ink); border-radius: 8px; height: 32px; padding: 0 12px; font-weight: 650; }
.toast button:focus-visible { outline-color: var(--hero-ink); }
@keyframes rise { from { transform: translate(-50%, 8px); } } /* no fade, so a paused animation never leaves it invisible */
.empty { max-width: 560px; margin: 80px auto; text-align: center; align-items: center; }
</style>
