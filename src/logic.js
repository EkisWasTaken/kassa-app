// Pure analysis of Länsförsäkringar transactions. No DOM, so it runs under `node --test` too.
// A transaction is { date: 'YYYY-MM-DD' (booking date), text, amount, balance }.
// A confirmed recurring cost is { name, match: [UPPERCASE substrings], kind: 'prenumeration'|'fast', cycle: 'månad'|'år', category }.
import { PLANS } from './plans.js'

// First match wins. Keywords are matched against the upper-cased text.
export const RULES = [
  ['Boende', ['HYRA', 'HYRESV', 'FASTIGHET', 'BOSTAD', 'BRF ']],
  ['Försäkring & lån', ['LÄNSFÖRSÄKRINGAR', 'FOLKSAM', 'IF SKADE']],
  ['Sparande', ['ISK', 'SPARPLAN', 'FOND']],
  ['Prenumerationer', ['SPOTIFY', 'HBOMAX', 'WBDSPORTS', 'APPLE.COM/BILL', 'DISCORD', 'ANTHROPIC', 'CLAUDE.AI',
    'TV4', 'ZWIFT', 'NETFLIX', 'YOUTUBE', 'DISNEY', 'VIAPLAY', 'STORYTEL', 'AUDIBLE', 'OPENAI', 'AMAZON PRIME']],
  ['Telefon & internet', ['TELE2', 'TELIA', 'TELENOR', 'TRE ', 'HI3G', 'COMVIQ', 'HALEBOP', 'HALLON', 'BAHNHOF', 'BREDBAND']],
  ['Föreningar & träning', ['UNIONEN', 'A-KASSA', ' GK', 'GOLF', 'SATS', 'FRISKIS', 'NORDIC WELLNESS', 'ACTIC', 'FITNESS', 'GYM']],
  ['Mat', ['COOP', 'ICA', 'WILLYS', 'LIDL', 'HEMKÖP', 'CITY GROSS', 'NETTO', 'MATHEM', 'TEMPO']],
  ['Restaurang & café', ['MCD', 'MCDONALDS', 'MAX BURGERS', 'BURGER KING', 'ESPRESSO HOUSE', 'WAYNES', 'JOE & THE JUICE', 'JOE  THE JUICE', 'PRESSBYRAN', 'PIZZ', 'SUSHI', 'RESTAURANG', 'CAFE', 'FOODORA', 'WOLT']],
  ['Transport', ['CIRCLE K', 'OKQ8', 'ST1', 'BOLT', 'UBER', 'PREEM', 'SJ ', 'VÄSTTRAFIK', 'PARKERING', 'BESIKTNING']],
  ['Resor', ['AIRBNB', 'DUTY FREE', 'APT ', 'BOOKING', 'SAS ', 'RYANAIR']],
  ['Shopping', ['ZALANDO', 'STEAM', 'H&M', 'AMAZON', 'CLAS OHLSON', 'IKEA', 'ARKET', 'BLOCKET']],
  ['Återbetalning', ['SWISH FRÅN', 'SWISH FRAN']], // friends paying you back: lowers spending, isn't income
  ['Swish', ['SWISH']],
]
export const CATEGORIES = [...RULES.map((r) => r[0]), 'Räkningar', 'Lön', 'Överföring', 'Övrigt']
// Not spending: money moved to your own accounts or investments
const NOT_SPENDING = new Set(['Överföring', 'Sparande'])
// Everyday purchases that repeat but are never subscriptions
const NEVER_RECURRING = new Set([...NOT_SPENDING, 'Mat', 'Transport', 'Shopping', 'Restaurang & café', 'Resor', 'Swish'])
const PROCESSORS = new Set(['K', 'WL', 'PAYPAL_', 'ZETTLE_']) // Klarna etc: the real merchant comes after the "*"

// Known services: bank text patterns -> a real name. Only ever offered as suggestions.
export const SERVICES = [
  ['Spotify', ['SPOTIFY'], 'prenumeration', 'Prenumerationer'],
  ['Netflix', ['NETFLIX'], 'prenumeration', 'Prenumerationer'],
  ['HBO Max', ['HBOMAX', 'HBO MAX'], 'prenumeration', 'Prenumerationer'],
  ['WBD Sports (HBO Max-tillägg)', ['WBDSPORTS'], 'prenumeration', 'Prenumerationer'],
  ['Apple (iCloud/App Store)', ['APPLE.COM/BILL'], 'prenumeration', 'Prenumerationer'],
  ['Discord Nitro', ['DISCORD'], 'prenumeration', 'Prenumerationer'],
  ['Claude', ['ANTHROPIC', 'CLAUDE.AI'], 'prenumeration', 'Prenumerationer'],
  ['ChatGPT', ['OPENAI'], 'prenumeration', 'Prenumerationer'],
  ['TV4 Play', ['TV4'], 'prenumeration', 'Prenumerationer'],
  ['Zwift', ['ZWIFT'], 'prenumeration', 'Prenumerationer'],
  ['YouTube Premium', ['YOUTUBE'], 'prenumeration', 'Prenumerationer'],
  ['Disney+', ['DISNEY'], 'prenumeration', 'Prenumerationer'],
  ['Viaplay', ['VIAPLAY'], 'prenumeration', 'Prenumerationer'],
  ['Storytel', ['STORYTEL'], 'prenumeration', 'Prenumerationer'],
  ['Audible', ['AUDIBLE'], 'prenumeration', 'Prenumerationer'],
  ['Amazon Prime', ['AMAZON PRIME', 'PRIME VIDEO'], 'prenumeration', 'Prenumerationer'],
  ['Tele2', ['TELE2'], 'fast', 'Telefon & internet'],
  ['Telia', ['TELIA'], 'fast', 'Telefon & internet'],
  ['Unionen', ['UNIONEN'], 'fast', 'Föreningar & träning'],
  ['Telenor', ['TELENOR'], 'fast', 'Telefon & internet'],
  ['Tre', ['HI3G'], 'fast', 'Telefon & internet'],
  ['Comviq', ['COMVIQ'], 'fast', 'Telefon & internet'],
  ['Hallon', ['HALLON'], 'fast', 'Telefon & internet'],
  ['SATS', ['SATS'], 'fast', 'Föreningar & träning'],
  ['Friskis & Svettis', ['FRISKIS'], 'fast', 'Föreningar & träning'],
  ['Nordic Wellness', ['NORDIC WELLNESS'], 'fast', 'Föreningar & träning'],
  ['A-kassa', ['A-KASSA'], 'fast', 'Föreningar & träning'],
].map(([name, match, kind, category]) => ({ name, match, kind, category }))

export function merchant(text) {
  const [head, ...rest] = text.split(',')[0].toUpperCase().split('*')
  const name = rest.length && PROCESSORS.has(head.trim()) ? rest.join('*') : head
  return name.trim().replace(/(\s+\S*\d\S*)+$/, '') // drop trailing order ids
}

export function categorize(text, overrides = {}) {
  const o = overrides[merchant(text)]
  if (o) return o
  const t = text.toUpperCase().trim()
  if (/^\d{4}\.\d{2}\.\d{3}\.\d{2}$/.test(t)) return 'Överföring'
  if (/^\d{2,8}-\d{1,4}$/.test(t)) return 'Räkningar'
  if (/(^|\s)LÖN(\s|$)/.test(t)) return 'Lön' // the bank's own label for salary
  for (const [cat, words] of RULES) if (words.some((w) => t.includes(w))) return cat
  return 'Övrigt'
}

// '' when a payment landed in Övrigt only because no rule matched, so pickers can show "Välj kategori…"
export const chosenCategory = (text, overrides = {}) => (!overrides[merchant(text)] && categorize(text, overrides) === 'Övrigt' ? '' : categorize(text, overrides))

// The name to show for a transaction: the known service name, else the cleaned merchant.
export function displayName(text) {
  const t = text.toUpperCase()
  return SERVICES.find((s) => s.match.some((p) => t.includes(p)))?.name ?? title(merchant(text))
}

// ---- Reading bank exports ----
// Any Swedish bank's export works if it has a date, a text and an amount column (balance is optional).
// Columns are found by name, so the order and extra columns don't matter.
const norm = (h) => String(h ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const COLS = {
  // earlier names win when a file has several matching columns
  date: ['bokföringsdatum', 'bokföringsdag', 'bokforingsdag', 'bokfört', 'datum', 'transaktionsdatum', 'transaktionsdag', 'reskontradatum', 'date', 'valutadag', 'valutadatum'],
  text: ['text', 'beskrivning', 'rubrik', 'text/mottagare', 'transaktionstext', 'mottagare', 'namn', 'referens', 'meddelande', 'description'],
  amount: ['insättning/uttag', 'belopp', 'amount', 'summa'],
  balance: ['bokfört saldo', 'saldo', 'behållning', 'balance'],
}
const findCol = (header, names, taken = []) => {
  for (const n of names) {
    const i = header.findIndex((h, j) => !taken.includes(j) && (h === n || (n.length > 4 && h.includes(n))))
    if (i >= 0) return i
  }
  return -1
}

// "−1 234,50 kr", "-1234.50", 1234.5 -> number
export function parseAmount(v) {
  if (typeof v === 'number') return v
  let s = String(v ?? '').replace(/[\s ]|kr|sek/gi, '').replace(/[−–]/g, '-')
  if (!s) return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // Swedish: dot thousands, comma decimals
  return /^[-+]?\d*\.?\d+$/.test(s) ? Number(s) : NaN
}

// '2026-09-30', '2026/09/30', '30.09.2026', '30/09/2026' or an Excel serial number -> 'YYYY-MM-DD'
export function parseDate(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

// CSV with ; , or tab, quoted fields allowed.
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const sample = lines.slice(0, 15).join('\n')
  const delim = [';', '\t', ','].map((d) => [d, sample.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]
  return lines.filter((l) => l.trim()).map((line) => {
    const out = []; let cur = '', q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
      else if (c === '"') q = true
      else if (c === delim) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out.map((x) => x.trim())
  })
}

// Bytes -> text: UTF-8, or Windows-1252 for older exports (Swedish letters would otherwise turn into �)
export function decodeText(bytes) {
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8
}

// rows = the file as an array of rows (from SheetJS or parseCsv). Throws when no usable columns are found.
export function parseStatement(rows) {
  let h = -1, col
  for (let i = 0; i < Math.min(rows.length, 20) && h < 0; i++) {
    const header = (rows[i] || []).map(norm)
    const date = findCol(header, COLS.date)
    const amount = findCol(header, COLS.amount, [date])
    const deposit = header.findIndex((x) => x === 'insättning' || x === 'insättningar')
    const withdrawal = header.findIndex((x) => x === 'uttag' || x === 'uttag/utgift')
    if (date < 0 || (amount < 0 && (deposit < 0 || withdrawal < 0))) continue
    const text = findCol(header, COLS.text, [date, amount])
    if (text < 0) continue
    h = i
    col = { date, text, amount, deposit, withdrawal, balance: findCol(header, COLS.balance, [date, amount, text]) }
  }
  if (h < 0) throw new Error('Hittade inga kolumner för datum, text och belopp. Exportera kontoutdraget som Excel eller CSV från din bank.')

  const seq = {}
  let txs = []
  for (const r of rows.slice(h + 1)) {
    const date = parseDate(r[col.date])
    if (!date) continue // blank lines and footers
    const text = String(r[col.text] ?? '').trim()
    if (text.startsWith('Bankkort Privat')) continue // Länsförsäkringar card reservations that cancel out
    const amount = col.amount >= 0 ? parseAmount(r[col.amount]) : (parseAmount(r[col.deposit]) || 0) - Math.abs(parseAmount(r[col.withdrawal]) || 0)
    if (!Number.isFinite(amount)) throw new Error(`Oläsbart belopp på raden ${date} ${text}`)
    const balance = col.balance >= 0 ? parseAmount(r[col.balance]) : NaN
    txs.push({ date, text, amount, balance: Number.isFinite(balance) ? balance : null })
  }
  if (!txs.length) throw new Error('Filen innehöll inga transaktioner.')
  if (txs[0].date > txs.at(-1).date) txs.reverse() // many banks list newest first
  // Without a balance, identical purchases on one day are told apart by their order in the file
  for (const t of txs) if (t.balance === null) { const k = `${t.date}|${t.text}|${t.amount}`; t.seq = seq[k] = (seq[k] ?? 0) + 1 }
  return txs
}

// Balance after each row makes identical purchases on the same day distinct, so overlapping imports are safe.
export const txKey = (t) => `${t.date}|${t.text}|${t.amount}|${t.balance ?? '#' + t.seq}`

export function mergeTx(existing, incoming) {
  const seen = new Set(existing.map(txKey))
  const added = incoming.filter((t) => !seen.has(txKey(t)) && seen.add(txKey(t)))
  return { all: [...existing, ...added].sort((a, b) => a.date.localeCompare(b.date)), added: added.length }
}

// A payment can be counted in another month than it was booked (rent paid a few days late). t.month is set from data.moves.
export const monthOf = (t) => t.month ?? t.date.slice(0, 7)
export const withMoves = (txs, moves = {}) => txs.map((t) => (moves[txKey(t)] ? { ...t, month: moves[txKey(t)] } : t))
export const shiftMonth = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export const monthsIn = (txs) => [...new Set(txs.map(monthOf))].sort()

export function monthly(txs, overrides) {
  const by = {}
  for (const m of monthsIn(txs)) by[m] = { month: m, income: 0, gross: 0, refunds: 0, invested: 0 }
  for (const t of txs) {
    const c = categorize(t.text, overrides), row = by[monthOf(t)]
    if (c === 'Överföring') continue
    if (c === 'Sparande') row.invested += -t.amount
    else if (c === 'Återbetalning') row.refunds += t.amount
    else if (t.amount > 0) row.income += t.amount
    else row.gross += -t.amount
  }
  // spending is what things cost you: gross purchases minus what others paid back
  return Object.values(by).map((r) => ({ ...r, spending: r.gross - r.refunds, saved: r.income - r.gross + r.refunds }))
}

export function byCategory(txs, overrides) {
  const out = {}
  for (const t of txs) {
    const c = categorize(t.text, overrides)
    if (t.amount < 0 && !NOT_SPENDING.has(c)) out[c] = (out[c] || 0) - t.amount
  }
  return Object.entries(out).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
}

export function daily(txs, overrides, month) {
  const days = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate()
  const out = Array(days).fill(0)
  for (const t of txs) {
    if (monthOf(t) === month && t.amount < 0 && !NOT_SPENDING.has(categorize(t.text, overrides))) out[t.date.startsWith(month) ? +t.date.slice(8, 10) - 1 : t.date < month ? 0 : days - 1] -= t.amount
  }
  return out
}

const matches = (sub, t) => { const u = t.text.toUpperCase(); return sub.match.some((p) => u.includes(p)) }
const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 864e5

// History and status for each confirmed recurring cost, from the transactions that match it.
export function subscriptionStats(txs, subs) {
  const end = txs.at(-1)?.date
  return subs.map((s) => {
    const byMonth = {}
    let last = null
    for (const t of txs) if (t.amount < 0 && matches(s, t)) { byMonth[monthOf(t)] = (byMonth[monthOf(t)] || 0) - t.amount; last = t.date }
    const months = Object.keys(byMonth).sort()
    const prices = months.map((m) => byMonth[m])
    const price = prices.at(-1) ?? 0
    const active = !!last && daysBetween(last, end) <= (s.cycle === 'år' ? 400 : 45)
    return { ...s, prices, months, price, last, active, monthlyCost: s.cycle === 'år' ? price / 12 : price }
  })
}

// Plan details for a confirmed subscription: the plan its price matches (or the one you picked), the other plans
// with what switching costs or saves per year, and the account links. null for services Kassa has no plan data for.
export function planInfo(sub) {
  const svc = SERVICES.find((s) => s.match.some((p) => sub.match.includes(p)))
  const info = svc && PLANS[svc.name]
  if (!info) return null
  const plans = (info.plans ?? []).map(([name, price]) => ({ name, price, perYear: Math.round((price - sub.monthlyCost) * 12) }))
  const byYear = sub.cycle === 'år' && Object.entries(info.yearly ?? {}).find(([, p]) => Math.abs(p - sub.price) <= 1)?.[0]
  const current = sub.plan || byYear || plans.find((p) => Math.abs(p.price - sub.monthlyCost) <= 1)?.name || null
  const yearly = sub.cycle !== 'år' && info.yearly?.[current]
  return { ...info, service: svc.name, plans, current, guessed: !sub.plan && !!current,
    yearlySaving: yearly ? Math.round(sub.price * 12 - yearly) : 0, paid: sub.prices.reduce((s, x) => s + x, 0) }
}

// Things that look recurring but you haven't confirmed or dismissed yet.
export function suggestions(txs, subs, dismissed = []) {
  const taken = new Set([...dismissed, ...subs.map((s) => s.name)])
  const covered = (t) => subs.some((s) => matches(s, t))
  const out = []
  for (const svc of SERVICES) {
    if (taken.has(svc.name)) continue
    const hits = txs.filter((t) => t.amount < 0 && matches(svc, t) && !covered(t))
    if (hits.length) out.push({ ...svc, cycle: 'månad', price: -hits.at(-1).amount, monthsSeen: new Set(hits.map(monthOf)).size, last: hits.at(-1).date, reason: 'Känd tjänst' })
  }
  // Unknown merchants charged about every 30 days at a similar price, 3+ times.
  // Gaps, not calendar months: a bill paid around the 1st lands twice in one month and not at all in the next.
  const g = {}
  for (const t of txs) {
    if (t.amount >= 0 || covered(t) || SERVICES.some((s) => matches(s, t)) || NEVER_RECURRING.has(categorize(t.text))) continue
    ;(g[merchant(t.text)] ??= []).push(t)
  }
  for (const [m, list] of Object.entries(g)) {
    if (taken.has(m) || list.length < 3) continue
    const gaps = list.slice(1).map((t, i) => daysBetween(list[i].date, t.date))
    if (gaps.filter((d) => d >= 20 && d <= 40).length < gaps.length * 0.75) continue
    const amounts = list.map((t) => -t.amount).sort((a, b) => a - b), median = amounts[Math.floor(amounts.length / 2)]
    if (amounts.some((a) => Math.abs(a - median) > median * 0.3)) continue
    out.push({ name: m, match: [m], kind: 'fast', category: categorize(m), cycle: 'månad', price: -list.at(-1).amount, monthsSeen: new Set(list.map(monthOf)).size, last: list.at(-1).date, reason: 'Dras varje månad' })
  }
  return out
}

export function alerts(txs, overrides, subs, dismissed, riseLimit = 0.05) {
  const out = []
  const last = monthsIn(txs).at(-1)
  const monthTx = txs.filter((t) => monthOf(t) === last)
  const big = monthTx.filter((t) => t.amount <= -1000)
  // Same large amount to two different payees in one month
  for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
    const a = big[i], b = big[j]
    if (a.amount === b.amount && merchant(a.text) !== merchant(b.text)) {
      out.push({ kind: 'double', title: `${fmt(-a.amount)} kr betalt två gånger?`, body: `${shortDate(a.date)} ${displayName(a.text)} · ${shortDate(b.date)} ${displayName(b.text)}`, keys: [txKey(a), txKey(b)] })
    }
  }
  // Large deposits that aren't the salary are often your own transfers, which inflate income
  const incoming = monthTx.filter((t) => t.amount > 0 && categorize(t.text, overrides) !== 'Överföring')
  const salary = incoming.reduce((m, t) => (t.amount > (m?.amount ?? 0) ? t : m), null)
  for (const t of incoming) {
    if (t !== salary && t.amount >= 2000 && categorize(t.text, overrides) === 'Övrigt') {
      out.push({ kind: 'transfer', key: merchant(t.text), title: 'Egen överföring?', body: `${fmt(t.amount)} kr från ${displayName(t.text)} räknas som inkomst. Markera som Överföring under Transaktioner om det är mellan dina konton.` })
    }
  }
  const stats = subscriptionStats(txs, subs).filter((s) => s.active)
  for (const s of stats) {
    if (s.prices.length >= 2 && s.price > s.prices[0] * (1 + riseLimit)) {
      out.push({ kind: 'rise', title: `${s.name} har höjt priset ${Math.round((s.price / s.prices[0] - 1) * 100)}%`, body: `${fmt(s.prices[0])} → ${fmt(s.price)} kr` })
    }
  }
  const phones = stats.filter((s) => s.category === 'Telefon & internet')
  if (phones.length >= 2) {
    out.push({ kind: 'dupe', title: `${phones.length} mobil-/internetabonnemang`, body: `${phones.map((p) => p.name).join(' + ')} · ${fmt(phones.reduce((s, p) => s + p.monthlyCost, 0) * 12)} kr/år` })
  }
  const pending = suggestions(txs, subs, dismissed).length
  if (pending) out.push({ kind: 'suggest', title: `${pending} förslag att granska`, body: 'Bekräfta vilka som är prenumerationer eller fasta kostnader under Prenumerationer.' })
  return out
}

export const fmt = (n) => Math.round(n).toLocaleString('sv-SE').replace(/ /g, ' ')
export const title = (s) => s.toLowerCase().replace(/(^|[\s.])\S/g, (c) => c.toUpperCase())
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const MONTHS_LONG = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']
export const monthShort = (m) => MONTHS[+m.slice(5, 7) - 1]
export const monthLong = (m) => `${MONTHS_LONG[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`
export const shortDate = (d) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}`

// Charges worth a second look: big, and either a new payee or far above what that payee usually costs.
export function unusualCharges(txs, overrides, subs, month, min = 1500) {
  const before = txs.filter((t) => monthOf(t) < month && t.amount < 0)
  return txs.filter((t) => {
    if (monthOf(t) !== month || t.amount > -min || subs.some((s) => matches(s, t))) return false
    if (['Boende', 'Sparande', 'Överföring'].includes(categorize(t.text, overrides))) return false
    const prev = before.filter((p) => merchant(p.text) === merchant(t.text)).map((p) => -p.amount)
    return !prev.length || -t.amount > 2 * Math.max(...prev)
  })
}

// A regular payment (same payee, about the same amount, normally once a month) that is missing one month
// and comes twice the next was probably paid late. Suggests counting the first one in the month before.
// Payments you already moved, or chose to keep, have t.month set and are not suggested again.
export function latePayments(txs, month) {
  const prev = shiftMonth(month, -1)
  if (!txs.some((t) => monthOf(t) === prev)) return [] // no data for the month before, so nothing is missing
  const by = {}
  for (const t of txs) if (t.amount <= -500) ((by[merchant(t.text)] ??= {})[monthOf(t)] ??= []).push(t)
  const out = []
  for (const byMonth of Object.values(by)) {
    const cur = byMonth[month] ?? []
    if (cur.length !== 2 || byMonth[prev] || cur.some((t) => t.month)) continue
    if (Object.values(byMonth).filter((l) => l.length === 1).length < 2) continue // not a monthly payment
    const [a, b] = cur
    if (Math.abs(a.amount - b.amount) <= 0.1 * -a.amount) out.push({ tx: a, from: month, to: prev })
  }
  return out
}

// The monthly review: each item is done when nothing is left to look at.
export function checklist(txs, overrides, subs, dismissed, month, budgets = {}, accounts = []) {
  const monthTx = txs.filter((t) => monthOf(t) === month)
  const warn = alerts(txs, overrides, subs, dismissed)
  // only payments nobody has categorised; choosing Övrigt yourself counts as a decision (deposits are covered by the transfer check)
  const other = monthTx.filter((t) => t.amount < 0 && !overrides[merchant(t.text)] && categorize(t.text, overrides) === 'Övrigt')
  const unusual = unusualCharges(txs, overrides, subs, month)
  const over = budgetStatus(txs, overrides, budgets, month).filter((b) => b.status === 'over')
  const stale = accounts.filter((a) => !(a.snapshots ?? []).some((s) => s.month >= month))
  const late = latePayments(txs, month)
  return [
    { id: 'late', title: 'Betalningar som kom en månad sent', count: late.length, late },
    { id: 'suggest', title: 'Granska förslag på prenumerationer', count: suggestions(txs, subs, dismissed).length, go: 'Prenumerationer' },
    { id: 'other', title: 'Sätt kategori på transaktioner i Övrigt', count: other.length, go: 'Transaktioner', query: 'Övrigt', items: other },
    { id: 'transfer', title: 'Kontrollera möjliga egna överföringar', count: warn.filter((a) => a.kind === 'transfer').length, go: 'Transaktioner', details: warn.filter((a) => a.kind === 'transfer') },
    { id: 'double', title: 'Kontrollera möjliga dubbelbetalningar', count: warn.filter((a) => a.kind === 'double').length, details: warn.filter((a) => a.kind === 'double'), manual: true },
    { id: 'rise', title: 'Prishöjningar på prenumerationer', count: warn.filter((a) => a.kind === 'rise').length, details: warn.filter((a) => a.kind === 'rise'), manual: true },
    { id: 'unusual', title: 'Ovanligt stora köp', count: unusual.length, items: unusual, manual: true },
    { id: 'accounts', title: 'Uppdatera värdet på dina konton', count: stale.length, details: stale.map((a) => ({ title: a.name, body: a.snapshots?.length ? 'senast ' + sortedSnapshots(a).at(-1).month : 'inget värde än' })), go: 'Investeringar' },
    { id: 'budget', title: 'Kategorier över budget', count: over.length, details: over.map((b) => ({ title: b.category, body: `${fmt(b.spent)} av ${fmt(b.budget)} kr` })), go: 'Budget', manual: true },
  ]
}

// Month-by-month figures for one calendar year (12 rows, null for months without data).
export function yearSummary(txs, overrides, year) {
  const rows = Object.fromEntries(monthly(txs, overrides).map((r) => [r.month, r]))
  const months = Array.from({ length: 12 }, (_, i) => rows[`${year}-${String(i + 1).padStart(2, '0')}`] ?? null)
  const have = months.filter(Boolean)
  const total = (k) => have.reduce((s, r) => s + r[k], 0)
  const income = total('income'), spending = total('spending')
  return { year, months, monthsWithData: have.length, income, spending, refunds: total('refunds'), saved: income - spending, invested: total('invested'), rate: income ? (income - spending) / income : 0 }
}

// Spending per category per month for one year, biggest categories first.
export function categoryMatrix(txs, overrides, year) {
  const out = {}
  for (const t of txs) {
    if (monthOf(t).slice(0, 4) !== String(year) || t.amount >= 0) continue
    const c = categorize(t.text, overrides)
    if (NOT_SPENDING.has(c)) continue
    out[c] ??= Array(12).fill(0)
    out[c][+monthOf(t).slice(5, 7) - 1] -= t.amount
  }
  return Object.entries(out).map(([category, byMonth]) => ({ category, byMonth, total: byMonth.reduce((s, x) => s + x, 0) })).sort((a, b) => b.total - a.total)
}

export const yearsIn = (txs) => [...new Set(txs.map((t) => monthOf(t).slice(0, 4)))].sort()

// How each budgeted category is doing in a month. For the newest month, which may still be running,
// spending is projected to month end from how far into the month the data goes.
export function budgetStatus(txs, overrides, budgets, month) {
  const spent = Object.fromEntries(byCategory(txs.filter((t) => monthOf(t) === month), overrides).map((c) => [c.category, c.amount]))
  const days = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate()
  const lastDay = Math.max(...txs.filter((t) => monthOf(t) === month).map((t) => +t.date.slice(8, 10)), 1)
  const running = month === monthsIn(txs).at(-1) && lastDay < days
  return Object.entries(budgets).filter(([, b]) => b > 0).map(([category, budget]) => {
    const s = spent[category] ?? 0
    const projected = running ? s / lastDay * days : s
    return { category, budget, spent: s, left: budget - s, projected, running, status: s > budget ? 'over' : projected > budget ? 'warn' : 'ok' }
  }).sort((a, b) => b.spent / b.budget - a.spent / a.budget)
}

// Average monthly spend per category over the last 3 months, rounded up to the next 100 kr.
export function suggestBudgets(txs, overrides) {
  const recent = monthsIn(txs).slice(-3)
  const sums = byCategory(txs.filter((t) => recent.includes(monthOf(t))), overrides)
  return Object.fromEntries(sums.map((c) => [c.category, Math.ceil(c.amount / recent.length / 100) * 100]))
}

// Progress and plan for a savings goal { name, target, saved, deadline? 'YYYY-MM' }.
export function goalPlan(goal, today, avgSavedPerMonth) {
  const left = Math.max(0, goal.target - goal.saved)
  const monthsLeft = goal.deadline ? (+goal.deadline.slice(0, 4) - +today.slice(0, 4)) * 12 + (+goal.deadline.slice(5, 7) - +today.slice(5, 7)) : null
  const perMonth = monthsLeft === null ? null : left / Math.max(1, monthsLeft)
  const etaMonths = left === 0 ? 0 : avgSavedPerMonth > 0 ? Math.ceil(left / avgSavedPerMonth) : null
  let eta = null
  if (etaMonths !== null) { const d = new Date(+today.slice(0, 4), +today.slice(5, 7) - 1 + etaMonths, 1); eta = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  return { left, progress: goal.target ? Math.min(1, goal.saved / goal.target) : 0, monthsLeft, perMonth, eta, done: left === 0 }
}

// ---- Investments and net worth ----
// An account is { name, type, match: [UPPERCASE substrings of bank transfers into it], startPaidIn, snapshots: [{ month: 'YYYY-MM', value }], holdings: [{ name, value }] }

// Bank balance after the last transaction of each month.
export function monthEndBalances(txs) {
  const out = {}
  for (const t of txs) if (t.balance != null) out[t.date.slice(0, 7)] = t.balance // txs are in date order, so the last one wins
  return out
}

// Money moved into the account from the bank, per month (withdrawals back count negative).
export function contributions(txs, account) {
  const out = {}
  if (!account.match?.length) return out
  for (const t of txs) if (matches(account, t)) out[monthOf(t)] = (out[monthOf(t)] || 0) - t.amount
  return out
}

const sortedSnapshots = (a) => (a.snapshots ?? []).slice().sort((x, y) => x.month.localeCompare(y.month))

// Value at the end of a month: the latest snapshot up to then, else what has been paid in so far (an estimate).
export function accountValueAt(txs, account, month) {
  const snap = sortedSnapshots(account).filter((s) => s.month <= month).at(-1)
  const paid = paidInUntil(txs, account, month)
  return snap ? { value: snap.value, estimated: false, paid } : { value: paid, estimated: true, paid }
}

export function paidInUntil(txs, account, month) {
  const c = contributions(txs, account)
  return (account.startPaidIn || 0) + Object.entries(c).filter(([m]) => m <= month).reduce((s, [, v]) => s + v, 0)
}

export function accountStats(txs, account, month) {
  const { value, estimated, paid } = accountValueAt(txs, account, month)
  const snaps = sortedSnapshots(account)
  return { value, estimated, paid, gain: value - paid, gainPct: paid ? (value - paid) / paid : 0, lastSnapshot: snaps.at(-1)?.month ?? null, history: snaps }
}

// Net worth per month: bank balance (carried forward) plus every account's value.
export function netWorthSeries(txs, accounts) {
  const balances = monthEndBalances(txs)
  const months = [...new Set([...Object.keys(balances), ...accounts.flatMap((a) => (a.snapshots ?? []).map((s) => s.month))])].sort()
  let cash = 0
  return months.map((m) => {
    if (m in balances) cash = balances[m]
    const parts = accounts.map((a) => accountValueAt(txs, a, m).value)
    return { month: m, cash, accounts: parts, total: cash + parts.reduce((s, v) => s + v, 0) }
  })
}

// Bank texts that look like transfers to savings, to offer when linking an account.
export function savingsTransfers(txs, overrides) {
  const seen = {}
  for (const t of txs) {
    const c = categorize(t.text, overrides)
    if (t.amount < 0 && (c === 'Sparande' || c === 'Överföring')) seen[merchant(t.text)] = (seen[merchant(t.text)] || 0) - t.amount
  }
  return Object.entries(seen).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
}

// The payer with the most money in over the period, if they paid in at least two months: almost always the employer.
export function salaryPayer(txs, overrides) {
  const g = {}
  for (const t of txs) {
    if (t.amount <= 0 || ['Överföring', 'Återbetalning', 'Sparande'].includes(categorize(t.text, overrides))) continue
    const m = merchant(t.text)
    g[m] ??= { total: 0, months: new Set() }
    g[m].total += t.amount; g[m].months.add(monthOf(t))
  }
  const best = Object.entries(g).filter(([, v]) => v.months.size >= 2).sort((a, b) => b[1].total - a[1].total)[0]
  return best?.[0] ?? null
}

// Everything that came into the account in a month, grouped by payer, with what it counts as.
export function incomeBreakdown(txs, overrides, month) {
  const salary = salaryPayer(txs, overrides)
  const g = {}
  let biggest = null
  for (const t of txs) {
    if (monthOf(t) !== month || t.amount <= 0) continue
    const key = merchant(t.text), c = categorize(t.text, overrides)
    if (c === 'Sparande') continue
    g[key] ??= { key, name: displayName(t.text), amount: 0, kind: c === 'Överföring' || c === 'Återbetalning' || c === 'Lön' ? c : key === salary ? 'Lön' : 'Övrigt' }
    g[key].amount += t.amount
  }
  const rows = Object.values(g).sort((a, b) => b.amount - a.amount)
  // Employers sometimes change the text the salary arrives with: the month's biggest deposit of 10 000+ is salary too
  biggest = rows.find((r) => r.kind === 'Övrigt')
  if (biggest && biggest.amount >= 10000 && biggest.amount === Math.max(...rows.filter((r) => r.kind !== 'Överföring').map((r) => r.amount))) biggest.kind = 'Lön'
  return rows
}
