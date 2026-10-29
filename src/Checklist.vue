<script setup>
import { computed } from 'vue'
import { checklist, displayName, merchant, fmt, shortDate, monthLong, txKey, CATEGORIES } from './logic.js'

const props = defineProps({ data: Object, month: String })
const emit = defineEmits(['go', 'toggle', 'override', 'move'])

const checked = computed(() => props.data.checked?.[props.month] ?? [])
const items = computed(() => checklist(props.data.tx, props.data.overrides, props.data.subs, props.data.dismissed, props.month, props.data.budgets, props.data.accounts)
  .map((i) => ({ ...i, done: i.count === 0 || (i.manual && checked.value.includes(i.id)) })))
const doneCount = computed(() => items.value.filter((i) => i.done).length)
</script>

<template>
  <div class="card">
    <div class="row">
      <h2>Månadskoll · {{ monthLong(month) }}</h2>
      <span class="mono" :style="{ color: doneCount === items.length ? 'var(--good-text)' : 'var(--muted)', fontWeight: 600 }">{{ doneCount }} av {{ items.length }} klara</span>
    </div>
    <div class="bar" role="progressbar" :aria-valuenow="doneCount" aria-valuemin="0" :aria-valuemax="items.length" aria-label="Framsteg"><i :style="{ width: (doneCount / items.length * 100) + '%' }"></i></div>
    <p v-if="doneCount === items.length" style="margin: 0; font-weight: 600; color: var(--good-text)">Allt granskat för {{ monthLong(month).toLowerCase() }}. Bra jobbat!</p>
    <p v-else class="muted" style="margin: 0; font-size: 13px">Gå igenom det här efter varje import. Punkterna bockas av automatiskt när det inte finns något kvar att titta på.</p>
  </div>

  <div v-for="i in items" :key="i.id" class="card item" :class="{ done: i.done }">
    <div class="row" style="flex-wrap: nowrap">
      <div style="display: flex; gap: 14px; align-items: center">
        <span class="tick" aria-hidden="true">
          <svg v-if="i.done" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M5 12l5 5 9-10" /></svg>
        </span>
        <div>
          <div style="font-weight: 700; font-size: 15px">{{ i.title }}</div>
          <div class="muted" style="font-size: 13px">{{ i.count === 0 ? 'Inget att göra' : i.count + ' att titta på' }}<span v-if="i.done && i.count"> · markerad som kollad</span></div>
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center; flex: none">
        <button v-if="i.go && i.count" class="btn small" @click="emit('go', i.go, i.query)">Öppna</button>
        <label v-if="i.manual && i.count" class="check"><input type="checkbox" :checked="i.done" @change="emit('toggle', month, i.id)"> Jag har kollat</label>
      </div>
    </div>
    <ul v-if="i.count && (i.items || i.details || i.late)" class="list">
      <li v-for="t in (i.items || []).slice(0, i.id === 'other' ? 25 : 8)" :key="txKey(t)"><span class="mono muted">{{ shortDate(t.date) }}</span> <b>{{ displayName(t.text) }}</b> <span class="mono">{{ fmt(t.amount) }} kr</span>
        <template v-if="i.id === 'other'">
          <label class="sr-only" :for="'k' + txKey(t)">Kategori för {{ displayName(t.text) }}</label>
          <select :id="'k' + txKey(t)" class="pill unset" style="border: 0; margin-left: 6px" value="" @change="emit('override', merchant(t.text), $event.target.value)">
            <option value="" disabled>Välj kategori…</option>
            <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
          </select>
        </template>
      </li>
      <li v-if="(i.items || []).length > (i.id === 'other' ? 25 : 8)" class="muted">… och {{ i.items.length - (i.id === 'other' ? 25 : 8) }} till, se Transaktioner</li>
      <li v-for="d in i.details || []" :key="d.title + d.body"><b>{{ d.title }}</b> <span class="muted">{{ d.body }}</span></li>
      <li v-for="l in i.late || []" :key="txKey(l.tx)" class="late">
        <span><b>{{ displayName(l.tx.text) }} {{ shortDate(l.tx.date) }}, {{ fmt(-l.tx.amount) }} kr</b> <span class="muted">{{ monthLong(l.to).split(' ')[0] }} saknar betalningen och {{ monthLong(l.from).split(' ')[0].toLowerCase() }} har två. Ska den räknas till {{ monthLong(l.to).split(' ')[0].toLowerCase() }}?</span></span>
        <span style="display: flex; gap: 6px; flex: none">
          <button class="btn tiny" @click="emit('move', txKey(l.tx), l.to)">Flytta till {{ monthLong(l.to).split(' ')[0].toLowerCase() }}</button>
          <button class="btn ghost tiny" @click="emit('move', txKey(l.tx), l.from)">Behåll i {{ monthLong(l.from).split(' ')[0].toLowerCase() }}</button>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bar { height: 10px; border-radius: 5px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--good); border-radius: 5px; transition: width .3s; }
.item { gap: 10px; padding: 18px 24px; }
.item.done { opacity: .65; }
.tick { width: 28px; height: 28px; border-radius: 14px; border: 2px solid var(--field-border); display: flex; align-items: center; justify-content: center; flex: none; }
.done .tick { background: var(--good); border-color: var(--good); }
.btn.small { height: 36px; padding: 0 16px; font-size: 13px; }
.check { display: flex; gap: 6px; align-items: center; font-size: 13px; font-weight: 600; white-space: nowrap; }
.late { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.btn.tiny { height: 30px; padding: 0 12px; font-size: 12px; }
.list { margin: 0 0 0 42px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
</style>
