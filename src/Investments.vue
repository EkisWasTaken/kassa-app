<script setup>
import { computed, ref } from 'vue'
import Chart from './Chart.vue'
import Spark from './Spark.vue'
import { netWorthSeries, accountStats, savingsTransfers, monthShort, monthLong, fmt, title } from './logic.js'

const props = defineProps({ data: Object })
const emit = defineEmits(['add-account', 'update-account', 'remove-account'])

const TYPES = ['ISK', 'Sparkonto', 'Aktie- & fondkonto', 'Pension', 'Krypto', 'Annat']
const COLORS = ['var(--accent)', 'var(--good)', 'var(--warm)', '#8FA2FF', '#D9C8F5', '#FFB38A']
const thisMonth = new Date().toISOString().slice(0, 7)
const num = (v) => Math.round(Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')))
const signed = (n) => (n > 0 ? '+' : '') + fmt(n)
const kr = (v) => fmt(v) + ' kr'

const accounts = computed(() => props.data.accounts ?? [])
const series = computed(() => netWorthSeries(props.data.tx, accounts.value))
const last = computed(() => series.value.at(-1))
const prev = computed(() => series.value.at(-2))
const stats = computed(() => accounts.value.map((a, i) => ({ ...a, i, s: accountStats(props.data.tx, a, last.value?.month ?? thisMonth) })))
const totals = computed(() => {
  const value = stats.value.reduce((s, a) => s + a.s.value, 0), paid = stats.value.reduce((s, a) => s + a.s.paid, 0)
  return { value, paid, gain: value - paid, pct: paid ? (value - paid) / paid : 0 }
})
const transfers = computed(() => savingsTransfers(props.data.tx, props.data.overrides))

const kpis = computed(() => [
  { l: 'Nettoförmögenhet', v: fmt(last.value?.total ?? 0), d: prev.value ? `${signed(last.value.total - prev.value.total)} sedan ${monthShort(prev.value.month)}` : '' },
  { l: 'På banken', v: fmt(last.value?.cash ?? 0), d: 'saldo på kontot i kontoutdraget' },
  { l: 'Investerat, värde', v: fmt(totals.value.value), d: `insatt ${fmt(totals.value.paid)}` },
  { l: 'Avkastning', v: signed(totals.value.gain), d: totals.value.paid ? pct1(totals.value.pct) : '', c: totals.value.gain >= 0 ? 'var(--good-text)' : 'var(--warm-text)' },
])

const worthOption = computed(() => ({
  grid: { left: 44, right: 8, top: 36, bottom: 24 },
  legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: 'var(--muted)', fontWeight: 600 } },
  tooltip: { trigger: 'axis', valueFormatter: kr },
  xAxis: { type: 'category', boundaryGap: false, data: series.value.map((r) => monthShort(r.month) + ' ' + r.month.slice(2, 4)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: 'var(--muted)', fontWeight: 600 } },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--line)', type: 'dashed' } }, axisLabel: { formatter: (v) => v / 1000 + 'k', color: 'var(--muted)' } },
  series: [
    { name: 'Bank', type: 'line', stack: 'nw', smooth: true, symbol: 'none', data: series.value.map((r) => Math.round(r.cash)), lineStyle: { width: 0 }, areaStyle: { color: 'var(--chart-neutral)', opacity: 0.85 }, itemStyle: { color: 'var(--chart-neutral)' } },
    ...accounts.value.map((a, i) => ({ name: a.name, type: 'line', stack: 'nw', smooth: true, symbol: 'none', data: series.value.map((r) => Math.round(r.accounts[i])), lineStyle: { width: 0 }, areaStyle: { color: COLORS[i % COLORS.length], opacity: 0.85 }, itemStyle: { color: COLORS[i % COLORS.length] } })),
  ],
}))

// Allocation: holdings when you have listed any, otherwise the accounts themselves
const allocation = computed(() => {
  const h = stats.value.flatMap((a) => (a.holdings ?? []).map((x) => ({ name: x.name, value: x.value })))
  return h.length ? h : stats.value.filter((a) => a.s.value > 0).map((a) => ({ name: a.name, value: a.s.value }))
})
const allocOption = computed(() => ({
  tooltip: { formatter: (p) => `${p.name}: ${kr(p.value)} (${p.percent} %)` },
  color: [...COLORS, 'var(--chart-neutral)', '#B9B9C2'],
  legend: { bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: 'var(--muted)', fontWeight: 600 } },
  series: [{ type: 'pie', radius: ['50%', '78%'], center: ['50%', '42%'], itemStyle: { borderColor: 'var(--card)', borderWidth: 3, borderRadius: 6 },
    label: { show: false }, emphasis: { label: { show: true, position: 'center', formatter: '{d} %', fontSize: 20, fontWeight: 700, color: 'var(--ink)' } }, data: allocation.value }],
}))

// Per-account editing
const valueDraft = ref({})
const holdingDraft = ref({})
const vd = (i) => (valueDraft.value[i] ??= {})
const hd = (i) => (holdingDraft.value[i] ??= {})
const pct1 = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(Math.round(x * 1000) / 10).toString().replace('.', ',') + ' %'
function saveValue(a) {
  const d = valueDraft.value[a.i] ?? {}, v = num(d.value), month = d.month || thisMonth
  if (!Number.isFinite(v)) return
  const snapshots = (a.snapshots ?? []).filter((s) => s.month !== month).concat({ month, value: v })
  emit('update-account', a.i, { snapshots })
  valueDraft.value[a.i] = {}
}
const removeSnapshot = (a, month) => emit('update-account', a.i, { snapshots: a.snapshots.filter((s) => s.month !== month) })
function addHolding(a) {
  const d = holdingDraft.value[a.i] ?? {}, v = num(d.value)
  if (!d.name?.trim() || !Number.isFinite(v)) return
  emit('update-account', a.i, { holdings: [...(a.holdings ?? []), { name: d.name.trim(), value: v }] })
  holdingDraft.value[a.i] = {}
}
const removeHolding = (a, j) => emit('update-account', a.i, { holdings: a.holdings.filter((_, k) => k !== j) })

const draft = ref({ name: '', type: 'ISK', match: '', startPaidIn: '', value: '' })
function addAccount() {
  const d = draft.value
  if (!d.name.trim()) return
  const v = num(d.value)
  emit('add-account', { name: d.name.trim(), type: d.type, match: d.match ? [d.match] : [], startPaidIn: num(d.startPaidIn) || 0, snapshots: Number.isFinite(v) ? [{ month: thisMonth, value: v }] : [], holdings: [] })
  draft.value = { name: '', type: 'ISK', match: '', startPaidIn: '', value: '' }
}
</script>

<template>
  <section aria-label="Förmögenhet" class="ticker">
    <div v-for="k in kpis" :key="k.l" class="tick">
      <span class="muted" style="font-size: 12px; font-weight: 600">{{ k.l }}</span>
      <span class="mono" :style="{ fontSize: '22px', fontWeight: 600, color: k.c }">{{ k.v }}</span>
      <span class="mono muted" style="font-size: 12px">{{ k.d || ' ' }}</span>
    </div>
  </section>

  <section class="grid">
    <div class="card span2">
      <h2>Nettoförmögenhet över tid</h2>
      <Chart :option="worthOption" :height="300" label="Staplad yta: banksaldo plus värdet på varje konto, månad för månad" />
      <p v-if="stats.some((a) => a.s.estimated)" class="muted" style="margin: 0; font-size: 12px">Konton utan angivet värde räknas med insatt belopp tills du anger ett värde.</p>
    </div>
    <div class="card">
      <h2>Fördelning</h2>
      <Chart v-if="allocation.length" :option="allocOption" :height="260" label="Fördelning av investeringar" />
      <p v-else class="muted" style="margin: 0">Lägg till ett konto för att se fördelningen.</p>
    </div>
  </section>

  <div class="accounts">
    <div v-for="a in stats" :key="a.i" class="card">
      <div class="row" style="flex-wrap: nowrap">
        <div><b style="font-size: 17px">{{ a.name }}</b> <span class="pill">{{ a.type }}</span></div>
        <button class="link-btn" :aria-label="'Ta bort kontot ' + a.name" @click="emit('remove-account', a.i)">Ta bort</button>
      </div>
      <div style="display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap">
        <div>
          <div class="muted" style="font-size: 12px; font-weight: 600">Värde<span v-if="a.s.estimated" class="flag">uppskattat</span></div>
          <div class="mono" style="font-size: 28px; font-weight: 600">{{ fmt(a.s.value) }} kr</div>
        </div>
        <div><div class="muted" style="font-size: 12px; font-weight: 600">Insatt</div><div class="mono" style="font-size: 16px">{{ fmt(a.s.paid) }}</div></div>
        <div v-if="!a.s.estimated"><div class="muted" style="font-size: 12px; font-weight: 600">Avkastning</div>
          <div class="mono" :style="{ fontSize: '16px', color: a.s.gain >= 0 ? 'var(--good-text)' : 'var(--warm-text)' }">{{ signed(a.s.gain) }} ({{ pct1(a.s.gainPct) }})</div></div>
        <div v-if="a.s.history.length > 1" style="flex: 1; min-width: 120px"><Spark :values="a.s.history.map((h) => h.value)" color="var(--accent)" /></div>
      </div>

      <div class="muted" style="font-size: 12px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap">
        <label :for="'m' + a.i">Insättningar från:</label>
        <select :id="'m' + a.i" class="pill" style="border: 0" :value="a.match?.[0] ?? ''" @change="emit('update-account', a.i, { match: $event.target.value ? [$event.target.value] : [] })">
          <option value="">Inga</option>
          <option v-for="t in transfers" :key="t.name" :value="t.name">{{ title(t.name) }}</option>
        </select>
        <label :for="'p' + a.i">· insatt före Kassa:</label>
        <input :id="'p' + a.i" class="mono small-in" :value="a.startPaidIn || 0" inputmode="numeric" @change="emit('update-account', a.i, { startPaidIn: num($event.target.value) || 0 })"> kr
        <span>· {{ a.s.lastSnapshot ? 'värde senast angivet ' + monthLong(a.s.lastSnapshot).toLowerCase() : 'inget värde angivet än' }}</span>
      </div>

      <form class="inline" @submit.prevent="saveValue(a)">
        <label>Värde nu (kr) <input v-model="vd(a.i).value" class="mono" inputmode="numeric" placeholder="t.ex. 12 340"></label>
        <label>Månad <input v-model="vd(a.i).month" type="month" :placeholder="thisMonth"></label>
        <button class="btn small" type="submit">Spara värde</button>
      </form>

      <details>
        <summary>Innehav ({{ (a.holdings ?? []).length }}) och värdehistorik ({{ a.s.history.length }})</summary>
        <table v-if="(a.holdings ?? []).length" style="margin-top: 8px">
          <thead><tr><th>Innehav</th><th class="num">Värde</th><th></th></tr></thead>
          <tbody><tr v-for="(h, j) in a.holdings" :key="j"><td>{{ h.name }}</td><td class="num">{{ fmt(h.value) }}</td><td style="text-align: right"><button class="link-btn" :aria-label="'Ta bort ' + h.name" @click="removeHolding(a, j)">Ta bort</button></td></tr></tbody>
        </table>
        <form class="inline" @submit.prevent="addHolding(a)">
          <label>Fond/aktie <input v-model="hd(a.i).name" placeholder="t.ex. en global indexfond"></label>
          <label>Värde (kr) <input v-model="hd(a.i).value" class="mono" inputmode="numeric"></label>
          <button class="btn small ghost" type="submit">Lägg till innehav</button>
        </form>
        <table v-if="a.s.history.length" style="margin-top: 8px">
          <thead><tr><th>Månad</th><th class="num">Värde</th><th></th></tr></thead>
          <tbody><tr v-for="h in a.s.history.slice().reverse()" :key="h.month"><td>{{ monthLong(h.month) }}</td><td class="num">{{ fmt(h.value) }}</td><td style="text-align: right"><button class="link-btn" :aria-label="'Ta bort värdet för ' + h.month" @click="removeSnapshot(a, h.month)">Ta bort</button></td></tr></tbody>
        </table>
      </details>
    </div>

    <form class="card new" @submit.prevent="addAccount">
      <h2>Nytt konto</h2>
      <label>Namn <input v-model="draft.name" placeholder="t.ex. ISK hos min bank" required></label>
      <label>Typ <select v-model="draft.type"><option v-for="t in TYPES" :key="t">{{ t }}</option></select></label>
      <label>Insättningar från banken
        <select v-model="draft.match">
          <option value="">Inga (fyll i värdet själv)</option>
          <option v-for="t in transfers" :key="t.name" :value="t.name">{{ title(t.name) }} · {{ fmt(t.total) }} kr totalt</option>
        </select>
      </label>
      <label>Insatt före dina kontoutdrag (kr) <input v-model="draft.startPaidIn" class="mono" inputmode="numeric" placeholder="0"></label>
      <label>Värde idag (kr) <input v-model="draft.value" class="mono" inputmode="numeric" placeholder="valfritt"></label>
      <button class="btn small" type="submit">Lägg till konto</button>
    </form>
  </div>
</template>

<style scoped>
.ticker { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.tick { background: var(--card); border-radius: 20px; padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.span2 { grid-column: span 2; }
.accounts { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
.btn.small { height: 36px; padding: 0 14px; font-size: 13px; }
.link-btn { border: 0; background: none; color: var(--link); font-weight: 700; font-size: 12px; padding: 0; }
.inline { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.inline label, .new label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--muted); }
.inline input, .new input, .new select { border: 1px solid var(--field-border); border-radius: 8px; padding: 8px 10px; background: var(--input-bg); color: var(--ink); font-size: 14px; min-width: 140px; }
.new { background: var(--ground); border: 2px dashed var(--field-border); }
.small-in { width: 80px; border: 1px solid var(--field-border); border-radius: 6px; padding: 2px 6px; background: var(--input-bg); text-align: right; }
summary { cursor: pointer; font-size: 13px; font-weight: 700; color: var(--link); }
@media (max-width: 1100px) { .ticker, .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .span2 { grid-column: span 2; } }
</style>
