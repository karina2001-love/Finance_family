'use strict';
// ───────── helpers ─────────
const $ = (s) => document.querySelector(s);
const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const HORIZON = 84;
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const usd = (n) => (n < 0 ? '−' : '') + '$' + nf.format(Math.abs(Math.round(n)));
const kzt = (n) => (n < 0 ? '−' : '') + nf.format(Math.abs(Math.round(n))) + ' ₸';
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const sum = (arr, f) => (arr || []).reduce((a, x) => a + num(typeof f === 'function' ? f(x) : x[f]), 0);
const clone = (o) => JSON.parse(JSON.stringify(o));
const r2 = (n) => Math.round(n * 100) / 100;
const isoD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => isoD(new Date());
const shortD = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'][m - 1]}`; };
const hasF = (x) => x.fact !== undefined && x.fact !== null && x.fact !== '';

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const keyOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const parseKey = (k) => { const [y, m] = k.split('-').map(Number); return [y, m - 1]; };
const shiftKey = (k, n) => { const [y, m] = parseKey(k); const t = y * 12 + m + n; return keyOf(Math.floor(t / 12), t % 12); };
const keyDiff = (a, b) => { const [ya, ma] = parseKey(a), [yb, mb] = parseKey(b); return ya * 12 + ma - (yb * 12 + mb); };
const monthTitle = (k) => { const [y, m] = parseKey(k); return `${MN[m]} ${y}`; };
const monthIn = (k) => { const [y, m] = parseKey(k); return `${MP[m]} ${y}`; };
const todayKey = () => { const d = new Date(); return keyOf(d.getFullYear(), d.getMonth()); };

// ───────── данные ─────────
function seed() {
  return {
    v: 5,
    settings: {
      goal: 200000, startBalance: 26496, startMonth: '2026-10', cushionMonths: 6,
      rateMode: 'auto', rate: 450.79, rateBase: 0, rateSource: '', rateUpdated: 0, rateSpread: 0,
      incomeTemplate: [{ id: uid(), name: 'Зарплата №1', usd: 7150 }, { id: uid(), name: 'Зарплата №2', usd: 5600 }],
      recurring: [],
      accounts: [
        { id: uid(), name: 'Банк · доллары', ccy: 'USD', amount: 26496, kind: 'bank' },
        { id: uid(), name: 'Наличные · доллары', ccy: 'USD', amount: 0, kind: 'cash' },
        { id: uid(), name: 'Наличные · тенге', ccy: 'KZT', amount: 0, kind: 'cash' },
      ],
    },
    months: {
      '2026-10': {
        incomes: [{ id: uid(), name: 'Зарплата №2 (ожидается)', usd: 5600, fact: null }],
        expenses: [
          { id: uid(), name: 'Адиль', kzt: 500000, fact: null }, { id: uid(), name: 'Цветы', kzt: 150000, fact: null },
          { id: uid(), name: 'Машина', kzt: 280000, fact: null }, { id: uid(), name: 'Каско', kzt: 700000, fact: null },
          { id: uid(), name: 'Таиланд', kzt: 1500000, fact: null },
        ],
        note: 'Старт. Зарплата №1 за октябрь уже получена и входит в остаток.',
      },
    },
  };
}
function fromOld(d) {
  const S0 = seed(), o = d.settings || {};
  for (const k of ['goal', 'cushionMonths', 'rateMode', 'rate', 'rateBase', 'rateSource', 'rateUpdated', 'rateSpread']) if (o[k] !== undefined) S0.settings[k] = o[k];
  return S0;
}
let S = null, model = null, dirty = false, lastSaved = 0;

// ───────── расчёт ─────────
function currentIndex() { return Math.max(0, Math.min(HORIZON - 1, keyDiff(todayKey(), S.settings.startMonth))); }
const incE = (x) => (hasF(x) ? num(x.fact) : num(x.usd));
const expE = (x) => (hasF(x) ? num(x.fact) : num(x.kzt));
function cushionTarget() { const s = S.settings; return (sum(s.recurring, 'kzt') / (num(s.rate) || 1)) * num(s.cushionMonths); }

function calc(adj) {
  const s = S.settings, rows = [], cur0 = currentIndex(), cT = cushionTarget();
  let bal = num(s.startBalance);
  for (let i = 0; i < HORIZON; i++) {
    const key = shiftKey(s.startMonth, i), ov = S.months[key] || {};
    const incomes = ov.incomes || s.incomeTemplate, expenses = ov.expenses || s.recurring;
    const rate = num(ov.rate) > 0 ? num(ov.rate) : num(s.rate);
    const future = adj && i > cur0;
    const inc = sum(incomes, incE) + (future ? adj.extra : 0);
    const expKzt = sum(expenses, expE) * (future ? 1 - adj.cut : 1);
    const expUsd = rate > 0 ? expKzt / rate : 0;
    const planned = bal + inc - expUsd;
    const hasFact = ov.actual !== undefined && ov.actual !== null && ov.actual !== '';
    const end = hasFact ? num(ov.actual) : planned;
    rows.push({ key, i, start: bal, inc, incPlan: sum(incomes, 'usd'), incFact: sum(incomes.filter(hasF), 'fact'), expKzt, expPlan: sum(expenses, 'kzt'), expFact: sum(expenses.filter(hasF), 'fact'), expUsd, rate, planned, end, hasFact, incomes, expenses, ov, custom: !!ov.expenses,
      cushStart: Math.min(Math.max(0, bal), cT), houseStart: Math.max(0, bal - cT), cush: Math.min(Math.max(0, end), cT), house: Math.max(0, end - cT) });
    bal = end;
  }
  const goal = num(s.goal) || 1;
  return { rows, goal, cT, eta: rows.findIndex((r) => r.house >= goal && r.end >= goal + cT), etaC: cT > 0 ? rows.findIndex((r) => r.end >= cT) : -1, cur: cur0 };
}
const accountsUsd = () => sum(S.settings.accounts, (a) => (a.ccy === 'USD' ? a.amount : num(a.amount) / (num(S.settings.rate) || 1)));

// ───────── сохранение ─────────
let saveTimer = null;
function setSave(txt, cls) { const el = $('#saveState'); el.textContent = txt; el.className = 'save ' + (cls || ''); }
function scheduleSave() { dirty = true; setSave('Сохраняю…'); clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 700); }
async function doSave() {
  try {
    const r = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: S }) });
    if (r.status === 401) return showLogin();
    const j = await r.json(); if (!r.ok) throw new Error(j.error);
    lastSaved = S.updatedAt = j.updatedAt; dirty = false; setSave('Сохранено ✓', 'ok');
  } catch (e) { setSave('Нет связи — повторю', 'bad'); saveTimer = setTimeout(doSave, 4000); }
}
async function load() {
  const r = await fetch('/api/data');
  if (r.status === 401) return false;
  const { data } = await r.json();
  if (data && data.v === 5) { S = data; lastSaved = data.updatedAt || 0; }
  else { S = data ? fromOld(data) : seed(); scheduleSave(); }
  return true;
}

// ───────── вход ─────────
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); setTimeout(() => $('#pw').focus(), 50); }
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const card = $('#loginForm'); $('#loginErr').textContent = '';
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
  if (r.ok) { $('#pw').value = ''; await start(); }
  else { $('#loginErr').textContent = 'Неверный пароль'; card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); $('#pw').select(); }
});
$('#btnLogout').onclick = async () => { await fetch('/api/logout', { method: 'POST' }); location.reload(); };
$('#btnSettings').onclick = () => openSettings();
$('#rateChip').onclick = () => refreshRate(true);

// ───────── курс: Нацбанк РК, обновляется сам ─────────
async function refreshRate(manual) {
  const chip = $('#rateChip'); chip.classList.add('spin');
  try {
    const r = await fetch('/api/rate'); if (r.status === 401) return showLogin();
    const j = await r.json(); if (!r.ok) throw new Error();
    const s = S.settings;
    s.rateBase = j.rate; s.rateSource = j.source; s.rateUpdated = j.updatedAt;
    if (s.rateMode === 'auto') s.rate = r2(j.rate + num(s.rateSpread));
    scheduleSave();
    if (manual) toast(`${j.source}: ${j.rate} ₸ за $`);
  } catch { if (manual) toast('Не удалось получить курс'); }
  chip.classList.remove('spin'); render(false);
}
function paintRate() {
  const s = S.settings, chip = $('#rateChip');
  const when = s.rateUpdated ? new Date(s.rateUpdated).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
  chip.innerHTML = `$1 = <b>${s.rate} ₸</b><small>${s.rateMode === 'auto' && s.rateSource ? s.rateSource + ' · ' + when : 'вручную'}</small>`;
  if (chip.classList.contains('spin')) chip.classList.add('spin');
}

// ───────── анимации ─────────
let animOn = true;
function countUp(el, to, fmt, dur = 1400) {
  if (!animOn) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400); }

// ───────── ДАШБОРД ─────────
function render(anim) {
  animOn = anim; model = calc();
  const { rows, goal, eta, etaC, cur, cT } = model, s = S.settings;
  const dash = $('#dash'); dash.className = anim ? '' : 'static'; dash.innerHTML = '';
  $('#subtitle').textContent = `Копим на дом ${usd(goal)}${cT > 0 ? ' + подушку ' + usd(cT) : ''}`;
  paintRate();

  const ban = $('#banner'); ban.innerHTML = '';
  if (!sum(s.recurring, 'kzt'))
    ban.append(h('div', { class: 'banner' }, h('span', {}, '💡 Постоянные ежемесячные расходы пока не внесены — прогноз слишком оптимистичен, а подушка не посчитана.'), h('button', { class: 'btn small', onclick: () => openSettings() }, 'Заполнить')));
  // сверка раз в месяц — 1-го числа
  const d = new Date(), day = d.getDate();
  const nextD = day === 1 ? d : new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const left = Math.round((nextD - new Date(d.getFullYear(), d.getMonth(), day)) / 864e5);
  ban.append(h('div', { class: 'banner cool' }, h('span', {}, left === 0 ? '🗓 Сегодня день сверки! Внесите данные: сколько денег, что пришло, что оплатили.' : `🗓 Данные вносим раз в месяц, 1-го числа. Следующий раз: ${nextD.getDate()} ${MG[nextD.getMonth()]} (через ${left} дн.)`), h('button', { class: 'btn small', onclick: () => openWizard() }, 'Внести данные')));

  if (!s.hideHelp) ban.append(h('div', { class: 'banner cool', style: 'display:block' },
    h('b', {}, 'Как пользоваться'),
    h('div', { class: 'hint', style: 'margin:6px 0 10px;font-size:13px' }, '1. Раз в месяц, 1-го числа, нажмите «Внести данные». 2. Впишите, сколько денег на картах и сколько наличными, что пришло и что оплатили (с датами). 3. Сайт сам пересчитает, сколько накоплено и когда будет дом.'),
    h('button', { class: 'btn small', onclick: () => { s.hideHelp = true; scheduleSave(); render(false); } }, 'Понятно, скрыть')));
  const row = rows[cur];
  const pct = Math.max(0, Math.min(1, row.houseStart / goal));
  const nx = rows[Math.min(cur + 1, rows.length - 1)], saving = nx.inc - nx.expUsd;

  const R = 100, C = 2 * Math.PI * R;
  const ring = h('div', { class: 'ring-wrap', html: `<svg viewBox="0 0 240 240"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8a93b"/><stop offset="1" stop-color="#2f9e7a"/></linearGradient></defs><circle class="ring-bg" cx="120" cy="120" r="${R}"/><circle class="ring-fg" id="ringFg" cx="120" cy="120" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${anim ? C : C * (1 - pct)}"/></svg><div class="ring-center"><b id="pctNum">0%</b><span>пути к цели</span></div>` });
  const nowNum = h('h2', {}, '$0');
  dash.append(h('section', { class: 'card grid hero' }, ring, h('div', { class: 'hero-text' },
    h('span', { class: 'sub' }, `Сейчас, ${monthTitle(row.key).toLowerCase()}`), nowNum,
    h('div', { class: 'big' }, `Всего накоплено ${usd(row.start)} · к концу месяца по плану ${usd(row.end)}${row.hasFact ? ' (факт)' : ''}`),
    h('div', { class: 'etas' },
      eta >= 0 ? h('div', { class: 'eta' }, `Цель в ${monthIn(rows[eta].key)} · через ${Math.max(0, eta - cur)} мес.`) : h('div', { class: 'eta' }, `За ${HORIZON} мес. цель не достигается`),
      etaC >= 0 ? h('div', { class: 'eta' }, `Подушка в ${monthIn(rows[etaC].key)}`) : null))));
  countUp($('#pctNum'), pct * 100, (v) => Math.round(v) + '%');
  countUp(nowNum, row.houseStart, usd);
  if (anim) requestAnimationFrame(() => requestAnimationFrame(() => { const fg = $('#ringFg'); if (fg) fg.style.strokeDashoffset = C * (1 - pct); }));

  const stat = (label, val, f, sub, cls, delay) => {
    const b = h('b', { class: cls || '' }, '0'); setTimeout(() => countUp(b, val, f), 0);
    return h('div', { class: 'card stat', style: `animation-delay:${delay}ms` }, h('small', {}, label), b, h('em', {}, sub));
  };
  dash.append(h('div', { class: 'grid stats s2' },
    stat('Осталось до цели', Math.max(0, goal - row.houseStart), usd, `из ${usd(goal)}`, '', 100),
    stat('Накопления в месяц', saving, usd, 'в следующем месяце по плану', saving >= 0 ? 'pos' : 'neg', 180)));

  dash.append(flowSection(), historyCard());

  dash.append(h('div', { class: 'grid two' }, cardsCard(), cashCard()), h('div', { class: 'grid two' }, totalCard(row), cushionCard(row)));

  const chartCard = h('section', { class: 'card' }, h('h3', {}, 'Путь к цели — нажмите на точку'), h('div', { class: 'chart-wrap', id: 'chartWrap' }));
  dash.append(h('div', { class: 'grid row2' }, chartCard, h('section', { class: 'card' }, h('h3', {}, `Расходы · ${monthTitle(row.key)}`), barsFor(row))));
  drawChart(anim);

  const wrap = h('section', { class: 'card months' }, h('h3', {}, 'Все месяцы — нажмите, чтобы внести изменения'));
  let year = null, box = null;
  rows.forEach((r) => {
    const y = parseKey(r.key)[0];
    if (y !== year) { year = y; wrap.append(h('div', { class: 'year' }, y)); box = h('div', { class: 'chips' }); wrap.append(box); }
    const past = r.i < cur, tag = r.hasFact ? '✓' : past ? '✏️' : r.i === cur ? '●' : '';
    box.append(h('button', { class: `chip${r.i === cur ? ' cur' : ''}${r.hasFact ? ' done' : ''}${r.house >= goal && r.end >= goal + cT ? ' reached' : ''}`, style: `animation-delay:${Math.min(r.i, 20) * 25}ms`, onclick: () => openMonth(r.key), title: r.hasFact ? 'Внесён факт' : past ? 'Месяц прошёл — внесите факт' : '' },
      h('span', { class: 'tag' }, tag), h('div', { class: 'm' }, MN[parseKey(r.key)[1]]), h('div', { class: 'v' }, usd(r.end)),
      h('div', { class: 'pbar', style: 'height:5px;margin:0' }, h('i', { style: `width:${Math.max(0, Math.min(100, (r.end / (goal + cT)) * 100))}%;animation:none` }))));
  });
  dash.append(wrap);
  dash.append(advisorCard());
}


// ───────── Деньги месяца: доходы | расходы | итог ─────────
let flowIdx = null;
function monthList(key, kind) {
  const o = (S.months[key] = S.months[key] || {});
  if (!o[kind]) o[kind] = clone(kind === 'incomes' ? S.settings.incomeTemplate : S.settings.recurring).map((x) => ({ ...x, fact: null }));
  return o[kind];
}
function flowList(r, kind) {
  const inc = kind === 'incomes', field = inc ? 'usd' : 'kzt', items = inc ? r.incomes : r.expenses;
  const real = () => monthList(r.key, kind), box = h('div', { class: 'fl-list' });
  box.append(h('div', { class: 'fl head' }, h('span'), h('span', {}, inc ? 'Откуда' : 'На что'), h('span', {}, 'План'), h('span', {}, inc ? 'Пришло' : 'Оплачено'), h('span')));
  if (!items.length) box.append(h('div', { class: 'empty' }, inc ? 'Доходов пока нет.' : 'Расходов пока нет.'));
  const t = (it) => real().find((x) => x.id === it.id) || it;
  items.forEach((it) => { box.append(h('div', { class: 'fl' },
    h('input', { type: 'checkbox', title: inc ? 'Деньги пришли' : 'Оплачено', checked: hasF(it) ? 'checked' : false, onchange: (e) => { const o = t(it); o.fact = e.target.checked ? num(o[field]) : null; if (e.target.checked && !o.date) o.date = todayISO(); scheduleSave(); render(false); } }),
    h('input', { class: 'in', value: it.name, placeholder: inc ? 'Источник' : 'На что', onchange: (e) => { t(it).name = e.target.value; scheduleSave(); render(false); } }),
    h('input', { class: 'in', type: 'number', inputmode: 'decimal', value: it[field] || false, placeholder: '0', onchange: (e) => { t(it)[field] = num(e.target.value); scheduleSave(); render(false); } }),
    h('input', { class: 'in', type: 'number', inputmode: 'decimal', value: hasF(it) ? it.fact : false, placeholder: '—', onchange: (e) => { const o = t(it); o.fact = e.target.value === '' ? null : num(e.target.value); if (hasF(o) && !o.date) o.date = todayISO(); scheduleSave(); render(false); } }),
    h('button', { class: 'x', title: 'Удалить', onclick: () => { const a = real(); a.splice(a.findIndex((x) => x.id === it.id), 1); scheduleSave(); render(false); } }, '×')));
    if (hasF(it)) box.append(dateRow(it, t, inc ? 'Когда пришло' : 'Когда оплачено', afterDash)); });
  return box;
}
function flowSection() {
  const { rows, cur, goal, cT } = model, fi = Math.max(0, Math.min(rows.length - 1, flowIdx == null ? cur : flowIdx)), r = rows[fi];
  const left = r.inc - r.expUsd;
  const prog = (a, b, color) => h('div', { class: 'pbar', style: 'height:8px;margin:4px 0 10px' }, h('i', { style: `width:${b ? Math.min(100, (a / b) * 100) : 0}%;background:${color}` }));
  const sec = h('section', { class: 'card flow' },
    h('div', { class: 'h3row' }, h('h3', {}, `Деньги месяца · ${monthTitle(r.key)}`),
      h('div', { class: 'nav' }, h('button', { onclick: () => { flowIdx = Math.max(0, fi - 1); render(false); } }, '‹'), h('button', { title: 'Текущий месяц', onclick: () => { flowIdx = null; render(false); } }, '•'), h('button', { onclick: () => { flowIdx = Math.min(rows.length - 1, fi + 1); render(false); } }, '›'))));
  const incCol = h('div', { class: 'fcol inc' },
    h('div', { class: 'fhead' }, h('b', {}, '＋ Доходы'), h('button', { class: 'btn small inc', onclick: () => { monthList(r.key, 'incomes').push({ id: uid(), name: '', usd: 0, fact: null }); scheduleSave(); render(false); } }, '＋ Добавить доход')),
    flowList(r, 'incomes'),
    h('div', { class: 'ftot' }, h('span', {}, 'Всего доходов'), h('b', { class: 'pos' }, usd(r.inc))),
    h('div', { class: 'hint' }, `Пришло ${usd(r.incFact)} из ${usd(r.incPlan)}`), prog(r.incFact, r.incPlan, 'var(--green)'));
  const expCol = h('div', { class: 'fcol exp' },
    h('div', { class: 'fhead' }, h('b', {}, '− Расходы'), h('button', { class: 'btn small exp', onclick: () => { monthList(r.key, 'expenses').push({ id: uid(), name: '', kzt: 0, fact: null }); scheduleSave(); render(false); } }, '＋ Добавить расход')),
    flowList(r, 'expenses'),
    h('div', { class: 'ftot' }, h('span', {}, 'Всего расходов'), h('b', { class: 'neg' }, kzt(r.expKzt))),
    h('div', { class: 'hint' }, `≈ ${usd(r.expUsd)} · оплачено ${kzt(r.expFact)} из ${kzt(r.expPlan)}`), prog(r.expFact, r.expPlan, 'var(--red)'));
  const resCol = h('div', { class: 'fcol res' },
    h('div', { class: 'fhead' }, h('b', {}, '＝ Итог месяца')),
    h('div', { class: 'eq' }, h('span', {}, 'Доходы'), h('b', { class: 'pos' }, '+ ' + usd(r.inc))),
    h('div', { class: 'eq' }, h('span', {}, 'Расходы'), h('b', { class: 'neg' }, '− ' + usd(r.expUsd))),
    h('div', { class: 'eqline' }),
    h('div', { class: 'eq big' }, h('span', {}, left >= 0 ? 'Остаётся' : 'Не хватает'), h('b', { class: left >= 0 ? 'pos' : 'neg' }, usd(left))),
    h('div', { class: 'hint', style: 'margin-top:12px' }, `На начало месяца ${usd(r.start)}`),
    h('div', { class: 'hint' }, h('b', { style: 'color:var(--ink)' }, `На конец ${usd(r.end)}`), r.hasFact ? ' (факт)' : ' по плану'),
    h('div', { class: 'hint' }, `Это ${Math.round((r.end / (goal + cT)) * 100)}% цели`));
  sec.append(h('div', { class: 'flowgrid' }, incCol, expCol, resCol));
  sec.append(h('div', { class: 'hint', style: 'margin-top:12px' }, 'Галочка = уже пришло / уже оплачено. Если сумма другая — впишите её в последний столбец. Всё автоматически сходится в «Итоге».'));
  return sec;
}


function historyCard() {
  const { rows, cur } = model, fi = Math.max(0, Math.min(rows.length - 1, flowIdx == null ? cur : flowIdx)), r = rows[fi];
  const ev = [...r.incomes.filter(hasF).map((x) => ({ d: x.date || '', name: x.name || 'Доход', txt: '+' + usd(x.fact), cls: 'pos' })), ...r.expenses.filter(hasF).map((x) => ({ d: x.date || '', name: x.name || 'Расход', txt: '−' + kzt(x.fact), cls: 'neg', sub: '≈ ' + usd(num(x.fact) / r.rate) }))]
    .sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  const card = h('section', { class: 'card', style: 'margin-top:16px' }, h('div', { class: 'h3row' }, h('h3', {}, `Учёт · ${monthTitle(r.key)}`), h('span', { class: 'hint' }, 'что и когда пришло и ушло')));
  if (!ev.length) { card.append(h('div', { class: 'empty' }, 'Пока записей нет. Поставьте галочку «пришло» или «оплачено» в блоке выше — запись появится здесь с датой.')); return card; }
  ev.forEach((e) => card.append(h('div', { class: 'hrow' }, h('span', { class: 'hd' }, e.d ? shortD(e.d) : '—'), h('span', { class: 'hn' }, e.name), h('span', { class: 'hs' }, e.sub || ''), h('b', { class: e.cls }, e.txt))));
  return card;
}

// карты и наличные — раздельно
const groupUsd = (kind) => sum(S.settings.accounts.filter((a) => a.kind === kind), (a) => (a.ccy === 'USD' ? a.amount : num(a.amount) / (num(S.settings.rate) || 1)));
function accGroup(kind, after) {
  const s = S.settings, box = h('div'), cash = kind === 'cash';
  const ccySel = (a) => { const el = h('select', {}, ...[['USD', '$'], ['KZT', '₸']].map(([v, t]) => h('option', { value: v, selected: v === a.ccy ? 'selected' : false }, t))); el.onchange = () => { a.ccy = el.value; after(); }; return el; };
  s.accounts.filter((a) => a.kind === kind).forEach((a) => box.append(h('div', { class: 'accrow acc2' },
    h('input', { value: a.name, placeholder: 'Название', onchange: (e) => { a.name = e.target.value; scheduleSave(); } }), ccySel(a),
    h('input', { type: 'number', inputmode: 'decimal', value: a.amount || false, placeholder: '0', onchange: (e) => { a.amount = num(e.target.value); after(); } }),
    h('button', { class: 'x', style: 'border:0;background:none;color:var(--muted);cursor:pointer;font-size:18px', title: 'Удалить', onclick: () => { s.accounts.splice(s.accounts.indexOf(a), 1); after(); } }, '×'))));
  box.append(h('button', { class: 'linkbtn', onclick: () => { s.accounts.push({ id: uid(), name: cash ? 'Наличные' : 'Новый счёт', ccy: 'USD', amount: 0, kind }); after(); } }, cash ? '＋ Ещё кошелёк / валюта' : '＋ Ещё карта или счёт'));
  return box;
}
const afterDash = () => { scheduleSave(); render(false); };
function cardsCard() {
  return h('section', { class: 'card' }, h('div', { class: 'h3row' }, h('h3', {}, '💳 Карты и счета'), h('b', { style: 'font-size:20px' }, usd(groupUsd('bank')))),
    accGroup('bank', afterDash), h('div', { class: 'hint', style: 'margin-top:8px' }, 'Сколько на картах и банковских счетах сейчас.'));
}
function cashCard() {
  const s = S.settings, cash = s.accounts.filter((a) => a.kind === 'cash'), kz = sum(cash.filter((a) => a.ccy === 'KZT'), 'amount'), us = sum(cash.filter((a) => a.ccy === 'USD'), 'amount');
  return h('section', { class: 'card' }, h('div', { class: 'h3row' }, h('h3', {}, '💵 Наличные'), h('b', { style: 'font-size:20px' }, usd(groupUsd('cash')))),
    accGroup('cash', afterDash), h('div', { class: 'hint', style: 'margin-top:8px' }, `Отдельно от карт: просто впишите, сколько наличных есть. Сейчас: ${usd(us)} и ${kzt(kz)}.`));
}
function totalCard(row) {
  const s = S.settings, total = accountsUsd(), diff = total - row.start, ok = Math.abs(diff) <= Math.max(50, row.start * 0.01);
  return h('section', { class: 'card' }, h('h3', {}, 'Всего денег'),
    h('div', { class: 'eq' }, h('span', {}, '💳 Карты и счета'), h('b', {}, usd(groupUsd('bank')))),
    h('div', { class: 'eq' }, h('span', {}, '💵 Наличные'), h('b', {}, usd(groupUsd('cash')))),
    h('div', { class: 'eqline' }), h('div', { class: 'eq big' }, h('span', {}, 'Итого'), h('b', {}, usd(total))),
    h('div', { class: 'hint', style: 'margin-top:8px' }, ok ? '✓ Сходится с расчётом платформы.' : `По расчёту должно быть ${usd(row.start)}. Разница ${usd(diff)}. `,
      ok ? null : h('a', { onclick: () => { if (!confirm(`Принять ${usd(total)} как реальный остаток на начало месяца?`)) return; if (row.i === 0) s.startBalance = Math.round(total); else (S.months[model.rows[row.i - 1].key] = S.months[model.rows[row.i - 1].key] || {}).actual = Math.round(total); scheduleSave(); render(false); toast('Остаток обновлён'); } }, 'Принять сумму как реальную')));
}
function cushionCard(row) {
  const { cT, etaC, rows } = model, s = S.settings;
  const card = h('section', { class: 'card' }, h('h3', {}, 'Подушка безопасности'));
  if (cT <= 0) {
    card.append(h('div', { class: 'empty' }, 'Подушка — это несколько месяцев обязательных расходов на случай потери дохода. Чтобы её посчитать, внесите постоянные расходы в месяц.'), h('button', { class: 'btn small', onclick: () => openSettings() }, 'Внести расходы'));
    return card;
  }
  const saved = row.cushStart;
  card.append(h('div', { class: 'row', style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('b', { style: 'font-size:28px' }, usd(saved)), h('span', { class: 'hint' }, `нужно ${usd(cT)} (${s.cushionMonths} мес. расходов)`)),
    h('div', { class: 'pbar' }, h('i', { style: `width:${Math.min(100, (saved / cT) * 100)}%` })),
    h('div', { class: 'hint' }, etaC >= 0 ? `Заполнится в ${monthIn(rows[etaC].key)}. ` : '', 'Накопления идут сначала в подушку, потом на дом — так спокойнее, если что-то случится с доходом.'));
  return card;
}

function barsFor(row) {
  const items = row.expenses.filter((e) => expE(e) > 0).sort((a, b) => expE(b) - expE(a));
  if (!items.length) return h('div', { class: 'empty' }, 'Расходов в этом месяце нет. Нажмите, чтобы добавить.', h('div', { class: 'actions' }, h('button', { class: 'btn small', onclick: () => openMonth(row.key) }, '＋ Добавить')));
  const max = expE(items[0]), cols = ['#2f9e7a', '#e8a93b', '#4a8fe0', '#e2674f', '#9b7ede', '#3cb5c4', '#d97aa6'];
  const box = h('div', { class: 'bars' });
  items.forEach((e, i) => box.append(h('div', { class: 'bar', onclick: () => openMonth(row.key) },
    h('div', { class: 'bar-head' }, h('span', {}, (hasF(e) ? '✓ ' : '') + (e.name || 'Без названия')), h('span', {}, `${kzt(expE(e))} · ${usd(expE(e) / row.rate)}`)),
    h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${(expE(e) / max) * 100}%;background:${cols[i % cols.length]};opacity:${hasF(e) ? 1 : .55};animation-delay:${i * 90}ms` })))));
  box.append(h('div', { class: 'bar-head', style: 'margin-top:6px;font-weight:600' }, h('span', {}, 'Итого'), h('span', {}, `${kzt(row.expKzt)} · ${usd(row.expUsd)}`)));
  box.append(h('div', { class: 'hint' }, 'Светлые полоски — ещё не оплачено, яркие и ✓ — уже оплачено.'));
  return box;
}

function drawChart(anim) {
  const { rows, goal, eta, cur, cT } = model, wrap = $('#chartWrap'); if (!wrap) return;
  const target = goal + cT;
  const n = eta >= 0 ? Math.min(rows.length, eta + 4) : Math.min(rows.length, 24);
  const data = rows.slice(0, Math.max(2, n));
  const W = 700, H = 300, pl = 48, pr = 16, pt = 16, pb = 30;
  const maxY = Math.max(target * 1.08, ...data.map((r) => r.end)), minY = Math.min(0, ...data.map((r) => r.end));
  const x = (i) => pl + ((W - pl - pr) * i) / (data.length - 1), y = (v) => pt + (H - pt - pb) * (1 - (v - minY) / (maxY - minY));
  const step = Math.pow(10, Math.floor(Math.log10(target / 3))), tickStep = Math.ceil(target / 4 / step) * step;
  let svg = `<svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="lineGrad" x1="0" x2="1"><stop offset="0" stop-color="#e8a93b"/><stop offset="1" stop-color="#2f9e7a"/></linearGradient><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f9e7a" stop-opacity=".30"/><stop offset="1" stop-color="#2f9e7a" stop-opacity="0"/></linearGradient></defs>`;
  for (let t = Math.ceil(minY / tickStep) * tickStep; t <= maxY; t += tickStep) svg += `<line class="grid-line" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-t" x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${t >= 1000 ? t / 1000 + 'k' : t}</text>`;
  const every = Math.ceil(data.length / 8);
  data.forEach((r, i) => { if (i % every === 0) { const [yy, mm] = parseKey(r.key); svg += `<text class="axis-t" x="${x(i)}" y="${H - 8}" text-anchor="middle">${MS[mm]}${mm === 0 || i === 0 ? ' ' + String(yy).slice(2) : ''}</text>`; } });
  if (cT > 0) svg += `<line class="cush-line" x1="${pl}" x2="${W - pr}" y1="${y(cT)}" y2="${y(cT)}"/><text class="cush-t" x="${pl + 6}" y="${y(cT) - 6}">подушка ${usd(cT)}</text>`;
  svg += `<line class="goal-line" x1="${pl}" x2="${W - pr}" y1="${y(target)}" y2="${y(target)}"/><text class="goal-t" x="${W - pr}" y="${y(target) - 6}" text-anchor="end">цель ${usd(target)}</text>`;
  let d = `M${x(0)},${y(data[0].end)}`;
  for (let i = 1; i < data.length; i++) { const mx = (x(i - 1) + x(i)) / 2; d += ` C${mx},${y(data[i - 1].end)} ${mx},${y(data[i].end)} ${x(i)},${y(data[i].end)}`; }
  svg += `<path class="area" d="${d} L${x(data.length - 1)},${y(minY)} L${x(0)},${y(minY)}Z"/><path class="line" id="linePath" d="${d}"/>`;
  data.forEach((r, i) => { svg += `<circle class="pt${r.hasFact ? ' fact' : ''}${i === cur ? ' now' : ''}" cx="${x(i)}" cy="${y(r.end)}" r="5.5" style="animation-delay:${anim ? 900 + i * 40 : 0}ms"/><circle class="hit" data-i="${i}" cx="${x(i)}" cy="${y(r.end)}" r="16"/>`; });
  svg += '</svg><div class="tip" id="tip"></div>';
  wrap.innerHTML = svg;
  const path = $('#linePath');
  if (anim) { const len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len; path.getBoundingClientRect(); path.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.3,.7,.2,1)'; path.style.strokeDashoffset = 0; }
  const tip = $('#tip');
  wrap.querySelectorAll('.hit').forEach((el) => {
    const r = data[+el.dataset.i];
    el.addEventListener('mouseenter', () => { const bb = el.getBoundingClientRect(), wb = wrap.getBoundingClientRect(); tip.innerHTML = `<b>${monthTitle(r.key)}</b><br>${usd(r.end)} · ${Math.round((r.end / target) * 100)}% цели${r.hasFact ? '<br>✓ факт' : ''}`; tip.style.left = bb.left - wb.left + bb.width / 2 + 'px'; tip.style.top = bb.top - wb.top + 'px'; tip.classList.add('on'); });
    el.addEventListener('mouseleave', () => tip.classList.remove('on'));
    el.addEventListener('click', () => openMonth(r.key));
  });
}

// ───────── советник (компактно) ─────────
const adv = { cut: 0, extra: 0, loading: false, err: '' };
const etaText = (m) => (m.eta >= 0 ? monthIn(m.rows[m.eta].key) : 'не достигается');
function whatIfText() {
  const base = calc(), alt = calc({ cut: adv.cut / 100, extra: adv.extra });
  if (!adv.cut && !adv.extra) return 'Подвигайте ползунки — увидите, насколько быстрее купите дом.';
  if (alt.eta < 0) return 'Даже так цель за 7 лет не достигается.';
  if (base.eta < 0) return `Цель в ${etaText(alt)} — раньше, чем без изменений!`;
  const d = base.eta - alt.eta;
  return d > 0 ? `Цель на ${d} мес. раньше — в ${etaText(alt)} (было в ${etaText(base)})` : 'Нужно больше — эффект пока меньше месяца.';
}
function advisorCard() {
  const slider = (label, key, max, step, fmt) => {
    const out = h('b', {}, fmt(adv[key]));
    return h('label', { class: 'slider' }, h('span', {}, label, ' ', out), h('input', { type: 'range', min: 0, max, step, value: adv[key], oninput: (e) => { adv[key] = +e.target.value; out.textContent = fmt(adv[key]); $('#whatIf').textContent = whatIfText(); } }));
  };
  const a = S.advice, list = (arr) => h('ul', {}, ...(arr || []).map((t) => h('li', {}, t)));
  const ai = h('div', { class: 'ai' }, h('button', { class: 'btn primary', style: 'width:auto;padding:12px 20px', onclick: askAdvice, disabled: adv.loading ? 'disabled' : false }, adv.loading ? 'Claude думает…' : a ? 'Обновить разбор' : 'Разобрать финансы с Claude'));
  if (adv.err) ai.append(h('div', { class: 'err' }, adv.err));
  if (a) ai.append(h('p', { class: 'verdict' }, a.verdict),
    h('div', { class: 'cols' }, h('div', { class: 'col good' }, h('h4', {}, 'Сильные стороны'), list(a.strong)), h('div', { class: 'col bad' }, h('h4', {}, 'Слабые места'), list(a.weak))),
    (a.income || []).length ? h('div', { class: 'col inc' }, h('h4', {}, 'Как поднять доход'), list(a.income)) : null,
    h('h4', { class: 'act-h' }, 'Что сделать, чтобы быстрее'),
    ...(a.actions || []).map((x, i) => h('div', { class: 'action' }, h('div', { class: 'n' }, i + 1), h('div', {}, h('b', {}, x.title), h('span', { class: 'eff' }, x.effect), h('div', { class: 'hint' }, x.detail)))),
    h('div', { class: 'hint' }, 'Разбор от ' + new Date(a.at).toLocaleDateString('ru-RU')));
  return h('section', { class: 'card months' }, h('h3', {}, 'Как купить дом быстрее'),
    h('div', { class: 'sliders' }, slider('Сократить расходы на', 'cut', 50, 5, (v) => v + '%'), slider('Дополнительный доход в месяц', 'extra', 3000, 100, (v) => '+' + usd(v))),
    h('div', { class: 'whatif', id: 'whatIf' }, whatIfText()), ai);
}
async function askAdvice() {
  adv.loading = true; adv.err = ''; render(false);
  const m = calc(), s = S.settings, lim = m.eta >= 0 ? m.eta + 2 : 24;
  const summary = {
    сегодня: new Date().toISOString().slice(0, 10), цель_дом_usd: m.goal, подушка_usd: Math.round(m.cT), курс: s.rate, остаток_на_старте_usd: s.startBalance, деньги_на_счетах_usd: Math.round(accountsUsd()),
    доходы_по_умолчанию: s.incomeTemplate.map((i) => ({ имя: i.name, usd: num(i.usd) })), постоянные_расходы_kzt: s.recurring.map((e) => ({ имя: e.name, kzt: num(e.kzt) })),
    цель_будет: m.eta >= 0 ? m.rows[m.eta].key : null, подушка_будет: m.etaC >= 0 ? m.rows[m.etaC].key : null,
    месяцы: m.rows.slice(0, Math.min(m.rows.length, lim)).map((r) => ({ месяц: r.key, начало: Math.round(r.start), доход_план_usd: Math.round(r.incPlan), доход_факт_usd: Math.round(r.incFact), расход_план_kzt: Math.round(r.expPlan), расход_факт_kzt: Math.round(r.expFact), конец: Math.round(r.end), конец_факт: r.hasFact, расходы: r.expenses.map((e) => ({ имя: e.name, план: num(e.kzt), факт: hasF(e) ? num(e.fact) : null })), заметка: r.ov.note || undefined })),
  };
  try {
    const r = await fetch('/api/advice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) });
    const j = await r.json();
    if (r.status === 401) return showLogin();
    if (!r.ok) throw new Error(j.error === 'no_key' ? 'Claude пока не подключён: нужен ключ ANTHROPIC_API_KEY (см. README).' : 'Не получилось: ' + j.error);
    S.advice = j.advice; scheduleSave();
  } catch (e) { adv.err = e.message; }
  adv.loading = false; render(false);
}

// ───────── панель справа ─────────
const drawer = $('#drawer'), overlay = $('#overlay');
let mode = null;
function openDrawer() { drawer.classList.add('on'); overlay.classList.add('on'); drawer.setAttribute('aria-hidden', 'false'); }
function closeDrawer() { drawer.classList.remove('on'); overlay.classList.remove('on'); drawer.setAttribute('aria-hidden', 'true'); mode = null; }
overlay.onclick = closeDrawer;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
function live() { render(false); if (mode && mode.type === 'month') updateSummary(); if (mode && mode.type === 'wizard') updateWiz(); scheduleSave(); }

// список «название — план — факт» (доходы и расходы месяца)
function factEditor(items, planField, ph, onStruct, real, labels) {
  const box = h('div');
  box.append(h('div', { class: 'li head' }, h('span'), h('span', {}, 'Что'), h('span', {}, (labels || ['План', 'Факт'])[0]), h('span', {}, (labels || ['План', 'Факт'])[1]), h('span')));
  items.forEach((it) => {
    const t = () => real().find((x) => x.id === it.id) || it;
    const chk = h('input', { type: 'checkbox', title: 'Готово: пришло / оплачено', checked: hasF(it) ? 'checked' : false });
    const fact = h('input', { class: 'in', type: 'number', inputmode: 'decimal', value: hasF(it) ? it.fact : false, placeholder: '—', oninput: (e) => { const o = t(), had = hasF(o); o.fact = e.target.value === '' ? null : num(e.target.value); chk.checked = hasF(o); if (hasF(o) && !o.date) o.date = todayISO(); live(); if (hasF(o) !== had) onStruct(); } });
    chk.onchange = () => { const o = t(); o.fact = chk.checked ? num(o[planField]) : null; if (chk.checked && !o.date) o.date = todayISO(); fact.value = chk.checked ? o.fact : ''; live(); onStruct(); };
    box.append(h('div', { class: 'li' }, chk,
      h('input', { class: 'in', value: it.name, placeholder: ph, oninput: (e) => { t().name = e.target.value; live(); } }),
      h('input', { class: 'in', type: 'number', inputmode: 'decimal', value: it[planField] || false, placeholder: '0', oninput: (e) => { t()[planField] = e.target.value === '' ? 0 : num(e.target.value); live(); } }), fact,
      h('button', { class: 'x', title: 'Удалить', onclick: () => { const a = real(); a.splice(a.findIndex((x) => x.id === it.id), 1); live(); onStruct(); } }, '×')));
    if (hasF(it)) box.append(dateRow(it, t, planField === 'usd' ? 'Когда пришло' : 'Когда оплачено', live));
  });
  return box;
}
function dateRow(it, t, label, after) {
  return h('div', { class: 'fdate' }, '📅 ' + label + ':', h('input', { type: 'date', value: it.date || todayISO(), onchange: (e) => { t(it).date = e.target.value || null; after(); } }));
}
// простой список «название — сумма» (шаблоны)
function listEditor(items, field, ph, onStruct) {
  const box = h('div');
  items.forEach((it) => box.append(h('div', { class: 'li plain' },
    h('input', { class: 'in', value: it.name, placeholder: ph, oninput: (e) => { it.name = e.target.value; live(); } }),
    h('input', { class: 'in', type: 'number', inputmode: 'decimal', value: it[field] || false, placeholder: '0', oninput: (e) => { it[field] = e.target.value === '' ? 0 : num(e.target.value); live(); } }),
    h('button', { class: 'x', title: 'Удалить', onclick: () => { items.splice(items.indexOf(it), 1); live(); onStruct(); } }, '×'))));
  return box;
}

function openMonth(key) { mode = { type: 'month', key }; renderMonth(); openDrawer(); }
function renderMonth() {
  const key = mode.key; model = calc();
  const r = model.rows.find((x) => x.key === key); if (!r) return closeDrawer();
  const s = S.settings, ov = () => (S.months[key] = S.months[key] || {}), rerender = () => renderMonth(), idx = r.i;
  const mi = () => { const o = ov(); if (!o.incomes) o.incomes = clone(s.incomeTemplate).map((x) => ({ ...x, fact: null })); return o.incomes; };
  const me = () => { const o = ov(); if (!o.expenses) o.expenses = clone(s.recurring).map((x) => ({ ...x, fact: null })); return o.expenses; };
  drawer.innerHTML = '';
  drawer.append(
    h('div', { class: 'd-head' }, h('h2', {}, monthTitle(key)),
      h('div', { class: 'nav' },
        h('button', { onclick: () => { if (idx > 0) { mode.key = model.rows[idx - 1].key; renderMonth(); } } }, '‹'),
        h('button', { onclick: () => { if (idx < model.rows.length - 1) { mode.key = model.rows[idx + 1].key; renderMonth(); } } }, '›'),
        h('button', { onclick: closeDrawer }, '✕'))),
    h('div', { class: 'summary', id: 'summary' }));

  drawer.append(h('div', { class: 'sec' }, h('h4', {}, 'Доходы, $'), h('button', { class: 'btn small', onclick: () => { mi().push({ id: uid(), name: '', usd: 0, fact: null }); live(); rerender(); } }, '＋')));
  drawer.append(factEditor(r.incomes, 'usd', 'Источник', rerender, mi));
  drawer.append(h('div', { class: 'hint' }, 'Зарплата пришла — поставьте галочку. Пришло больше или меньше — впишите сумму в «Факт».'));

  drawer.append(h('div', { class: 'sec' }, h('h4', {}, 'Расходы, ₸'), h('button', { class: 'btn small', onclick: () => { me().push({ id: uid(), name: '', kzt: 0, fact: null }); live(); rerender(); } }, '＋')));
  drawer.append(factEditor(r.expenses, 'kzt', 'На что', rerender, me));
  const prev = idx > 0 ? model.rows[idx - 1] : null;
  drawer.append(h('div', { class: 'actions' },
    prev ? h('button', { class: 'btn small', onclick: () => { ov().expenses = clone(prev.expenses).map((e) => ({ ...e, id: uid(), fact: null })); live(); rerender(); toast('Скопировано из прошлого месяца'); } }, '⧉ Как в прошлом месяце') : null,
    h('button', { class: 'btn small', onclick: () => { if (!confirm('Применить эти расходы ко всем следующим месяцам? Их собственные расходы будут заменены.')) return; const src = r.ov.expenses || r.expenses; model.rows.slice(idx + 1).forEach((x) => { (S.months[x.key] = S.months[x.key] || {}).expenses = clone(src).map((e) => ({ ...e, id: uid(), fact: null })); }); live(); toast('Применено ко всем следующим'); } }, '⇣ На все следующие'),
    r.custom || r.ov.incomes ? h('button', { class: 'btn small danger', onclick: () => { const o = ov(); delete o.expenses; delete o.incomes; live(); rerender(); } }, 'Сбросить к стандарту') : null));

  // сверка 1-го и 15-го
  const withAcc = (field) => h('span', { class: 'hint' }, h('a', { onclick: () => { const v = Math.round(accountsUsd()); if (field === 'actual') ov().actual = v; else ov()[field] = v; live(); rerender(); } }, `подставить со счетов: ${usd(accountsUsd())}`));
  const fld = (label, field, ph) => h('label', { class: 'field' }, label, h('input', { type: 'number', inputmode: 'decimal', value: ov()[field] != null && ov()[field] !== '' ? ov()[field] : false, placeholder: ph, oninput: (e) => { const o = ov(); if (e.target.value === '') delete o[field]; else o[field] = num(e.target.value); live(); } }), withAcc(field));
  drawer.append(h('div', { class: 'sec' }, h('h4', {}, 'Остатки, $')));
  drawer.append(h('div', { class: 'hint', style: 'margin-bottom:10px' }, 'Сложите все счета и наличные (см. «Сколько денег сейчас»). Реальный остаток на конец месяца пересчитывает все следующие месяцы.'));
  drawer.append(fld('Остаток на 1-е число', 'check1', 'необязательно'), fld('Реальный остаток на конец месяца', 'actual', `по расчёту ${Math.round(r.planned)}`));
  drawer.append(
    h('label', { class: 'field' }, `Курс этого месяца, ₸ за $ (сейчас ${s.rate})`, h('input', { type: 'number', step: '0.01', value: r.ov.rate || false, placeholder: String(s.rate), oninput: (e) => { const o = ov(); if (e.target.value === '') delete o.rate; else o.rate = num(e.target.value); live(); } })),
    h('label', { class: 'field' }, 'Заметка: главные траты и выводы', h('textarea', { rows: 3, oninput: (e) => { ov().note = e.target.value; scheduleSave(); } }, r.ov.note || '')));
  updateSummary();
}
function updateSummary() {
  const box = $('#summary'); if (!box) return;
  const r = model.rows.find((x) => x.key === mode.key); if (!r) return;
  box.innerHTML = `<div><span>На начало</span><b>${usd(r.start)}</b></div>
    <div><span>＋ Доходы <small>(получено ${usd(r.incFact)})</small></span><b class="pos">${usd(r.inc)}</b></div>
    <div><span>− Расходы ${kzt(r.expKzt)} <small>(оплачено ${kzt(r.expFact)})</small></span><b class="neg">${usd(r.expUsd)}</b></div>
    ${r.hasFact ? `<div><span>По расчёту было бы</span><b>${usd(r.planned)}</b></div>` : ''}
    <div class="end"><span>${r.hasFact ? 'На конец (факт)' : 'На конец'}</span><b>${usd(r.end)}</b></div>
    <div><span>Доля цели</span><b>${Math.round((r.end / (model.goal + model.cT)) * 100)}%</b></div>`;
}

function openSettings() {
  mode = { type: 'settings' }; model = calc();
  const s = S.settings, rerender = () => openSettings();
  drawer.innerHTML = '';
  const field = (label, key, hint) => h('label', { class: 'field' }, label, h('input', { type: 'number', step: 'any', value: s[key], oninput: (e) => { s[key] = num(e.target.value); live(); } }), hint ? h('span', { class: 'hint' }, hint) : null);
  drawer.append(
    h('div', { class: 'd-head' }, h('h2', {}, 'Настройки'), h('div', { class: 'nav' }, h('button', { onclick: closeDrawer }, '✕'))),
    h('div', { class: 'sec' }, h('h4', {}, 'Цель')),
    field('Сумма на дом, $', 'goal'), field(`Остаток на начало (${monthTitle(s.startMonth)}), $`, 'startBalance'),
    h('div', { class: 'sec' }, h('h4', {}, 'Курс доллара')),
    h('div', { class: 'seg2' }, h('button', { class: s.rateMode === 'auto' ? 'on' : '', onclick: () => { s.rateMode = 'auto'; live(); rerender(); refreshRate(); } }, 'Автоматически'), h('button', { class: s.rateMode === 'manual' ? 'on' : '', onclick: () => { s.rateMode = 'manual'; live(); rerender(); } }, 'Вручную')),
    h('div', { class: 'hint', style: 'margin:10px 0' }, s.rateMode === 'auto' ? `Источник: ${s.rateSource || '—'}${s.rateBase ? ', ' + s.rateBase + ' ₸' : ''}. Обновляется сам каждые 20 минут. Подтянутый курс используется во всех месяцах, пока вы не зададите свой.` : 'Укажите свой курс обмена.'),
    s.rateMode === 'manual' ? field('Курс, ₸ за $', 'rate')
      : h('label', { class: 'field' }, 'Поправка обменника, ₸', h('input', { type: 'number', step: 'any', value: s.rateSpread || false, placeholder: '0', oninput: (e) => { s.rateSpread = num(e.target.value); if (s.rateBase) s.rate = r2(s.rateBase + s.rateSpread); live(); } }), h('span', { class: 'hint' }, 'Если банк покупает доллар на 3 ₸ дешевле официального — впишите −3.')),
    h('div', { class: 'sec' }, h('h4', {}, 'Доходы в месяц, $'), h('button', { class: 'btn small', onclick: () => { s.incomeTemplate.push({ id: uid(), name: '', usd: 0 }); live(); rerender(); } }, '＋')),
    listEditor(s.incomeTemplate, 'usd', 'Источник', rerender),
    h('div', { class: 'sec' }, h('h4', {}, 'Постоянные расходы в месяц, ₸'), h('button', { class: 'btn small', onclick: () => { s.recurring.push({ id: uid(), name: '', kzt: 0 }); live(); rerender(); } }, '＋')),
    listEditor(s.recurring, 'kzt', 'Например: аренда, еда…', rerender),
    h('div', { class: 'hint' }, 'Применяются ко всем месяцам, где вы не задали свои расходы (например, октябрь).'),
    h('div', { class: 'sec' }, h('h4', {}, 'Подушка безопасности')),
    h('label', { class: 'field' }, `Сколько месяцев расходов: ${s.cushionMonths}`, h('input', { type: 'range', min: 3, max: 12, step: 1, value: s.cushionMonths, oninput: (e) => { s.cushionMonths = +e.target.value; live(); rerender(); } }), h('span', { class: 'hint' }, 'Один кормилец — разумно 6–9 месяцев. Два стабильных дохода — 3–6.')),
    h('div', { class: 'whatif' }, model.cT > 0 ? `Нужная подушка: ${usd(model.cT)}` : 'Внесите постоянные расходы — посчитаю подушку'));
  openDrawer();
}


// ───────── мастер «Внести данные» ─────────
function openWizard() { mode = { type: 'wizard' }; renderWizard(); openDrawer(); }
function renderWizard() {
  model = calc();
  const r = model.rows[model.cur], key = r.key, s = S.settings, d = new Date();
  const ov = () => (S.months[key] = S.months[key] || {});
  const mi = () => { const o = ov(); if (!o.incomes) o.incomes = clone(s.incomeTemplate).map((x) => ({ ...x, fact: null })); return o.incomes; };
  const me = () => { const o = ov(); if (!o.expenses) o.expenses = clone(s.recurring).map((x) => ({ ...x, fact: null })); return o.expenses; };
  const step = (n, title, hint) => h('div', { style: 'margin:22px 0 10px' }, h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('span', { style: 'width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--gold));color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px;flex:none' }, n), h('b', { style: 'font-size:18px' }, title)), h('div', { class: 'hint', style: 'margin:6px 0 0 38px;font-size:13px' }, hint));
  const opt = (v, arr, on) => { const el = h('select', {}, ...arr.map(([a, t]) => h('option', { value: a, selected: a === v ? 'selected' : false }, t))); el.onchange = () => on(el.value); return el; };
  drawer.innerHTML = '';
  drawer.append(h('div', { class: 'd-head' }, h('div', {}, h('h2', {}, 'Внести данные'), h('div', { class: 'hint' }, `${d.getDate()} ${MG[d.getMonth()]} · ${monthTitle(key)} · раз в месяц · 3 шага`)), h('div', { class: 'nav' }, h('button', { onclick: closeDrawer }, '✕'))));

  // 1
  const afterW = () => { scheduleSave(); render(false); renderWizard(); };
  drawer.append(step(1, 'Сколько денег у вас сейчас?', 'Карты и наличные считаются отдельно: просто впишите, сколько где лежит.'));
  drawer.append(h('div', { class: 'sub-h' }, '💳 Карты и счета'), accGroup('bank', afterW), h('div', { class: 'accsum' }, h('span', {}, 'Карты'), h('b', {}, usd(groupUsd('bank')))));
  drawer.append(h('div', { class: 'sub-h' }, '💵 Наличные'), accGroup('cash', afterW), h('div', { class: 'accsum' }, h('span', {}, 'Наличные'), h('b', {}, usd(groupUsd('cash')))));
  drawer.append(h('div', { class: 'accsum', style: 'border-top:1px dashed var(--line);padding-top:10px' }, h('span', {}, 'Всего'), h('b', { id: 'wizTotal' }, usd(accountsUsd()))));

  // 2
  drawer.append(step(2, 'Что пришло?', 'Зарплата пришла — поставьте галочку. Если пришло больше или меньше — впишите сумму справа.'));
  drawer.append(factEditor(r.incomes, 'usd', 'Откуда', renderWizard, mi, ['Ждали, $', 'Пришло, $']));
  drawer.append(h('div', { class: 'actions', style: 'margin-top:0' }, h('button', { class: 'btn small', onclick: () => { mi().push({ id: uid(), name: '', usd: 0, fact: null }); live(); renderWizard(); } }, '＋ Другой доход')));

  // 3
  drawer.append(step(3, 'Что оплатили?', 'Оплатили — поставьте галочку. Потратили по-другому — впишите сумму справа. Незапланированное добавьте кнопкой.'));
  drawer.append(factEditor(r.expenses, 'kzt', 'На что', renderWizard, me, ['План, ₸', 'Оплачено, ₸']));
  drawer.append(h('div', { class: 'actions', style: 'margin-top:0' }, h('button', { class: 'btn small', onclick: () => { me().push({ id: uid(), name: '', kzt: 0, fact: null }); live(); renderWizard(); } }, '＋ Ещё расход')));

  // итог
  drawer.append(h('div', { class: 'summary', id: 'wizSum', style: 'margin-top:24px' }));
  drawer.append(h('button', { class: 'btn primary', onclick: () => { const o = ov(), v = Math.round(accountsUsd()); o.check1 = v; scheduleSave(); render(false); closeDrawer(); toast('Данные сохранены ✓'); } }, 'Готово — сохранить'));
  drawer.append(h('div', { class: 'hint', style: 'margin-top:10px' }, 'Месяц закончился и хотите записать итог точно? Нажмите на месяц в списке внизу — там есть «реальный остаток на конец месяца».'));
  updateWiz();
}
function updateWiz() {
  const box = $('#wizSum'); if (!box) return;
  const r = model.rows[model.cur], total = accountsUsd(), diff = total - r.start, ok = Math.abs(diff) <= Math.max(50, r.start * 0.01);
  const t = $('#wizTotal'); if (t) t.textContent = usd(total);
  box.innerHTML = `<div><span>Денег сейчас</span><b>${usd(total)}</b></div>
    <div><span>Платформа ожидала на начало месяца</span><b>${usd(r.start)}</b></div>
    <div><span>${ok ? '✓ Сходится' : 'Разница'}</span><b class="${ok ? 'pos' : 'neg'}">${ok ? '' : usd(diff)}</b></div>
    <div class="end"><span>К концу месяца будет</span><b>${usd(r.end)}</b></div>`;
}

// ───────── старт ─────────
async function start() {
  if (!(await load())) return showLogin();
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  render(true);
  if (S.settings.rateMode === 'auto') refreshRate(false);
}
setInterval(() => { if (S && !document.hidden && S.settings.rateMode === 'auto' && !$('#app').classList.contains('hidden') && !mode) refreshRate(false); }, 20 * 60 * 1000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || dirty || !S) return;
  try {
    const r = await fetch('/api/data'); if (!r.ok) return;
    const { data } = await r.json();
    if (data && data.v === 5 && (data.updatedAt || 0) > lastSaved && !drawer.classList.contains('on')) { S = data; lastSaved = data.updatedAt; render(false); toast('Данные обновлены'); }
  } catch {}
});
start();
