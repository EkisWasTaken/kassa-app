<script setup>
import { computed } from 'vue'
import Chart from './Chart.vue'
import Spark from './Spark.vue'
import { resolveColor } from './theme.js'
import { monthly, byCategory, daily, subscriptionStats, alerts, monthsIn, monthOf, displayName, categorize, txKey, fmt, monthShort, shortDate, accountStats, netWorthSeries, incomeBreakdown, CATEGORIES } from './logic.js'

const props = defineProps({ data: Object, month: String })
const emit = defineEmits(['show-all', 'go-subs', 'go-invest', 'override'])

const txs = computed(() => props.data.tx)
const ov = computed(() => props.data.overrides)
const goal = computed(() => props.data.goal)

const sum = (a) => a.reduce((s, x) => s + x, 0)
const signed = (n) => (n > 0 ? '+' : '') + fmt(n)
const delta = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs((a / b - 1) * 100).toFixed(1).replace('.', ',')} % mot förra mån` : '')
const kr = (v) => fmt(v) + ' kr'

const months = computed(() => monthsIn(txs.value))
const mon = computed(() => monthly(txs.value, ov.value))
const idx = computed(() => mon.value.findIndex((r) => r.month === props.month))
const cur = computed(() => mon.value[idx.value])
const prev = computed(() => mon.value[idx.value - 1])
const monthTx = computed(() => txs.value.filter((t) => monthOf(t) === props.month))
const stats = computed(() => subscriptionStats(txs.value, props.data.subs).filter((s) => s.active))
const warn = computed(() => alerts(txs.value, ov.value, props.data.subs, props.data.dismissed))

const totalSaved = computed(() => sum(mon.value.map((r) => r.saved)))
const totalIncome = computed(() => sum(mon.value.map((r) => r.income)))
const invested = computed(() => sum(mon.value.map((r) => r.invested)))
const rate = computed(() => (totalIncome.value ? totalSaved.value / totalIncome.value : 0))
const extraNeeded = computed(() => Math.max(0, (goal.value - rate.value) * totalIncome.value / mon.value.length))
const fixedCost = computed(() => sum(stats.value.map((s) => s.monthlyCost)))

const incoming = computed(() => incomeBreakdown(txs.value, ov.value, props.month))
const incomeNote = computed(() => {
  const by = (k) => sum(incoming.value.filter((r) => r.kind === k).map((r) => r.amount))
  const salary = by('Lön'), other = by('Övrigt')
  return salary && other ? `lön ${fmt(salary)} · övrigt ${fmt(other)}` : ''
})
// What each choice in the "money in" list means, and the category it sets
const KINDS = [['Lön', 'Lön', 'räknas som inkomst'], ['Övrigt', 'Övrig inkomst', 'räknas som inkomst'], ['Återbetalning', 'Återbetalning', 'minskar utgifterna'], ['Överföring', 'Egen överföring', 'räknas inte alls']]

const ticker = computed(() => {
  const c = cur.value, p = prev.value || {}
  const avgIncome = totalIncome.value / mon.value.length
  return [
    { l: `Inkomst · ${monthShort(props.month)}`, v: fmt(c.income), d: incomeNote.value || delta(c.income, p.income), c: 'var(--muted)' },
    { l: `Utgifter · ${monthShort(props.month)}`, v: fmt(c.spending), d: delta(c.spending, p.spending), c: c.spending > (p.spending ?? Infinity) ? 'var(--warm-text)' : 'var(--good-text)' },
    { l: `Resultat · ${monthShort(props.month)}`, v: signed(c.saved), d: `${mon.value.length} mån: ${signed(totalSaved.value)}`, c: c.saved < 0 ? 'var(--warm-text)' : 'var(--good-text)' },
    { l: 'Fasta kostnader / mån', v: fmt(fixedCost.value), d: props.data.subs.length ? `${Math.round(fixedCost.value / avgIncome * 100)} % av inkomsten` : 'bekräfta under Prenumerationer', c: 'var(--muted)' },
    { l: 'Kassa + investerat', v: fmt((txs.value.at(-1)?.balance ?? 0) + invested.value), d: 'investerat till insatt belopp', c: 'var(--good-text)' },
  ]
})

const axis = (labels) => ({ type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: 'var(--muted)', fontWeight: 600 } })
const valueAxis = { type: 'value', splitLine: { lineStyle: { color: 'var(--line)', type: 'dashed' } }, axisLabel: { formatter: (v) => v / 1000 + 'k', color: 'var(--muted)' } }

const heroOption = computed(() => {
  let run = 0
  return {
    grid: { left: 0, right: 0, top: 8, bottom: 0 },
    xAxis: { type: 'category', data: months.value.map(monthShort), show: false, boundaryGap: false },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: { trigger: 'axis', valueFormatter: kr },
    series: [{ name: 'Sparat hittills', type: 'line', smooth: true, symbol: 'none', data: mon.value.map((r) => (run += r.saved)),
      lineStyle: { color: '#8FA2FF', width: 3 }, areaStyle: { color: 'rgba(51,85,255,.3)' } }],
  }
})

const barsOption = computed(() => ({
  grid: { left: 36, right: 0, top: 10, bottom: 24 },
  tooltip: { trigger: 'axis', valueFormatter: kr },
  xAxis: axis(months.value.map(monthShort)),
  yAxis: valueAxis,
  series: [
    { name: 'In', type: 'bar', barWidth: 14, barGap: '30%', data: mon.value.map((r) => Math.round(r.income)), itemStyle: { color: 'var(--accent)', borderRadius: 8 } },
    { name: 'Ut', type: 'bar', barWidth: 14, data: mon.value.map((r) => Math.round(r.spending)), itemStyle: { color: 'var(--warm)', borderRadius: 8 } },
  ],
}))

// Waterfall: income, the biggest spending categories floating down from the running total, then the result
const fallOption = computed(() => {
  const cats = byCategory(monthTx.value, ov.value)
  const steps = [['Inkomst', cur.value.income], ...(cur.value.refunds ? [['Återbetalt', cur.value.refunds]] : []), ...cats.slice(0, 4).map((c) => [c.category.split(' ')[0], -c.amount]), ['Övrigt', -sum(cats.slice(4).map((c) => c.amount))]]
  let run = 0
  const bars = steps.map(([l, v], i) => { const a = run; run += v; return { l, v, lo: Math.min(a, run), hi: Math.max(a, run), color: v > 0 ? (i ? 'var(--good)' : 'var(--accent)') : 'var(--warm)' } })
  bars.push({ l: 'Resultat', v: run, lo: Math.min(0, run), hi: Math.max(0, run), color: 'var(--ink)' })
  return {
    grid: { left: 36, right: 0, top: 24, bottom: 24 },
    tooltip: { formatter: (p) => `${bars[p.dataIndex].l}: ${signed(bars[p.dataIndex].v)} kr` },
    xAxis: { ...axis(bars.map((b) => b.l)), axisLabel: { color: 'var(--muted)', fontWeight: 600, fontSize: 11, interval: 0 } }, // every step named, even when 8 bars
    yAxis: valueAxis,
    series: [{
      type: 'custom', encode: { x: 0, y: [1, 2] },
      data: bars.map((b, i) => [i, b.lo, b.hi]),
      renderItem: (params, api) => {
        const i = api.value(0), b = bars[i]
        const lo = api.coord([i, b.lo]), hi = api.coord([i, b.hi]), w = api.size([1, 0])[0] * 0.6
        const below = b.v < 0 && i === bars.length - 1
        return { type: 'group', children: [
          { type: 'rect', shape: { x: lo[0] - w / 2, y: hi[1], width: w, height: Math.max(lo[1] - hi[1], 2), r: 10 }, style: { fill: resolveColor(b.color) } }, // renderItem output isn't passed through Chart's var() lookup
          { type: 'text', style: { text: signed(b.v), x: lo[0], y: below ? lo[1] + 6 : hi[1] - 6, align: 'center', verticalAlign: below ? 'top' : 'bottom', fill: resolveColor('var(--ink)'), font: "600 12px 'JetBrains Mono'" } },
        ] }
      },
    }],
  }
})

const heatOption = computed(() => {
  const d = daily(txs.value, ov.value, props.month)
  return {
    tooltip: { formatter: (p) => `${shortDate(p.value[0])}: ${kr(p.value[1])}` },
    visualMap: { show: false, type: 'piecewise', dimension: 1, pieces: [{ lt: 250, color: 'var(--heat-1)' }, { gte: 250, lt: 600, color: 'var(--heat-2)' }, { gte: 600, lt: 2500, color: 'var(--heat-3)' }, { gte: 2500, color: 'var(--heat-4)' }] },
    calendar: { orient: 'vertical', range: props.month, top: 40, left: 4, right: 4, bottom: 4, cellSize: ['auto', 40],
      dayLabel: { firstDay: 1, nameMap: ['S', 'M', 'T', 'O', 'T', 'F', 'L'], color: 'var(--muted)', fontWeight: 600 }, monthLabel: { show: false }, yearLabel: { show: false },
      splitLine: { show: false }, itemStyle: { borderColor: 'var(--card)', borderWidth: 4, color: 'transparent' } },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', itemStyle: { borderRadius: 10 },
      data: d.map((v, i) => ({ value: [`${props.month}-${String(i + 1).padStart(2, '0')}`, Math.round(v)], label: { show: true, formatter: String(i + 1), color: v >= 600 ? '#fff' : 'var(--ink)', fontSize: 11 } })) }],
  }
})

const treeOption = computed(() => {
  const n = mon.value.length
  const colors = ['var(--hero)', 'var(--accent)', ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--tile-${n})`)]
  // Categories under 3% are too small to label, so they share one box
  const cats = byCategory(txs.value, ov.value), total = sum(cats.map((c) => c.amount))
  const big = cats.filter((c) => c.amount >= total * 0.03), small = cats.filter((c) => c.amount < total * 0.03)
  if (small.length) big.push({ category: small.length > 1 ? 'Mindre poster' : small[0].category, amount: sum(small.map((c) => c.amount)) })
  return {
    tooltip: { formatter: (p) => `${p.name}: ${kr(p.value)} / mån` },
    series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, top: 0, left: 0, right: 0, bottom: 0,
      itemStyle: { gapWidth: 6, borderRadius: 16, borderColor: 'var(--card)', borderWidth: 0 },
      label: { position: 'insideBottomLeft', padding: 12, formatter: (p) => `{b|${p.name}}\n${fmt(p.value)} kr`, rich: { b: { fontWeight: 700, fontSize: 14, lineHeight: 20 } } },
      data: big.map((c, i) => ({ name: c.category, value: Math.round(c.amount / n),
        itemStyle: { color: colors[i % colors.length] }, label: { color: i < 2 ? '#fff' : 'var(--ink)' } })) }],
  }
})

const accts = computed(() => (props.data.accounts ?? []).map((a) => ({ ...a, s: accountStats(txs.value, a, props.month) })))
const worth = computed(() => netWorthSeries(txs.value, props.data.accounts ?? []).filter((r) => r.month <= props.month))
const iskOption = computed(() => {
  let run = 0
  const rows = accts.value.length ? worth.value.map((r) => [r.month, Math.round(r.total)]) : mon.value.map((r) => [r.month, (run += r.invested)])
  return {
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    tooltip: { trigger: 'axis', valueFormatter: kr },
    xAxis: { type: 'category', data: rows.map((r) => monthShort(r[0])), show: false },
    yAxis: { type: 'value', show: false, scale: !!accts.value.length },
    series: [{ name: accts.value.length ? 'Nettoförmögenhet' : 'Insatt', type: 'bar', barWidth: '60%', data: rows.map((r) => r[1]), itemStyle: { color: 'var(--good)', borderRadius: 8 } }],
  }
})

const subs = computed(() => stats.value.filter((s) => s.kind === 'prenumeration'))
const doubleKeys = computed(() => new Set(warn.value.filter((a) => a.kind === 'double').flatMap((a) => a.keys)))
const recentTx = computed(() => monthTx.value.slice().reverse().filter((t) => t.amount < 0).slice(0, 8))
const ringDash = computed(() => { const C = 2 * Math.PI * 62; return `${(C * Math.max(0, Math.min(1, rate.value / goal.value))).toFixed(1)} ${C.toFixed(1)}` })
</script>

<template>
  <section aria-label="Nyckeltal" class="ticker">
    <div v-for="t in ticker" :key="t.l" class="tick">
      <span class="muted" style="font-size: 12px; font-weight: 600">{{ t.l }}</span>
      <span class="mono" style="font-size: 22px; font-weight: 600">{{ t.v }}</span>
      <span class="mono" :style="{ fontSize: '12px', color: t.c }">{{ t.d }}</span>
    </div>
  </section>

  <section class="grid">
    <div class="card hero span2">
      <div style="font-size: 14px; color: #B9B9C2; font-weight: 600">Sparat sedan {{ monthShort(months[0]) }}</div>
      <div class="big">{{ signed(totalSaved) }} <span>kr</span></div>
      <Chart :option="heroOption" :height="90" label="Ackumulerat sparande över tid" style="margin-top: auto" />
    </div>

    <div class="card" style="align-items: center">
      <div class="muted" style="align-self: flex-start; font-size: 14px; font-weight: 600">Sparkvot</div>
      <div style="position: relative; width: 150px; height: 150px">
        <svg role="img" :aria-label="`Sparkvot ${Math.round(rate * 100)} procent av målet ${Math.round(goal * 100)} procent`" viewBox="0 0 150 150" style="width: 150px; height: 150px; transform: rotate(-90deg)">
          <circle cx="75" cy="75" r="62" fill="none" stroke="var(--line)" stroke-width="16" />
          <circle cx="75" cy="75" r="62" fill="none" stroke="var(--warm)" stroke-width="16" stroke-linecap="round" :stroke-dasharray="ringDash" />
        </svg>
        <div class="ring-label"><b>{{ Math.round(rate * 100) }} %</b><span class="muted">mål {{ Math.round(goal * 100) }} %</span></div>
      </div>
      <div class="muted" style="font-size: 13px; text-align: center">
        <template v-if="extraNeeded > 0">Spara {{ fmt(Math.ceil(extraNeeded / 100) * 100) }} kr mer per månad för att nå målet</template>
        <template v-else>Du ligger i fas</template>
      </div>
    </div>

    <div class="card" style="background: var(--warm-soft); gap: 10px">
      <h2>Värt att kolla</h2>
      <component :is="a.kind === 'suggest' ? 'button' : 'div'" v-for="a in warn.slice(0, 4)" :key="a.title + a.body" class="alert" @click="a.kind === 'suggest' && $emit('go-subs')">
        <div style="font-weight: 700; font-size: 14px">{{ a.title }}</div>
        <div class="muted" style="font-size: 12px; margin-top: 4px">{{ a.body }}</div>
        <button v-if="a.kind === 'transfer'" class="btn small" style="margin-top: 8px" @click="emit('override', a.key, 'Överföring')">Markera som överföring</button>
      </component>
      <div v-if="!warn.length" class="muted" style="font-size: 13px">Inget konstigt just nu.</div>
    </div>

    <div class="card span2">
      <div class="row"><h2>Kassaflöde {{ monthShort(month) }}</h2><span class="muted" style="font-size: 13px">inkomst → utgifter → resultat</span></div>
      <Chart :option="fallOption" :height="270" :label="`Vattenfall över inkomst och utgifter för ${month}`" />
      <details class="incoming" :open="!!incomeNote">
        <summary>Pengar in i {{ monthShort(month) }} · {{ fmt(sum(incoming.map((r) => r.amount))) }} kr från {{ incoming.length }} avsändare</summary>
        <p class="muted" style="margin: 6px 0; font-size: 12px">Bara lön och övrig inkomst räknas som inkomst. Återbetalningar (t.ex. Swish från vänner) minskar utgifterna, egna överföringar räknas inte. Valet gäller avsändaren även framåt.</p>
        <table>
          <tbody>
            <tr v-for="r in incoming" :key="r.key">
              <td style="font-weight: 600">{{ r.name }}</td>
              <td>
                <label class="sr-only" :for="'in' + r.key">Räkna {{ r.name }} som</label>
                <select :id="'in' + r.key" class="pill" style="border: 0" :value="r.kind" @change="emit('override', r.key, $event.target.value)">
                  <option v-for="k in KINDS" :key="k[0]" :value="k[0]">{{ k[1] }} ({{ k[2] }})</option>
                </select>
              </td>
              <td class="num">{{ fmt(r.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>

    <div class="card span2">
      <div class="row"><h2>Inkomster och utgifter</h2>
        <div class="muted legend"><span><i style="background: var(--accent)"></i>In</span><span><i style="background: var(--warm)"></i>Ut</span></div>
      </div>
      <Chart :option="barsOption" :height="270" label="Inkomster och utgifter per månad" />
    </div>

    <div class="card span2">
      <div class="row"><h2>Portfölj</h2><button class="btn ghost" @click="$emit('go-invest')">{{ accts.length ? 'Visa alla →' : '+ Lägg till konto' }}</button></div>
      <div style="display: flex; gap: 24px; align-items: flex-end; flex-wrap: wrap">
        <div v-if="accts.length"><div class="muted" style="font-size: 13px; font-weight: 600">Nettoförmögenhet</div><div class="mono" style="font-size: 32px; font-weight: 600">{{ fmt(worth.at(-1).total) }} kr</div></div>
        <div v-else><div class="muted" style="font-size: 13px; font-weight: 600">Investerat, insatt</div><div class="mono" style="font-size: 32px; font-weight: 600">{{ fmt(invested) }} kr</div></div>
        <Chart :option="iskOption" :height="110" :label="accts.length ? 'Nettoförmögenhet per månad' : 'Ackumulerat investerat per månad'" style="flex: 1; min-width: 200px; width: auto" />
      </div>
      <table v-if="accts.length">
        <thead><tr><th>Konto</th><th class="num">Värde</th><th class="num">Avkastning</th></tr></thead>
        <tbody>
          <tr v-for="a in accts" :key="a.name"><td style="font-weight: 600">{{ a.name }}</td><td class="num">{{ fmt(a.s.value) }}</td>
            <td class="num" :class="{ muted: a.s.estimated }" :style="{ color: a.s.estimated ? '' : a.s.gain >= 0 ? 'var(--good-text)' : 'var(--warm-text)' }">{{ a.s.estimated ? 'ange värde' : signed(a.s.gain) }}</td></tr>
        </tbody>
      </table>
      <p v-else class="muted" style="margin: 0; font-size: 13px">Lägg till ditt ISK och andra sparkonton under Investeringar för att följa värde, avkastning och nettoförmögenhet.</p>
    </div>

    <div class="card span2">
      <div class="row"><h2>{{ monthShort(month) }}, dag för dag</h2><span class="heat-legend muted" aria-label="Färgskala: svagare färg betyder mindre spenderat, starkare mer">Mindre <i style="background: var(--heat-1)"></i><i style="background: var(--heat-2)"></i><i style="background: var(--heat-3)"></i><i style="background: var(--heat-4)"></i> Mer</span></div>
      <Chart :option="heatOption" :height="280" :label="`Kalender över daglig spendering i ${month}`" />
    </div>

    <div class="card span3">
      <div class="row"><h2>Transaktioner</h2><a href="#" @click.prevent="$emit('show-all')" style="font-weight: 700; font-size: 14px">Alla {{ monthTx.length }} i {{ monthShort(month) }} →</a></div>
      <div style="overflow-x: auto">
        <table>
          <thead><tr><th>Datum</th><th>Mottagare</th><th>Kategori</th><th class="num">Belopp</th></tr></thead>
          <tbody>
            <tr v-for="t in recentTx" :key="txKey(t)">
              <td class="mono muted">{{ shortDate(t.date) }}</td>
              <td style="font-weight: 600">{{ displayName(t.text) }}<span v-if="doubleKeys.has(txKey(t))" class="flag">möjlig dubbelbetalning</span></td>
              <td><span class="pill">{{ categorize(t.text, ov) }}</span></td>
              <td class="num">{{ t.amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 }) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="gap: 10px">
      <div class="row"><h2>Prenumerationer</h2><span class="mono muted" style="font-size: 13px">{{ fmt(sum(subs.map((s) => s.monthlyCost)) * 12) }}/år</span></div>
      <div v-for="s in subs" :key="s.name" class="sub">
        <span style="font-size: 13px; font-weight: 600">{{ s.name }}</span>
        <Spark :values="s.prices" :color="s.price > Math.min(...s.prices) ? 'var(--warm)' : '#B9B9C2'" />
        <span class="mono" :style="{ fontSize: '13px', textAlign: 'right', color: s.price > Math.min(...s.prices) ? 'var(--warm-text)' : 'var(--ink)' }">{{ fmt(s.price) }}</span>
      </div>
      <div v-if="!subs.length" class="muted" style="font-size: 13px">Inga bekräftade än. <a href="#" @click.prevent="$emit('go-subs')">Granska förslagen →</a></div>
    </div>

    <div class="card span4">
      <h2>Vart pengarna går <span class="muted" style="font-weight: 500; font-size: 14px">· snitt per månad</span></h2>
      <Chart :option="treeOption" :height="220" label="Genomsnittlig månadsspendering per kategori" />
    </div>
  </section>
</template>

<style scoped>
.ticker { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.tick { background: var(--card); border-radius: 20px; padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; }
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.span2 { grid-column: span 2; } .span3 { grid-column: span 3; } .span4 { grid-column: span 4; }
.hero { background: var(--hero); color: #fff; min-height: 250px; }
.big { font-size: 64px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
.big span { font-size: 28px; color: #B9B9C2; }
.ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; }
.ring-label b { font-size: 34px; font-weight: 800; }
.heat-legend { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; }
.heat-legend i { width: 14px; height: 14px; border-radius: 4px; }
.incoming summary { cursor: pointer; font-size: 13px; font-weight: 700; color: var(--link); }
.btn.small { height: 32px; padding: 0 14px; font-size: 12px; }
.alert { background: var(--card); border-radius: 16px; padding: 12px 14px; border: 0; text-align: left; }
.legend { display: flex; gap: 14px; font-size: 13px; }
.legend span { display: flex; align-items: center; gap: 6px; }
.legend i { width: 10px; height: 10px; border-radius: 5px; }
.sub { display: grid; grid-template-columns: 1fr 60px 44px; align-items: center; gap: 10px; padding: 4px 0; }
@media (max-width: 1100px) {
  .ticker { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .span3, .span4 { grid-column: span 2; }
}
</style>
