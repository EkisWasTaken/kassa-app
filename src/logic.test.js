import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, parseAmount, parseDate, decodeText, merchant, categorize, displayName, parseStatement, mergeTx, monthly, subscriptionStats, suggestions, alerts, SERVICES, unusualCharges, checklist, chosenCategory, yearSummary, categoryMatrix, budgetStatus, suggestBudgets, goalPlan, contributions, paidInUntil, accountValueAt, accountStats, netWorthSeries, salaryPayer, incomeBreakdown, latePayments, withMoves, txKey, planInfo, withRules, ruleSuggestion, forecast } from './logic.js'

const tx = (date, text, amount, balance = 0) => ({ date, text, amount, balance })
const svc = (name) => ({ ...SERVICES.find((s) => s.name === name), cycle: 'månad' })

test('merchant strips ids and payment processors', () => {
  assert.equal(merchant('SPOTIFY*P47348030D,SPOTIFY.COM,SE'), 'SPOTIFY')
  assert.equal(merchant('SPOTIFY P44F7D6708'), 'SPOTIFY')
  assert.equal(merchant('K*TV4 Aktieb'), 'TV4 AKTIEB')
  assert.equal(merchant('ANTHROPIC* CLAUDE SUB,SAN FRANCISCO,US'), 'ANTHROPIC')
})

test('categorize rules, bankgiro, transfers and overrides', () => {
  assert.equal(categorize('COOP VASASTAN,STOCKHOLM,SE'), 'Mat')
  assert.equal(categorize('Swish från Kim Berg'), 'Återbetalning')
  assert.equal(categorize('Swish till Sam Ek'), 'Swish')
  assert.equal(categorize('1234-5678'), 'Räkningar')
  assert.equal(categorize('123456-7'), 'Räkningar')
  assert.equal(categorize('9999.11.222.33'), 'Överföring')
  assert.equal(categorize('Something new'), 'Övrigt')
  assert.equal(categorize('Something new', { 'SOMETHING NEW': 'Shopping' }), 'Shopping')
})

test('displayName maps bank text to real service names', () => {
  assert.equal(displayName('help.hbomax.com,Stockholm,SE'), 'HBO Max')
  assert.equal(displayName('CLAUDE.AI SUBSCRIPTION'), 'Claude')
  assert.equal(displayName('COOP VASASTAN,STOCKHOLM,SE'), 'Coop Vasastan')
})

test('parseStatement validates header and rows, skips card reservations', () => {
  const rows = [['Kontoutdrag'], ['Bokföringsdatum', 'Transaktionsdatum', 'Text', 'Insättning/Uttag', 'Behållning'],
    ['2026-09-01', '2026-09-01', 'Bankkort Privat 7556', -39, 100], ['2026-09-01', '2026-08-31', 'COOP', -10.5, 89.5]]
  assert.deepEqual(parseStatement(rows), [tx('2026-09-01', 'COOP', -10.5, 89.5)])
  assert.throws(() => parseStatement([[], ['Foo', 'Bar']]), /Hittade inga kolumner/)
  assert.throws(() => parseStatement([rows[0], rows[1], ['2026-09-02', '', 'COOP', 'abc', 0]]), /Oläsbart belopp/)
})

test('mergeTx skips duplicates but keeps identical purchases with different balances', () => {
  const { all, added } = mergeTx([tx('2026-09-01', 'ICA', -10, 90)], [tx('2026-09-01', 'ICA', -10, 90), tx('2026-09-01', 'ICA', -10, 80)])
  assert.equal(added, 1)
  assert.equal(all.length, 2)
})

test('monthly excludes transfers, counts savings separately and nets repayments against spending', () => {
  const m = monthly([tx('2026-09-01', 'Lön', 1000), tx('2026-09-02', 'COOP', -300), tx('2026-09-03', 'Överf ISK sparplan', -200), tx('2026-09-04', '9999.11.222.33', -400),
    tx('2026-09-05', 'Swish från Kim Berg', 100), tx('2026-09-06', 'Anna Andersson', 5000)])
  assert.deepEqual(m, [{ month: '2026-09', income: 6000, gross: 300, refunds: 100, invested: 200, spending: 200, saved: 5800 }])
  const [fixed] = monthly([tx('2026-09-06', 'Anna Andersson', 5000), tx('2026-09-02', 'COOP', -300)], { 'ANNA ANDERSSON': 'Överföring' })
  assert.deepEqual([fixed.income, fixed.saved], [0, -300])
})

test('salaryPayer and incomeBreakdown match the September statement', () => {
  const txs = [
    tx('2026-08-25', 'EXEMPELBOLAGET AB', 30000), tx('2026-09-25', 'EXEMPELBOLAGET AB', 31000),
    tx('2026-08-10', 'Anna Andersson', 5000), tx('2026-09-10', 'Anna Andersson', 5000),
    tx('2026-09-12', 'Swish från ALEX HOLM', 850), tx('2026-09-28', 'Hyra rumskamrat', 425), tx('2026-09-27', 'Överf ISK sparplan', -1500),
  ]
  assert.equal(salaryPayer(txs, {}), 'EXEMPELBOLAGET AB')
  const b = Object.fromEntries(incomeBreakdown(txs, {}, '2026-09').map((r) => [r.key, r.kind]))
  assert.deepEqual(b, { 'EXEMPELBOLAGET AB': 'Lön', 'ANNA ANDERSSON': 'Övrigt', 'SWISH FRÅN ALEX HOLM': 'Återbetalning', 'HYRA RUMSKAMRAT': 'Övrigt' })
  const after = Object.fromEntries(incomeBreakdown(txs, { 'ANNA ANDERSSON': 'Överföring', 'HYRA RUMSKAMRAT': 'Återbetalning' }, '2026-09').map((r) => [r.key, r.kind]))
  assert.deepEqual([after['ANNA ANDERSSON'], after['HYRA RUMSKAMRAT']], ['Överföring', 'Återbetalning'])
})

test('salary is found when the employer changes how it is labelled', () => {
  const txs = [tx('2026-07-24', 'LÖN', 30766), tx('2026-08-24', 'LÖN', 32431), tx('2026-09-24', 'EXEMPELBOLAGET AB', 31000), tx('2026-09-10', 'Anna Andersson', 5000), tx('2026-08-23', 'Försäkringsersättning', 6067)]
  assert.equal(categorize('LÖN'), 'Lön')
  assert.equal(categorize('SALÖNG ANNA'), 'Övrigt')
  const sep = Object.fromEntries(incomeBreakdown(txs, {}, '2026-09').map((r) => [r.key, r.kind]))
  assert.deepEqual(sep, { 'EXEMPELBOLAGET AB': 'Lön', 'ANNA ANDERSSON': 'Övrigt' })
  const aug = Object.fromEntries(incomeBreakdown(txs, {}, '2026-08').map((r) => [r.key, r.kind]))
  assert.deepEqual(aug, { 'LÖN': 'Lön', 'FÖRSÄKRINGSERSÄTTNING': 'Övrigt' })
})

test('subscriptionStats merges renamed merchants and detects stopped ones', () => {
  const txs = [tx('2026-04-05', 'CLAUDE.AI SUBSCRIPTION', -247), tx('2026-06-05', 'ANTHROPIC* X', -252), tx('2026-07-05', 'ZWIFT', -222), tx('2026-09-30', 'COOP', -1)]
  const [claude, zwift] = subscriptionStats(txs, [svc('Claude'), svc('Zwift')])
  assert.deepEqual(claude.prices, [247, 252])
  assert.equal(claude.active, false) // last charge Jun 5, data runs to Sep 30
  assert.equal(zwift.active, false)
  const [yearly] = subscriptionStats(txs, [{ ...svc('Zwift'), cycle: 'år' }])
  assert.equal(yearly.active, true)
  assert.equal(yearly.monthlyCost, 222 / 12)
})

test('suggestions: known services and steady monthly charges only, never confirmed or dismissed ones', () => {
  const txs = [
    tx('2026-07-05', 'SPOTIFY P1', -129), tx('2026-08-05', 'SPOTIFY P2', -129),
    // real pattern: paid around the 1st, so June has two charges and July none
    tx('2026-06-01', '1234-5678', -490), tx('2026-06-29', '1234-5678', -522), tx('2026-08-03', '1234-5678', -540), tx('2026-08-31', '1234-5678', -497),
    tx('2026-07-07', 'Frisören', -200), tx('2026-07-21', 'Frisören', -200), tx('2026-09-30', 'Frisören', -200), // irregular gaps
    tx('2026-07-07', 'Kebabhörnan', -120), tx('2026-08-07', 'Kebabhörnan', -128), // only twice
    tx('2026-07-08', 'COOP', -100), tx('2026-07-20', 'COOP', -300), tx('2026-08-08', 'COOP', -250), tx('2026-09-08', 'COOP', -90),
    tx('2026-07-09', 'HBOMAX', -149),
  ]
  const names = suggestions(txs, [svc('HBO Max')], ['Netflix']).map((s) => s.name).sort()
  assert.deepEqual(names, ['1234-5678', 'Spotify'])
  assert.deepEqual(suggestions(txs, [], ['Spotify', '1234-5678', 'HBO Max']), [])
})

test('alerts: double payment, own transfer, price rise, two phone plans, pending suggestions', () => {
  const txs = [
    tx('2026-08-01', 'ANTHROPIC* X', -240), tx('2026-09-01', 'ANTHROPIC* X', -259),
    tx('2026-09-09', 'LÄNSFÖRSÄKRINGAR AB', -2500), tx('2026-09-25', '555-1234', -2500),
    tx('2026-09-30', 'TELE2 SVERIGE AKTIEBOLAG', -479), tx('2026-09-30', 'TELIA SVERIGE', -399),
    tx('2026-09-25', 'EXEMPELBOLAGET AB', 30000), tx('2026-09-10', 'Anna Andersson', 5000),
    tx('2026-09-02', 'SPOTIFY P1', -129),
  ]
  const kinds = alerts(txs, {}, [svc('Claude'), svc('Tele2'), svc('Telia')], []).map((a) => a.kind).sort()
  assert.deepEqual(kinds, ['double', 'dupe', 'rise', 'suggest', 'transfer'])
  const noTransfer = alerts(txs, { 'ANNA ANDERSSON': 'Överföring' }, [svc('Claude'), svc('Tele2'), svc('Telia')], ['Länsförsäkringar']).map((a) => a.kind)
  assert.equal(noTransfer.includes('transfer'), false)
})

test('unusualCharges: new big payees and big jumps, not rent or confirmed subs', () => {
  const txs = [
    tx('2026-08-03', 'ZALANDO', -500), tx('2026-09-03', 'ZALANDO', -1600), // 1600 < 2 * 500? no, 1600 > 1000 -> unusual
    tx('2026-08-04', 'COOP', -1200), tx('2026-09-04', 'COOP', -1600), // not > 2x
    tx('2026-09-05', 'AIRBNB', -4251), // new payee
    tx('2026-09-30', 'FASTIGHETS AB EXEMPEL', -8651), // rent
    tx('2026-09-06', 'TELE2', -2000), // confirmed
  ]
  const names = unusualCharges(txs, {}, [svc('Tele2')], '2026-09').map((t) => t.text).sort()
  assert.deepEqual(names, ['AIRBNB', 'ZALANDO'])
})

test('checklist counts open items for the month', () => {
  const txs = [tx('2026-09-01', 'Mystery shop', -100), tx('2026-09-02', 'SPOTIFY P1', -129), tx('2026-09-25', 'EXEMPELBOLAGET', 30000), tx('2026-09-10', 'Anna Andersson', 5000)]
  const c = Object.fromEntries(checklist(txs, {}, [], [], '2026-09').map((i) => [i.id, i.count]))
  assert.equal(c.suggest, 1)
  assert.equal(c.other, 1) // only payments; the salary and deposit are not nagged about
  assert.equal(c.transfer, 1)
  const kept = checklist(txs, { 'MYSTERY SHOP': 'Övrigt' }, [], [], '2026-09').find((i) => i.id === 'other')
  assert.equal(kept.count, 0) // choosing Övrigt yourself resolves it
  assert.deepEqual([chosenCategory('Mystery shop'), chosenCategory('Mystery shop', { 'MYSTERY SHOP': 'Övrigt' }), chosenCategory('COOP')], ['', 'Övrigt', 'Mat'])
  const fixed = Object.fromEntries(checklist(txs, { 'ANNA ANDERSSON': 'Överföring', 'MYSTERY SHOP': 'Shopping' }, [svc('Spotify')], [], '2026-09').map((i) => [i.id, i.count]))
  assert.deepEqual([fixed.suggest, fixed.other, fixed.transfer], [0, 0, 0])
})

test('yearSummary and categoryMatrix', () => {
  const txs = [tx('2026-03-25', 'EXEMPELBOLAGET', 30000), tx('2026-03-26', 'COOP', -5000), tx('2026-04-26', 'COOP', -6000), tx('2026-04-27', 'Överf ISK sparplan', -1500), tx('2025-12-01', 'COOP', -1)]
  const y = yearSummary(txs, {}, 2026)
  assert.equal(y.monthsWithData, 2)
  assert.equal(y.months[0], null)
  assert.deepEqual([y.income, y.spending, y.saved, y.invested], [30000, 11000, 19000, 1500])
  const [food] = categoryMatrix(txs, {}, 2026)
  assert.equal(food.category, 'Mat')
  assert.equal(food.byMonth[2], 5000)
  assert.equal(food.total, 11000)
})

test('budgetStatus: over, projected warning for a running month, ok', () => {
  const txs = [tx('2026-08-10', 'COOP', -100), tx('2026-09-02', 'COOP', -4000), tx('2026-09-10', 'ZALANDO', -2500), tx('2026-09-15', 'MCD', -100)]
  const s = Object.fromEntries(budgetStatus(txs, {}, { Mat: 6000, Shopping: 2000, 'Restaurang & café': 1000, Resor: 0 }, '2026-09').map((b) => [b.category, b]))
  assert.equal(s.Shopping.status, 'over')
  assert.equal(s.Mat.status, 'warn') // 4000 by the 15th of 30 days -> 8000 projected
  assert.equal(s['Restaurang & café'].status, 'ok')
  assert.equal(s.Resor, undefined) // 0 = no budget
  assert.equal(budgetStatus(txs, {}, { Mat: 50 }, '2026-08')[0].running, false)
})

test('suggestBudgets averages the last 3 months and rounds up', () => {
  const txs = [tx('2026-06-01', 'COOP', -9999), tx('2026-07-01', 'COOP', -1000), tx('2026-08-01', 'COOP', -1100), tx('2026-09-01', 'COOP', -1250)]
  assert.deepEqual(suggestBudgets(txs, {}), { Mat: 1200 }) // (1000+1100+1250)/3 = 1117 -> 1200
})

test('goalPlan: monthly need, eta and done', () => {
  const g = goalPlan({ target: 50000, saved: 20000, deadline: '2027-09' }, '2026-09-30', 3000)
  assert.deepEqual([g.left, g.monthsLeft, g.perMonth, g.eta], [30000, 12, 2500, '2027-07'])
  assert.equal(goalPlan({ target: 100, saved: 100 }, '2026-09-30', 0).done, true)
  assert.equal(goalPlan({ target: 100, saved: 0 }, '2026-09-30', -500).eta, null) // not saving: no eta
})

test('checklist flags categories over budget', () => {
  const txs = [tx('2026-09-02', 'ZALANDO', -2500)]
  const item = checklist(txs, {}, [], [], '2026-09', { Shopping: 2000 }).find((i) => i.id === 'budget')
  assert.equal(item.count, 1)
})

const isk = (extra = {}) => ({ name: 'ISK', type: 'ISK', match: ['ISK SPARPLAN'], startPaidIn: 0, snapshots: [], holdings: [], ...extra })

test('contributions and paid-in follow linked transfers', () => {
  const txs = [tx('2026-08-27', 'Överf ISK sparplan', -1500), tx('2026-09-27', 'Överf ISK sparplan', -1500), tx('2026-09-28', 'COOP', -100)]
  assert.deepEqual(contributions(txs, isk()), { '2026-08': 1500, '2026-09': 1500 })
  assert.equal(paidInUntil(txs, isk({ startPaidIn: 10000 }), '2026-08'), 11500)
  assert.deepEqual(contributions(txs, isk({ match: [] })), {})
})

test('accountValueAt uses the latest snapshot, else paid-in as an estimate', () => {
  const txs = [tx('2026-08-27', 'Överf ISK sparplan', -1500), tx('2026-09-27', 'Överf ISK sparplan', -1500)]
  const a = isk({ snapshots: [{ month: '2026-08', value: 1600 }] })
  assert.deepEqual(accountValueAt(txs, a, '2026-07'), { value: 0, estimated: true, paid: 0 })
  assert.deepEqual(accountValueAt(txs, a, '2026-09'), { value: 1600, estimated: false, paid: 3000 }) // carried forward
  const s = accountStats(txs, isk({ snapshots: [{ month: '2026-09', value: 3300 }] }), '2026-09')
  assert.equal(s.gain, 300)
  assert.equal(Math.round(s.gainPct * 100), 10)
})

test('netWorthSeries adds month-end bank balance and account values', () => {
  const txs = [tx('2026-08-01', 'COOP', -10, 5000), tx('2026-08-30', 'COOP', -10, 4990), tx('2026-09-27', 'Överf ISK sparplan', -1500, 3490)]
  const series = netWorthSeries(txs, [isk({ snapshots: [{ month: '2026-09', value: 1550 }, { month: '2026-10', value: 1600 }] })])
  assert.deepEqual(series.map((r) => [r.month, r.cash, r.total]), [['2026-08', 4990, 4990], ['2026-09', 3490, 5040], ['2026-10', 3490, 5090]])
})

test('checklist asks for account values that are out of date', () => {
  const txs = [tx('2026-09-02', 'COOP', -1)]
  const stale = checklist(txs, {}, [], [], '2026-09', {}, [isk({ snapshots: [{ month: '2026-08', value: 1 }] })]).find((i) => i.id === 'accounts')
  const fresh = checklist(txs, {}, [], [], '2026-09', {}, [isk({ snapshots: [{ month: '2026-09', value: 1 }] })]).find((i) => i.id === 'accounts')
  assert.deepEqual([stale.count, fresh.count], [1, 0])
})


// Sample exports in each bank's layout (made-up rows). Every one should give the same three transactions.
const WANT = [['2026-09-01', 'COOP VASASTAN', -129.5], ['2026-09-02', 'Swish från Kim Berg', 250], ['2026-09-03', 'SPOTIFY', -1129]]
const check = (rows) => assert.deepEqual(parseStatement(rows).map((t) => [t.date, t.text, t.amount]), WANT)

test('bank formats: Swedbank CSV (comma, dot decimals, report line on top)', () => check(parseCsv(
`* Transaktioner Period 2026-09-01 - 2026-09-30 Skapad 2026-10-01
Radnummer,Clearingnummer,Kontonummer,Produkt,Valuta,Bokföringsdag,Transaktionsdag,Valutadag,Referens,Beskrivning,Belopp,Bokfört saldo
3,8000,123,Privatkonto,SEK,2026-09-03,2026-09-03,2026-09-03,SPOTIFY,SPOTIFY,-1129.00,8620.50
2,8000,123,Privatkonto,SEK,2026-09-02,2026-09-02,2026-09-02,Kim Berg,"Swish från Kim Berg",250.00,9749.50
1,8000,123,Privatkonto,SEK,2026-09-01,2026-09-01,2026-09-01,COOP,COOP VASASTAN,-129.50,9499.50`)))

test('bank formats: Handelsbanken (semicolon, Swedish numbers, unicode minus)', () => check(parseCsv(
`Kontoutdrag Allkonto
Reskontradatum;Transaktionsdatum;Text;Belopp;Saldo
2026-09-01;2026-09-01;COOP VASASTAN;−129,50;9 499,50
2026-09-02;2026-09-02;Swish från Kim Berg;250,00;9 749,50
2026-09-03;2026-09-03;SPOTIFY;−1 129,00;8 620,50`)))

test('bank formats: SEB (newest first, Text/mottagare)', () => check([
  ['Bokföringsdatum', 'Valutadatum', 'Verifikationsnummer', 'Text/mottagare', 'Belopp', 'Saldo'],
  ['2026-09-03', '2026-09-03', '5484', 'SPOTIFY', -1129, 8620.5],
  ['2026-09-02', '2026-09-02', '5483', 'Swish från Kim Berg', 250, 9749.5],
  ['2026-09-01', '2026-09-01', '5482', 'COOP VASASTAN', -129.5, 9499.5],
]))

test('bank formats: Nordea (slashes in dates, Rubrik as text)', () => check(parseCsv(
`Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta
2026/09/03;-1129,00;;;SPOTIFY;SPOTIFY;8620,50;SEK
2026/09/02;250,00;;;Kim Berg;Swish från Kim Berg;9749,50;SEK
2026/09/01;-129,50;;;COOP;COOP VASASTAN;9499,50;SEK`)))

test('bank formats: ICA Banken ("kr" suffix) and separate deposit/withdrawal columns without balance', () => {
  check(parseCsv(`Datum;Text;Typ;Budgetgrupp;Belopp;Saldo
2026-09-03;SPOTIFY;Korttransaktion;Nöje;-1 129,00 kr;8 620,50 kr
2026-09-02;Swish från Kim Berg;Swish;Övrigt;250,00 kr;9 749,50 kr
2026-09-01;COOP VASASTAN;Korttransaktion;Mat;-129,50 kr;9 499,50 kr`))
  const split = parseStatement([['Datum', 'Beskrivning', 'Insättning', 'Uttag'], ['2026-09-01', 'COOP VASASTAN', '', '129,50'], ['2026-09-02', 'Swish från Kim Berg', '250', ''], ['2026-09-03', 'SPOTIFY', '', '-1129']])
  assert.deepEqual(split.map((t) => [t.date, t.text, t.amount]), WANT)
  assert.equal(split[0].balance, null)
})

test('no balance: identical purchases on one day stay separate and re-imports are skipped', () => {
  const rows = [['Datum', 'Text', 'Belopp'], ['2026-09-01', 'ICA', '-10'], ['2026-09-01', 'ICA', '-10']]
  const a = parseStatement(rows), b = parseStatement(rows)
  assert.equal(mergeTx(a, b).added, 0)
  assert.equal(mergeTx([], a).all.length, 2)
})

test('number, date and text decoding helpers', () => {
  assert.deepEqual(['−1 234,50 kr', '-1.234,50', '1234.5', 'x'].map(parseAmount).slice(0, 3), [-1234.5, -1234.5, 1234.5])
  assert.ok(Number.isNaN(parseAmount('x')))
  assert.deepEqual([parseDate('30.09.2026'), parseDate(46295), parseDate('Summa')], ['2026-09-30', '2026-09-30', null])
  assert.equal(decodeText(new Uint8Array([0x53, 0x77, 0x69, 0x73, 0x68, 0x20, 0x66, 0x72, 0xe5, 0x6e])), 'Swish från') // Windows-1252 å
})

test('a late rent payment is suggested for the month before, and moving it fixes both months', () => {
  const rent = (date) => ({ date, text: 'HYRA BRF', amount: -7800, balance: null, seq: date })
  const txs = [rent('2026-07-28'), rent('2026-08-27'), { date: '2026-09-15', text: 'ICA', amount: -300, balance: null, seq: 1 }, rent('2026-10-02'), rent('2026-10-28')]
  const late = latePayments(txs, '2026-10')
  assert.equal(late.length, 1)
  assert.equal(late[0].tx.date, '2026-10-02')
  assert.equal(late[0].to, '2026-09')
  const moved = withMoves(txs, { [txKey(late[0].tx)]: '2026-09' })
  const rows = Object.fromEntries(monthly(moved, {}).map((r) => [r.month, r.spending]))
  assert.equal(rows['2026-09'], 8100)
  assert.equal(rows['2026-10'], 7800)
  assert.equal(latePayments(moved, '2026-10').length, 0)
  // choosing to keep it in October also stops the suggestion
  assert.equal(latePayments(withMoves(txs, { [txKey(late[0].tx)]: '2026-10' }), '2026-10').length, 0)
})

test('planInfo finds the plan from the price and what switching saves', () => {
  const [s] = subscriptionStats([tx('2026-09-03', 'NETFLIX.COM', -169), tx('2026-10-03', 'NETFLIX.COM', -169)], [svc('Netflix')])
  const p = planInfo(s)
  assert.equal(p.current, 'Standard')
  assert.equal(p.guessed, true)
  assert.equal(p.paid, 338)
  assert.deepEqual(p.plans.map((x) => x.perYear), [-480, 0, 600])
  // a plan you picked yourself wins over the guess, and unknown prices give no guess
  assert.equal(planInfo({ ...s, plan: 'Premium' }).current, 'Premium')
  assert.equal(planInfo({ ...s, monthlyCost: 150, price: 150 }).current, null)
  // services without plan data, like Telia, give nothing
  assert.equal(planInfo({ ...svc('Telia'), price: 399, monthlyCost: 399, prices: [399] }), null)
})

test('planInfo shows the saving from yearly billing', () => {
  const [s] = subscriptionStats([tx('2026-10-03', 'HBOMAX', -149)], [svc('HBO Max')])
  assert.equal(planInfo(s).yearlySaving, 298)
})

test('your own rules come after your choice for a payee but before Kassa, and can look at the amount', () => {
  const rules = [{ text: 'swish', over: 1000, category: 'Överföring' }, { text: 'ICA', category: 'Mat' }]
  const txs = withRules([tx('2026-10-01', 'Swish till Sam Ek', -1500), tx('2026-10-02', 'Swish till Sam Ek', -200), tx('2026-10-03', 'ICA NARA HORNSTULL', -90), tx('2026-10-04', 'MUSICAL TICKETS', -400)], rules)
  assert.deepEqual(txs.map((t) => categorize(t)).slice(0, 3), ['Överföring', 'Swish', 'Mat'])
  assert.equal(txs[3].rule, undefined) // whole words only
  assert.equal(categorize(txs[2], { 'ICA NARA HORNSTULL': 'Restaurang & café' }), 'Restaurang & café')
  assert.equal(chosenCategory(txs[2]), 'Mat')
})

test('ruleSuggestion offers a rule when other payees share the first word', () => {
  const txs = [tx('2026-10-01', 'ICA NARA HORNSTULL', -90), tx('2026-10-02', 'ICA KVANTUM', -300), tx('2026-10-03', 'ICA KVANTUM', -100), tx('2026-10-04', 'COOP', -50)]
  assert.deepEqual(ruleSuggestion(txs, {}, 'ICA NARA HORNSTULL', 'Mat'), { text: 'ICA', category: 'Mat', payees: 1, count: 3 })
  assert.equal(ruleSuggestion(txs, {}, 'COOP', 'Mat'), null)
})

test('forecast adds regular payments still to come and usual daily spending', () => {
  const txs = []
  for (const m of ['08', '09']) txs.push(tx(`2026-${m}-02`, 'HYRA BRF', -8000), tx(`2026-${m}-25`, 'LÖN ACME', 30000), tx(`2026-${m}-10`, 'ICA', -3100), tx(`2026-${m}-20`, 'ICA', -3000))
  txs.push(tx('2026-10-02', 'HYRA BRF', -8000), tx('2026-10-10', 'ICA', -2000))
  const f = forecast(txs, {}, '2026-10')
  assert.equal(f.soFar, -10000)
  assert.deepEqual(f.left, [{ name: 'Lön Acme', amount: 30000 }])
  assert.equal(f.daysLeft, 21)
  assert.equal(Math.round(f.perDay), 200) // 12 200 kr of ICA over 61 days
  assert.equal(Math.round(f.total), 30000 - 10000 - 4200)
  assert.equal(forecast(txs, {}, '2026-09'), null)
})
