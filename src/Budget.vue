<script setup>
import { computed, ref } from 'vue'
import { budgetStatus, suggestBudgets, goalPlan, byCategory, monthly, monthOf, monthLong, fmt, CATEGORIES } from './logic.js'

const props = defineProps({ data: Object, month: String })
const emit = defineEmits(['set-budgets', 'set-rate', 'add-goal', 'update-goal', 'remove-goal'])

const MONTHS_LONG = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const ym = (s) => `${MONTHS_LONG[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`
const today = new Date().toISOString().slice(0, 10)

const budgets = computed(() => props.data.budgets ?? {})
const status = computed(() => budgetStatus(props.data.tx, props.data.overrides, budgets.value, props.month))
const unbudgeted = computed(() => byCategory(props.data.tx.filter((t) => monthOf(t) === props.month), props.data.overrides).filter((c) => !(budgets.value[c.category] > 0)))
const totals = computed(() => ({ budget: status.value.reduce((s, b) => s + b.budget, 0), spent: status.value.reduce((s, b) => s + b.spent, 0) }))
const free = computed(() => CATEGORIES.filter((c) => !(budgets.value[c] > 0) && !['Överföring', 'Sparande'].includes(c)))

function setBudget(category, value) {
  const n = Math.max(0, Math.round(Number(String(value).replace(/\s/g, '').replace(',', '.')) || 0))
  emit('set-budgets', { ...budgets.value, [category]: n })
}
function suggest() {
  const s = suggestBudgets(props.data.tx, props.data.overrides)
  const merged = { ...budgets.value }
  for (const [c, v] of Object.entries(s)) if (!(merged[c] > 0)) merged[c] = v // never overwrite budgets you set yourself
  emit('set-budgets', merged)
}
const newCat = ref('')
function addBudget() { if (newCat.value) { setBudget(newCat.value, suggestBudgets(props.data.tx, props.data.overrides)[newCat.value] || 1000); newCat.value = '' } }

// Savings goals
const recentSaved = computed(() => { const m = monthly(props.data.tx, props.data.overrides).slice(-6); return m.reduce((s, r) => s + r.saved, 0) / Math.max(1, m.length) })
const goals = computed(() => (props.data.goals ?? []).map((g, i) => ({ ...g, i, plan: goalPlan(g, today, recentSaved.value) })))
const draft = ref({ name: '', target: '', saved: '', deadline: '' })
const num = (v) => Math.max(0, Math.round(Number(String(v).replace(/\s/g, '').replace(',', '.')) || 0))
function addGoal() {
  if (!draft.value.name.trim() || !num(draft.value.target)) return
  emit('add-goal', { name: draft.value.name.trim(), target: num(draft.value.target), saved: num(draft.value.saved), deadline: draft.value.deadline || null })
  draft.value = { name: '', target: '', saved: '', deadline: '' }
}
const deposit = ref({})
function addDeposit(g) {
  const n = Number(String(deposit.value[g.i] ?? '').replace(/\s/g, '').replace(',', '.'))
  if (!n) return
  emit('update-goal', g.i, { saved: Math.max(0, g.saved + Math.round(n)) }) // negative = withdrawal
  deposit.value[g.i] = ''
}
const avgExpenses = computed(() => { const m = monthly(props.data.tx, props.data.overrides); return m.reduce((s, r) => s + r.spending, 0) / Math.max(1, m.length) })
const rate = ref(Math.round(props.data.goal * 100))
const barColor =(s) => (s === 'over' ? 'var(--warm)' : s === 'warn' ? 'var(--c5)' : 'var(--good)')
</script>

<template>
  <div class="card">
    <div class="row">
      <h2>Budget per kategori</h2>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
        <span v-if="status.length" class="mono" style="font-weight: 600">{{ fmt(totals.spent) }} av {{ fmt(totals.budget) }} kr</span>
        <button class="btn small ghost" @click="suggest">Föreslå från snittet</button>
      </div>
    </div>
    <p v-if="!status.length" class="muted" style="margin: 0">Ingen budget än. Klicka "Föreslå från snittet" för att fylla i budgetar baserat på dina tre senaste månader, och justera sedan beloppen.</p>
    <p v-else-if="status[0].running" class="muted" style="margin: 0; font-size: 13px">Månaden pågår. Prognosen räknar fram var du hamnar vid månadens slut i samma takt.</p>

    <div v-for="b in status" :key="b.category" class="budget">
      <div class="row" style="flex-wrap: nowrap">
        <b style="font-size: 14px">{{ b.category }}</b>
        <div style="display: flex; align-items: center; gap: 10px">
          <span class="mono" style="font-size: 13px">{{ fmt(b.spent) }} /</span>
          <label class="sr-only" :for="'b' + b.category">Budget för {{ b.category }}</label>
          <input :id="'b' + b.category" class="amount mono" :value="b.budget" inputmode="numeric" @change="setBudget(b.category, $event.target.value)">
          <span class="muted" style="font-size: 13px">kr</span>
        </div>
      </div>
      <div class="bar" role="img" :aria-label="`${b.category}: ${fmt(b.spent)} av ${fmt(b.budget)} kronor`">
        <i :style="{ width: Math.min(100, b.spent / b.budget * 100) + '%', background: barColor(b.status) }"></i>
        <s v-if="b.running && b.projected > b.spent" :style="{ left: Math.min(100, b.spent / b.budget * 100) + '%', width: Math.max(0, Math.min(100, b.projected / b.budget * 100) - b.spent / b.budget * 100) + '%', background: barColor(b.status) }"></s>
      </div>
      <div class="muted" style="font-size: 12px">
        <template v-if="b.status === 'over'"><b style="color: var(--warm-text)">{{ fmt(-b.left) }} kr över budget</b></template>
        <template v-else>{{ fmt(b.left) }} kr kvar</template>
        <template v-if="b.running"> · prognos {{ fmt(b.projected) }} kr</template>
        <button class="link-btn" :aria-label="'Ta bort budget för ' + b.category" @click="setBudget(b.category, 0)">Ta bort</button>
      </div>
    </div>

    <div v-if="status.length" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
      <label class="sr-only" for="newcat">Lägg till budget för kategori</label>
      <select id="newcat" v-model="newCat" class="pill" style="border: 0; padding: 8px 12px">
        <option value="">Lägg till kategori…</option>
        <option v-for="c in free" :key="c">{{ c }}</option>
      </select>
      <button class="btn small ghost" :disabled="!newCat" @click="addBudget">Lägg till</button>
    </div>
    <p v-if="status.length && unbudgeted.length" class="muted" style="margin: 0; font-size: 13px">Utan budget i {{ monthLong(month).toLowerCase() }}: {{ unbudgeted.map((c) => `${c.category} ${fmt(c.amount)} kr`).join(' · ') }}</p>
  </div>

  <div class="card">
    <div class="row"><h2>Sparmål</h2><span class="muted" style="font-size: 13px">Din spartakt senaste 6 mån: <b class="mono">{{ fmt(recentSaved) }} kr/mån</b></span></div>
    <div class="goals">
      <div v-for="g in goals" :key="g.i" class="goal" :class="{ done: g.plan.done }">
        <div class="row" style="flex-wrap: nowrap"><b style="font-size: 16px">{{ g.name }}</b><button class="link-btn" :aria-label="'Ta bort sparmålet ' + g.name" @click="emit('remove-goal', g.i)">Ta bort</button></div>
        <div class="mono" style="font-size: 26px; font-weight: 600">{{ fmt(g.saved) }} <span class="muted" style="font-size: 14px">/ {{ fmt(g.target) }} kr</span></div>
        <div class="bar" role="img" :aria-label="`${Math.round(g.plan.progress * 100)} procent av målet`"><i :style="{ width: g.plan.progress * 100 + '%', background: 'var(--accent)' }"></i></div>
        <div class="muted" style="font-size: 13px; display: flex; flex-direction: column; gap: 2px">
          <span v-if="g.plan.done" style="color: var(--good-text); font-weight: 700">Målet är nått!</span>
          <template v-else>
            <span>{{ Math.round(g.plan.progress * 100) }} % · {{ fmt(g.plan.left) }} kr kvar</span>
            <span v-if="g.deadline">Spara {{ fmt(g.plan.perMonth) }} kr/mån för att nå det till {{ ym(g.deadline) }}</span>
            <span v-if="g.plan.eta">I din nuvarande takt: klart {{ ym(g.plan.eta) }}</span>
            <span v-else>Du sparar inget just nu, så det går inte att räkna fram när målet nås</span>
          </template>
        </div>
        <div v-if="!g.plan.done" style="display: flex; gap: 6px">
          <label class="sr-only" :for="'d' + g.i">Belopp att sätta in på {{ g.name }}</label>
          <input :id="'d' + g.i" v-model="deposit[g.i]" class="amount mono" placeholder="belopp" inputmode="numeric" @keydown.enter="addDeposit(g)">
          <button class="btn small" @click="addDeposit(g)">+ Sätt in</button>
        </div>
      </div>

      <form class="goal new" @submit.prevent="addGoal">
        <b style="font-size: 16px">Nytt sparmål</b>
        <label>Namn <input v-model="draft.name" placeholder="t.ex. Buffert" required></label>
        <label>Mål (kr) <input v-model="draft.target" class="mono" inputmode="numeric" :placeholder="'t.ex. ' + fmt(Math.round(avgExpenses * 3 / 1000) * 1000)" required></label>
        <label>Redan sparat (kr) <input v-model="draft.saved" class="mono" inputmode="numeric" placeholder="0"></label>
        <label>Klart senast (valfritt) <input v-model="draft.deadline" type="month"></label>
        <button class="btn small" type="submit">Skapa mål</button>
        <span class="muted" style="font-size: 12px">Tips: en buffert på tre månaders utgifter är ungefär {{ fmt(Math.round(avgExpenses * 3 / 1000) * 1000) }} kr för dig.</span>
      </form>
    </div>
  </div>

  <div class="card" style="max-width: 560px">
    <h2>Mål för sparkvot</h2>
    <p class="muted" style="margin: 0; font-size: 13px">Hur stor del av inkomsten du vill spara. Visas som ringen på översikten.</p>
    <label style="display: flex; align-items: center; gap: 12px; font-weight: 600">
      <span class="sr-only">Sparkvotsmål i procent</span>
      <input v-model.number="rate" type="range" min="0" max="50" step="1" style="flex: 1" @change="emit('set-rate', rate / 100)">
      <span class="mono" style="width: 48px; text-align: right">{{ rate }} %</span>
    </label>
  </div>
</template>

<style scoped>
.btn.small { height: 34px; padding: 0 14px; font-size: 13px; }
.budget { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid var(--line); }
.bar { position: relative; height: 12px; border-radius: 6px; background: var(--line); overflow: hidden; }
.bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; }
.bar s { position: absolute; top: 0; bottom: 0; opacity: .3; }
.amount { width: 90px; border: 1px solid var(--field-border); border-radius: 8px; padding: 4px 8px; text-align: right; background: var(--input-bg); }
.link-btn { border: 0; background: none; color: var(--link); font-weight: 700; font-size: 12px; padding: 0; margin-left: 10px; }
.goals { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.goal { background: var(--ground); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.goal.done { background: var(--good-soft); }
.goal.new label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--muted); }
.goal.new input { border: 1px solid var(--field-border); border-radius: 8px; padding: 8px 10px; background: var(--input-bg); color: var(--ink); font-size: 14px; }
</style>
