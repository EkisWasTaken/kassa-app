<script setup>
import { computed, ref } from 'vue'
import { CATEGORIES, categorize, chosenCategory, merchant, displayName, monthOf, txKey, shiftMonth, monthLong } from './logic.js'

const props = defineProps({ txs: Array, overrides: Object, query: String, month: String })
const emit = defineEmits(['override', 'move'])
const onlyMonth = ref(true)

const rows = computed(() => {
  const q = (props.query || '').toLowerCase()
  return props.txs
    .filter((t) => (!onlyMonth.value || monthOf(t) === props.month) && (!q || t.text.toLowerCase().includes(q) || displayName(t.text).toLowerCase().includes(q) || categorize(t.text, props.overrides).toLowerCase().includes(q)))
    .slice().reverse()
})
const total = computed(() => rows.value.reduce((s, t) => s + t.amount, 0))
const booked = (t) => t.date.slice(0, 7)
const monthChoices = (t) => [-1, 0, 1].map((n) => shiftMonth(booked(t), n))
const moved = (t) => monthOf(t) !== booked(t)
</script>

<template>
  <div class="card">
    <div class="row">
      <h2>Transaktioner <span class="muted" style="font-weight: 500; font-size: 14px">· {{ rows.length }} rader · netto {{ Math.round(total).toLocaleString('sv-SE') }} kr</span></h2>
      <label style="display: flex; gap: 8px; align-items: center; font-size: 14px; font-weight: 600"><input type="checkbox" v-model="onlyMonth"> Bara vald månad</label>
    </div>
    <p class="muted" style="margin: 0; font-size: 13px">Ändrar du kategori gäller det alla transaktioner från den mottagaren, även i framtida importer. Välj "Överföring" för pengar mellan dina egna konton så räknas de inte som inkomst eller utgift. Kom en betalning några dagar sent, till exempel hyran, kan du välja vilken månad den räknas till.</p>
    <div style="overflow-x: auto">
      <table>
        <thead><tr><th>Datum</th><th>Mottagare</th><th>Banktext</th><th>Kategori</th><th>Räknas till</th><th class="num">Belopp</th></tr></thead>
        <tbody>
          <tr v-for="t in rows" :key="txKey(t)">
            <td class="mono muted">{{ t.date }}</td>
            <td style="font-weight: 600">{{ displayName(t.text) }}<span v-if="moved(t)" class="moved">flyttad</span></td>
            <td class="muted" style="font-size: 12px">{{ t.text }}</td>
            <td>
              <label class="sr-only" :for="'c' + txKey(t)">Kategori för {{ displayName(t.text) }}</label>
              <select :id="'c' + txKey(t)" class="pill" :class="{ unset: !chosenCategory(t.text, overrides) }" style="border: 0" :value="chosenCategory(t.text, overrides)" @change="emit('override', merchant(t.text), $event.target.value)">
                <option value="" disabled>Välj kategori…</option>
                <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
              </select>
            </td>
            <td>
              <label class="sr-only" :for="'m' + txKey(t)">Månad som {{ displayName(t.text) }} räknas till</label>
              <select :id="'m' + txKey(t)" class="pill" :class="{ shifted: moved(t) }" style="border: 0" :value="monthOf(t)" @change="emit('move', txKey(t), $event.target.value === booked(t) ? null : $event.target.value)">
                <option v-for="m in monthChoices(t)" :key="m" :value="m">{{ monthLong(m) }}</option>
              </select>
            </td>
            <td class="num" :style="{ color: t.amount > 0 ? 'var(--good-text)' : 'var(--ink)' }">{{ t.amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 }) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.moved { margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--link); font-size: 11px; font-weight: 700; }
.pill.shifted { background: var(--accent-soft); color: var(--link); }
</style>
