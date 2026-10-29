<script setup>
import { computed, ref } from 'vue'
import { CATEGORIES, categorize, chosenCategory, merchant, displayName, monthOf, txKey } from './logic.js'

const props = defineProps({ txs: Array, overrides: Object, query: String, month: String })
const emit = defineEmits(['override'])
const onlyMonth = ref(true)

const rows = computed(() => {
  const q = (props.query || '').toLowerCase()
  return props.txs
    .filter((t) => (!onlyMonth.value || monthOf(t) === props.month) && (!q || t.text.toLowerCase().includes(q) || displayName(t.text).toLowerCase().includes(q) || categorize(t.text, props.overrides).toLowerCase().includes(q)))
    .slice().reverse()
})
const total = computed(() => rows.value.reduce((s, t) => s + t.amount, 0))
</script>

<template>
  <div class="card">
    <div class="row">
      <h2>Transaktioner <span class="muted" style="font-weight: 500; font-size: 14px">· {{ rows.length }} rader · netto {{ Math.round(total).toLocaleString('sv-SE') }} kr</span></h2>
      <label style="display: flex; gap: 8px; align-items: center; font-size: 14px; font-weight: 600"><input type="checkbox" v-model="onlyMonth"> Bara vald månad</label>
    </div>
    <p class="muted" style="margin: 0; font-size: 13px">Ändrar du kategori gäller det alla transaktioner från den mottagaren, även i framtida importer. Välj "Överföring" för pengar mellan dina egna konton så räknas de inte som inkomst eller utgift.</p>
    <div style="overflow-x: auto">
      <table>
        <thead><tr><th>Datum</th><th>Mottagare</th><th>Banktext</th><th>Kategori</th><th class="num">Belopp</th></tr></thead>
        <tbody>
          <tr v-for="t in rows" :key="txKey(t)">
            <td class="mono muted">{{ t.date }}</td>
            <td style="font-weight: 600">{{ displayName(t.text) }}</td>
            <td class="muted" style="font-size: 12px">{{ t.text }}</td>
            <td>
              <label class="sr-only" :for="'c' + txKey(t)">Kategori för {{ displayName(t.text) }}</label>
              <select :id="'c' + txKey(t)" class="pill" :class="{ unset: !chosenCategory(t.text, overrides) }" style="border: 0" :value="chosenCategory(t.text, overrides)" @change="emit('override', merchant(t.text), $event.target.value)">
                <option value="" disabled>Välj kategori…</option>
                <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
              </select>
            </td>
            <td class="num" :style="{ color: t.amount > 0 ? 'var(--good-text)' : 'var(--ink)' }">{{ t.amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 }) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
