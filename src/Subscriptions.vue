<script setup>
import { computed } from 'vue'
import Spark from './Spark.vue'
import { subscriptionStats, suggestions, fmt, shortDate, CATEGORIES } from './logic.js'

const props = defineProps({ data: Object })
const emit = defineEmits(['add', 'dismiss', 'undismiss', 'update', 'remove'])

const stats = computed(() => subscriptionStats(props.data.tx, props.data.subs).map((s, i) => ({ ...s, i })))
const sugg = computed(() => suggestions(props.data.tx, props.data.subs, props.data.dismissed))
const groups = computed(() => [
  { name: 'Prenumerationer', items: stats.value.filter((s) => s.active && s.kind === 'prenumeration') },
  { name: 'Fasta kostnader', items: stats.value.filter((s) => s.active && s.kind === 'fast') },
  { name: 'Avslutade', items: stats.value.filter((s) => !s.active), hint: 'Ingen dragning på länge. Dyker den upp igen blir den aktiv automatiskt.' },
])
const perYear = (items) => fmt(items.reduce((s, r) => s + r.monthlyCost, 0) * 12)
</script>

<template>
  <div v-if="sugg.length" class="card" style="background: var(--warm-soft)">
    <div class="row"><h2>Förslag att granska <span class="muted" style="font-weight: 500; font-size: 14px">· {{ sugg.length }} st</span></h2></div>
    <p class="muted" style="margin: 0; font-size: 13px">Bara det du lägger till räknas i statistiken. Det du avvisar föreslås aldrig igen.</p>
    <div style="overflow-x: auto">
      <table>
        <thead><tr><th>Namn</th><th>Varför</th><th class="num">Månader</th><th class="num">Senast</th><th class="num">Pris</th><th></th></tr></thead>
        <tbody>
          <tr v-for="s in sugg" :key="s.name">
            <td style="font-weight: 600">{{ s.name }}</td>
            <td><span class="pill" style="background: var(--card)">{{ s.reason }}</span></td>
            <td class="num muted">{{ s.monthsSeen }}</td>
            <td class="num muted">{{ shortDate(s.last) }}</td>
            <td class="num">{{ fmt(s.price) }} kr</td>
            <td style="text-align: right; white-space: nowrap">
              <button class="btn small" @click="emit('add', s)">Lägg till</button>
              <button class="btn small ghost" @click="emit('dismiss', s.name)">Inte en prenumeration</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-for="g in groups" :key="g.name" class="card">
    <div class="row"><h2>{{ g.name }}</h2><span v-if="g.name !== 'Avslutade'" class="mono muted">{{ perYear(g.items) }} kr/år</span></div>
    <p v-if="g.hint" class="muted" style="margin: 0; font-size: 13px">{{ g.hint }}</p>
    <div style="overflow-x: auto">
      <table>
        <thead><tr><th>Namn</th><th>Typ</th><th>Debiteras</th><th>Kategori</th><th style="width: 120px">Prishistorik</th><th class="num">Senast</th><th class="num">Pris</th><th class="num">Per år</th><th></th></tr></thead>
        <tbody>
          <tr v-for="s in g.items" :key="s.i">
            <td>
              <label class="sr-only" :for="'n' + s.i">Namn</label>
              <input :id="'n' + s.i" class="name" :value="s.name" @change="emit('update', s.i, { name: $event.target.value.trim() || s.name })">
            </td>
            <td>
              <label class="sr-only" :for="'k' + s.i">Typ för {{ s.name }}</label>
              <select :id="'k' + s.i" class="pill" style="border: 0" :value="s.kind" @change="emit('update', s.i, { kind: $event.target.value })">
                <option value="prenumeration">Prenumeration</option><option value="fast">Fast kostnad</option>
              </select>
            </td>
            <td>
              <label class="sr-only" :for="'c' + s.i">Debiteras för {{ s.name }}</label>
              <select :id="'c' + s.i" class="pill" style="border: 0" :value="s.cycle" @change="emit('update', s.i, { cycle: $event.target.value })">
                <option value="månad">Varje månad</option><option value="år">Varje år</option>
              </select>
            </td>
            <td>
              <label class="sr-only" :for="'g' + s.i">Kategori för {{ s.name }}</label>
              <select :id="'g' + s.i" class="pill" style="border: 0" :value="s.category" @change="emit('update', s.i, { category: $event.target.value })">
                <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
              </select>
            </td>
            <td><Spark v-if="s.prices.length" :values="s.prices" :color="s.price > Math.min(...s.prices) ? 'var(--warm)' : '#B9B9C2'" /></td>
            <td class="num muted">{{ s.last ? shortDate(s.last) : '–' }}</td>
            <td class="num">{{ fmt(s.price) }}</td>
            <td class="num">{{ fmt(s.monthlyCost * 12) }}</td>
            <td style="text-align: right"><button class="btn small ghost" :aria-label="'Ta bort ' + s.name" @click="emit('remove', s.i)">Ta bort</button></td>
          </tr>
          <tr v-if="!g.items.length"><td colspan="9" class="muted">Inget här än.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="data.dismissed.length" class="card">
    <h2>Avvisade</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 8px">
      <span v-for="n in data.dismissed" :key="n" class="pill" style="display: inline-flex; gap: 8px; align-items: center">{{ n }}
        <button class="link-btn" :aria-label="'Ångra avvisning av ' + n" @click="emit('undismiss', n)">Ångra</button></span>
    </div>
  </div>
</template>

<style scoped>
.btn.small { height: 32px; padding: 0 14px; font-size: 13px; margin-left: 6px; }
.name { border: 1px solid transparent; background: transparent; font-weight: 600; padding: 4px 6px; border-radius: 8px; width: 100%; min-width: 160px; }
.name:hover, .name:focus { border-color: var(--field-border); background: var(--input-bg); }
.link-btn { border: 0; background: none; color: var(--link); font-weight: 700; font-size: 12px; padding: 0; }
</style>
