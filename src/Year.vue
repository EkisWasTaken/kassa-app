<script setup>
import { computed, ref, watch } from 'vue'
import Chart from './Chart.vue'
import { yearSummary, categoryMatrix, yearsIn, fmt } from './logic.js'

const props = defineProps({ data: Object })
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const COLORS = ['var(--chart-neutral)', 'var(--accent)', 'var(--warm)', 'var(--c5)', 'var(--c4)', 'var(--c6)', 'var(--faint)'] // green is kept for the income line

const years = computed(() => yearsIn(props.data.tx))
const year = ref(+years.value.at(-1))
watch(years, (y) => { if (!y.includes(String(year.value))) year.value = +y.at(-1) })

const cur = computed(() => yearSummary(props.data.tx, props.data.overrides, year.value))
const prev = computed(() => yearSummary(props.data.tx, props.data.overrides, year.value - 1))
const hasPrev = computed(() => prev.value.monthsWithData > 0)
const matrix = computed(() => categoryMatrix(props.data.tx, props.data.overrides, year.value))
const prevByCat = computed(() => Object.fromEntries(categoryMatrix(props.data.tx, props.data.overrides, year.value - 1).map((c) => [c.category, c.total])))

const signed = (n) => (n > 0 ? '+' : '') + fmt(n)
const pct = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs((a / b - 1) * 100).toFixed(0)} % mot ${year.value - 1}` : '')
const kpis = computed(() => {
  const c = cur.value, p = prev.value
  return [
    { l: 'Inkomster', v: fmt(c.income), d: hasPrev.value ? pct(c.income, p.income) : '' },
    { l: 'Utgifter', v: fmt(c.spending), d: hasPrev.value ? pct(c.spending, p.spending) : '' },
    { l: 'Sparat', v: signed(c.saved), d: hasPrev.value ? `${year.value - 1}: ${signed(p.saved)}` : '' },
    { l: 'Sparkvot', v: Math.round(c.rate * 100) + ' %', d: hasPrev.value ? `${year.value - 1}: ${Math.round(p.rate * 100)} %` : '' },
    { l: 'Investerat', v: fmt(c.invested), d: `${c.monthsWithData} månader med data` },
  ]
})

const kr = (v) => fmt(v) + ' kr'
const axis = { type: 'category', data: MONTHS, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: 'var(--muted)', fontWeight: 600 } }
const valueAxis = { type: 'value', splitLine: { lineStyle: { color: 'var(--line)', type: 'dashed' } }, axisLabel: { formatter: (v) => v / 1000 + 'k', color: 'var(--muted)' } }

// Top 6 categories get their own colour, the rest stack as "Övriga"
const stackOption = computed(() => {
  const top = matrix.value.slice(0, 6), rest = matrix.value.slice(6)
  const series = top.map((c, i) => ({ name: c.category, type: 'bar', stack: 'ut', barWidth: 22, data: c.byMonth.map(Math.round), itemStyle: { color: COLORS[i] } }))
  if (rest.length) series.push({ name: 'Övriga', type: 'bar', stack: 'ut', data: MONTHS.map((_, m) => Math.round(rest.reduce((s, c) => s + c.byMonth[m], 0))), itemStyle: { color: COLORS[6], borderRadius: [6, 6, 0, 0] } })
  series.push({ name: 'Inkomst', type: 'line', symbol: 'circle', symbolSize: 8, connectNulls: false, data: cur.value.months.map((r) => (r ? Math.round(r.income) : null)), lineStyle: { color: 'var(--good)', width: 2, type: 'dashed' }, itemStyle: { color: 'var(--good)' } })
  return {
    grid: { left: 40, right: 8, top: 40, bottom: 24 },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: 'var(--muted)', fontWeight: 600 } },
    tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '–' : kr(v)) },
    xAxis: axis, yAxis: valueAxis, series,
  }
})

const cumulative = (s) => { let run = 0; return s.months.map((r) => (r ? (run += r.saved) : null)) }
const savedOption = computed(() => ({
  grid: { left: 40, right: 8, top: 36, bottom: 24 },
  legend: { top: 0, left: 0, textStyle: { color: 'var(--muted)', fontWeight: 600 } },
  tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '–' : kr(v)) },
  xAxis: { ...axis, boundaryGap: false }, yAxis: valueAxis,
  series: [
    { name: String(year.value), type: 'line', smooth: true, symbol: 'none', data: cumulative(cur.value), lineStyle: { color: 'var(--accent)', width: 3 }, areaStyle: { color: 'rgba(51,85,255,.15)' }, itemStyle: { color: 'var(--accent)' } },
    ...(hasPrev.value ? [{ name: String(year.value - 1), type: 'line', smooth: true, symbol: 'none', data: cumulative(prev.value), lineStyle: { color: 'var(--faint)', width: 2, type: 'dashed' }, itemStyle: { color: 'var(--faint)' } }] : []),
  ],
}))
</script>

<template>
  <div class="row">
    <h2 style="font-size: 24px">Året {{ year }}</h2>
    <label v-if="years.length > 1" class="pill" style="padding: 8px 14px; background: var(--card)">
      <span class="sr-only">År</span>
      <select v-model="year" style="border: 0; background: transparent; font-weight: 700"><option v-for="y in years.slice().reverse()" :key="y" :value="+y">{{ y }}</option></select>
    </label>
  </div>

  <section aria-label="Årets nyckeltal" class="ticker">
    <div v-for="k in kpis" :key="k.l" class="tick">
      <span class="muted" style="font-size: 12px; font-weight: 600">{{ k.l }}</span>
      <span class="mono" style="font-size: 22px; font-weight: 600">{{ k.v }}</span>
      <span class="mono muted" style="font-size: 12px">{{ k.d || ' ' }}</span>
    </div>
  </section>
  <p v-if="!hasPrev" class="muted" style="margin: -8px 0 0; font-size: 13px">Jämförelse med {{ year - 1 }} visas när du har importerat kontoutdrag därifrån.</p>

  <div class="card">
    <h2>Utgifter per kategori och månad</h2>
    <Chart :option="stackOption" :height="340" :label="`Staplade utgifter per kategori för varje månad ${year}, med inkomst som linje`" />
  </div>

  <div class="card">
    <h2>Sparat hittills i år</h2>
    <Chart :option="savedOption" :height="240" :label="`Ackumulerat sparande under ${year}`" />
  </div>

  <div class="card">
    <h2>Kategorier månad för månad</h2>
    <div style="overflow-x: auto">
      <table class="matrix">
        <thead><tr><th>Kategori</th><th v-for="m in MONTHS" :key="m" class="num">{{ m }}</th><th class="num">Totalt</th><th class="num">Snitt/mån</th><th v-if="hasPrev" class="num">mot {{ year - 1 }}</th></tr></thead>
        <tbody>
          <tr v-for="c in matrix" :key="c.category">
            <td style="font-weight: 600; white-space: nowrap">{{ c.category }}</td>
            <td v-for="(v, m) in c.byMonth" :key="m" class="num" :class="{ muted: !v }">{{ v ? fmt(v) : '–' }}</td>
            <td class="num" style="font-weight: 600">{{ fmt(c.total) }}</td>
            <td class="num">{{ fmt(c.total / Math.max(1, cur.monthsWithData)) }}</td>
            <td v-if="hasPrev" class="num" :style="{ color: c.total > (prevByCat[c.category] ?? 0) ? 'var(--warm-text)' : 'var(--good-text)' }">{{ signed(c.total - (prevByCat[c.category] ?? 0)) }}</td>
          </tr>
          <tr v-if="cur.refunds">
            <td style="font-weight: 600; white-space: nowrap; color: var(--good-text)">Återbetalningar</td>
            <td v-for="(r, m) in cur.months" :key="m" class="num" style="color: var(--good-text)">{{ r?.refunds ? '−' + fmt(r.refunds) : '–' }}</td>
            <td class="num" style="font-weight: 600; color: var(--good-text)">−{{ fmt(cur.refunds) }}</td>
            <td class="num" style="color: var(--good-text)">−{{ fmt(cur.refunds / Math.max(1, cur.monthsWithData)) }}</td>
            <td v-if="hasPrev" class="num"></td>
          </tr>
          <tr class="sum">
            <td>Totalt</td>
            <td v-for="(r, m) in cur.months" :key="m" class="num">{{ r ? fmt(r.spending) : '–' }}</td>
            <td class="num">{{ fmt(cur.spending) }}</td>
            <td class="num">{{ fmt(cur.spending / Math.max(1, cur.monthsWithData)) }}</td>
            <td v-if="hasPrev" class="num">{{ signed(cur.spending - prev.spending) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.ticker { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.tick { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; }
.matrix td, .matrix th { padding-left: 10px; font-size: 12px; }
.matrix .sum td { font-weight: 700; border-top: 2px solid var(--ink); }
@media (max-width: 1100px) { .ticker { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
