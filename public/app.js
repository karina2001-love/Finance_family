'use strict';
// ───────── helpers ─────────
const $ = (s) => document.querySelector(s);
const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const HORIZON = 72;
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const usd = (n) => (n < 0 ? '−' : '') + '$' + nf.format(Math.abs(Math.round(n)));
const kzt = (n) => (n < 0 ? '−' : '') + nf.format(Math.abs(Math.round(n))) + ' ₸';
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const sum = (arr, f) => (arr || []).reduce((a, x) => a + num(typeof f === 'function' ? f(x) : x[f]), 0);
const r2 = (n) => Math.round(n * 100) / 100;
const hasV = (x) => x !== undefined && x !== null && x !== '';

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
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ───────── данные ─────────
function seed() {
  return {
    v: 6,
    settings: {
      goal: 200000, startBalance: 26496, startMonth: '2026-10',
      rateMode: 'auto', rate: 450.79, rateBase: 0, rateEur: 0, rateSource: '', rateUpdated: 0, rateSpread: 0,
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
        rows: [
          { id: uid(), kind: 'in', name: 'Зарплата №2', amount: 5600, plan: 5600, done: false, date: '' },
          { id: uid(), kind: 'out', name: 'Адиль', amount: 500000, plan: 500000, done: false, date: '' },
          { id: uid(), kind: 'out', name: 'Цветы', amount: 150000, plan: 150000, done: false, date: '' },
          { id: uid(), kind: 'out', name: 'Машина', amount: 280000, plan: 280000, done: false, date: '' },
          { id: uid(), kind: 'out', name: 'Каско', amount: 700000, plan: 700000, done: false, date: '' },
          { id: uid(), kind: 'out', name: 'Таиланд', amount: 1500000, plan: 1500000, done: false, date: '' },
        ],
        note: 'Старт 6 октября. Зарплата №1 за октябрь уже получена и входит в остаток.',
      },
    },
  };
}
// перенос данных из прошлых версий сайта (ничего не теряем)
function migrate(d) {
  if (!d) return seed();
  if (d.v === 6) return d;
  const S6 = seed(), s = d.settings || {};
  for (const k of ['goal', 'startBalance', 'startMonth', 'rateMode', 'rate', 'rateBase', 'rateEur', 'rateSource', 'rateUpdated', 'rateSpread']) if (s[k] !== undefined) S6.settings[k] = s[k];
  if (Array.isArray(s.incomeTemplate) && s.incomeTemplate.length) S6.settings.incomeTemplate = s.incomeTemplate.map((x) => ({ id: x.id || uid(), name: x.name || '', usd: num(x.usd) }));
  if (Array.isArray(s.recurring)) S6.settings.recurring = s.recurring.map((x) => ({ id: x.id || uid(), name: x.name || '', kzt: num(x.kzt) }));
  if (Array.isArray(s.accounts) && s.accounts.length) S6.settings.accounts = s.accounts.map((a) => ({ id: a.id || uid(), name: a.name || '', ccy: ['KZT', 'EUR'].includes(a.ccy) ? a.ccy : 'USD', amount: num(a.amount), kind: a.kind === 'cash' ? 'cash' : 'bank' }));
  if (d.v === 5 && d.months) {
    S6.months = {};
    const hf = (x) => hasV(x.fact);
    for (const [k, ov] of Object.entries(d.months)) {
      if (!ov) continue;
      const m = { rows: null, note: ov.note || '' };
      if (num(ov.rate) > 0) m.rate = num(ov.rate);
      if (hasV(ov.actual)) m.actual = num(ov.actual);
      if (ov.incomes || ov.expenses) {
        const ins = ov.incomes || S6.settings.incomeTemplate.map((t) => ({ name: t.name, usd: t.usd }));
        const outs = ov.expenses || S6.settings.recurring.map((t) => ({ name: t.name, kzt: t.kzt }));
        m.rows = [
          ...ins.map((x) => ({ id: uid(), kind: 'in', name: x.name || '', amount: hf(x) ? num(x.fact) : num(x.usd), plan: num(x.usd), done: hf(x), date: x.date || '' })),
          ...outs.map((x) => ({ id: uid(), kind: 'out', name: x.name || '', amount: hf(x) ? num(x.fact) : num(x.kzt), plan: num(x.kzt), done: hf(x), date: x.date || '' })),
        ];
      }
      if (m.rows || m.note || m.rate || hasV(m.actual)) S6.months[k] = m;
    }
  }
  return S6;
}
let S = null, model = null, dirty = false, lastSaved = 0, mKey = null, showMonths = 0, animOn = true;

// ───────── расчёт ─────────
const virtualRows = () => [
  ...S.settings.incomeTemplate.map((t) => ({ id: 'v' + t.id, kind: 'in', name: t.name, amount: num(t.usd), plan: num(t.usd), done: false, date: '', virtual: true })),
  ...S.settings.recurring.map((t) => ({ id: 'v' + t.id, kind: 'out', name: t.name, amount: num(t.kzt), plan: num(t.kzt), done: false, date: '', virtual: true })),
];
function currentIndex() { return Math.max(0, Math.min(HORIZON - 1, keyDiff(todayKey(), S.settings.startMonth))); }
function calc() {
  const s = S.settings, rows = [], cur = currentIndex();
  let bal = num(s.startBalance);
  for (let i = 0; i < HORIZON; i++) {
    const key = shiftKey(s.startMonth, i), m = S.months[key] || {};
    const rs = m.rows || virtualRows();
    const rate = num(m.rate) > 0 ? num(m.rate) : num(s.rate);
    const ins = rs.filter((r) => r.kind === 'in'), outs = rs.filter((r) => r.kind === 'out');
    const inc = sum(ins, 'amount'), expKzt = sum(outs, 'amount'), expUsd = rate > 0 ? expKzt / rate : 0;
    const planned = bal + inc - expUsd, hasFact = hasV(m.actual), end = hasFact ? num(m.actual) : planned;
    rows.push({ key, i, start: bal, inc, expKzt, expUsd, rate, planned, end, hasFact, rs, m, virtual: !m.rows, incDone: sum(ins.filter((r) => r.done), 'amount'), expDone: sum(outs.filter((r) => r.done), 'amount') });
    bal = end;
  }
  const goal = num(s.goal) || 1;
  return { rows, goal, cur, eta: rows.findIndex((r) => r.end >= goal) };
}
const eurRate = () => num(S.settings.rateEur) || num(S.settings.rate) * 1.1; // ₸ за €
const toUsd = (amount, ccy) => (ccy === 'USD' ? num(amount) : ccy === 'EUR' ? (num(amount) * eurRate()) / (num(S.settings.rate) || 1) : num(amount) / (num(S.settings.rate) || 1));
const accUsd = (list) => sum(list, (a) => toUsd(a.amount, a.ccy));
const accountsUsd = () => accUsd(S.settings.accounts);

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
  S = migrate(data); lastSaved = (data && data.updatedAt) || 0;
  if (!data || data.v !== 6) scheduleSave();
  return true;
}
const save = () => { scheduleSave(); render(false); };

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
$('#rateChip').onclick = () => refreshRate(true);

// ───────── курс (Нацбанк РК) ─────────
async function refreshRate(manual) {
  const chip = $('#rateChip'); chip.classList.add('spin');
  try {
    const r = await fetch('/api/rate'); if (r.status === 401) return showLogin();
    const j = await r.json(); if (!r.ok) throw new Error();
    const s = S.settings; s.rateBase = j.rate; s.rateSource = j.source; s.rateUpdated = j.updatedAt;
    if (s.rateMode === 'auto') { s.rate = r2(j.rate + num(s.rateSpread)); if (j.eur) s.rateEur = r2(j.eur); }
    scheduleSave(); if (manual) toast(`${j.source}: ${j.rate} ₸ за $`);
  } catch { if (manual) toast('Не удалось получить курс'); }
  chip.classList.remove('spin'); render(false);
}
function paintRate() {
  const s = S.settings, when = s.rateUpdated ? new Date(s.rateUpdated).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
  $('#rateChip').innerHTML = `$1 = <b>${s.rate} ₸</b> · €1 = <b>${r2(eurRate())} ₸</b><small>${s.rateMode === 'auto' && s.rateSource ? s.rateSource + ' · ' + when : 'вручную'}</small>`;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400); }

// ───────── ячейки ─────────
const cell = (val, on, cls = '', ph = '') => h('input', { class: 'cell ' + cls, value: val == null ? '' : val, placeholder: ph, onchange: (e) => on(e.target.value) });
const numCell = (val, on, cls = '', ph = '0') => h('input', { class: 'cell num ' + cls, type: 'number', inputmode: 'decimal', value: hasV(val) && val !== 0 ? val : '', placeholder: ph, onchange: (e) => on(e.target.value) });
const dateCell = (val, on) => h('input', { class: 'cell date', type: 'date', value: val || '', onchange: (e) => on(e.target.value) });
const sel = (val, opts, on, cls = '') => h('select', { class: 'cell ' + cls, onchange: (e) => on(e.target.value) }, ...opts.map(([v, t]) => h('option', { value: v, selected: v === val ? 'selected' : false }, t)));
const th = (t, cls) => h('th', { class: cls || '' }, t);
const td = (cls, ...k) => { const attrs = { class: cls || '' }; if (k[0] && typeof k[0] === 'object' && !k[0].nodeType && !Array.isArray(k[0])) Object.assign(attrs, k.shift()); return h('td', attrs, ...k); };
const xBtn = (on) => h('button', { class: 'x', title: 'Удалить', onclick: on }, '×');

// ───────── страница ─────────
function render(anim) {
  animOn = anim; model = calc(); paintRate();
  if (!mKey) mKey = model.rows[model.cur].key;
  $('#subtitle').textContent = 'Записываем деньги раз в месяц, 1-го числа';
  const v = $('#view'); v.className = anim ? '' : 'static'; v.innerHTML = '';
  [summary(), help(), moneyTable(), monthTable(), allMonths(), settings()].filter(Boolean).forEach((el) => v.append(el));
}

function summary() {
  const { rows, goal, eta, cur } = model, s = S.settings, now = accountsUsd(), pct = Math.max(0, Math.min(1, now / goal));
  const nx = rows[Math.min(cur + 1, rows.length - 1)], perMonth = nx.inc - nx.expUsd, noExp = !s.recurring.length;
  const P = 'M60 6 L114 54 L102 54 L102 106 L18 106 L18 54 L6 54 Z';
  const house = h('div', { class: 'house', html: `<svg viewBox="0 0 120 112"><defs><clipPath id="hc"><path d="${P}"/></clipPath><linearGradient id="hg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2f9e7a"/><stop offset="1" stop-color="#9fe0bd"/></linearGradient></defs><path d="${P}" fill="#f1ede3"/><rect class="hfill" x="0" y="0" width="120" height="112" fill="url(#hg)" clip-path="url(#hc)" style="transform:scaleY(${animOn ? 0 : pct})"/><rect x="80" y="18" width="12" height="24" rx="2" fill="#d9664f"/><path d="${P}" fill="none" stroke="#1d2b26" stroke-width="4" stroke-linejoin="round"/><rect x="50" y="74" width="20" height="32" rx="3" fill="#fff" stroke="#1d2b26" stroke-width="3"/><rect x="26" y="62" width="16" height="16" rx="2" fill="#fff" stroke="#1d2b26" stroke-width="3"/><rect x="78" y="62" width="16" height="16" rx="2" fill="#fff" stroke="#1d2b26" stroke-width="3"/></svg><div class="hpct">${Math.round(pct * 100)}%</div>` });
  if (animOn) setTimeout(() => { const f = house.querySelector('.hfill'); if (f) f.style.transform = `scaleY(${pct})`; }, 60);
  const nowEl = h('b', {}, usd(now)); if (animOn) setTimeout(() => countUp(nowEl, now, usd), 0);
  return h('div', { class: 'card hero' }, house, h('div', {},
    h('div', { class: 'kicker' }, '🏠 Копим на дом'),
    h('div', { class: 'hbig' }, 'У нас уже есть ', nowEl),
    h('div', { class: 'hline' }, `Для дома нужно ${usd(goal)} — мы прошли ${Math.round(pct * 100)}% пути`),
    h('div', { class: 'bar' }, h('i', { style: `width:${pct * 100}%` })),
    h('div', { class: 'hline' }, `Осталось накопить ${usd(Math.max(0, goal - now))}`),
    h('div', { class: 'hwhen' }, eta >= 0 ? `Если так пойдёт дальше — дом будет в ${monthIn(rows[eta].key)}` : 'Пока не копится: уходит больше, чем приходит'),
    h('div', { class: 'hint' }, noExp ? ['Чтобы срок был честным, впишите, сколько обычно уходит в месяц — в ', h('button', { class: 'link', onclick: () => { const d = $('#settings'); d.open = true; d.scrollIntoView({ behavior: 'smooth' }); } }, 'настройках'), '.'] : `каждый месяц остаётся примерно ${usd(perMonth)}`)));
}
function countUp(el, to, fmt, dur = 1200) {
  const t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function help() {
  if (S.settings.hideHelp) return null;
  return h('div', { class: 'card help' }, h('div', { class: 'chead' }, h('h2', {}, 'Как это работает'), h('button', { class: 'link', onclick: () => { S.settings.hideHelp = true; save(); } }, 'Понятно, спрятать')),
    h('ol', { class: 'steps' },
      h('li', {}, h('b', {}, 'Раз в месяц, 1-го числа,'), ' пишем, сколько денег на картах и в кошельке.'),
      h('li', {}, h('b', {}, 'Отмечаем галочкой,'), ' что пришло и что оплатили. Сумма другая — просто исправляем число.'),
      h('li', {}, h('b', {}, 'Сайт сам считает,'), ' сколько накопили на дом и когда он будет.')));
}

// деньги сейчас: карты отдельно, наличные отдельно
function moneyTable() {
  const s = S.settings;
  const card = h('div', { class: 'card' }, h('div', { class: 'chead' }, h('h2', {}, '1. Сколько денег сейчас'), h('span', { class: 'hint' }, 'загляните в банк и в кошелёк, впишите суммы · карты и наличные — отдельно')));
  const t = h('table', { class: 't money' }, h('tr', {}, th('Где'), th('Валюта', 'w-ccy'), th('Сумма', 'num w-amt'), th('≈ $', 'num w-eq'), th('', 'w-x')));
  const group = (kind, title, addLabel) => {
    const list = s.accounts.filter((a) => a.kind === kind);
    t.append(h('tr', { class: 'group' }, td('', title), td(), td(), td(), td()));
    list.forEach((a) => t.append(h('tr', {},
      td('', cell(a.name, (v) => { a.name = v; scheduleSave(); }, '', 'Название')),
      td('', sel(a.ccy, [['USD', '$'], ['EUR', '€'], ['KZT', '₸']], (v) => { a.ccy = v; save(); })),
      td('num', numCell(a.amount, (v) => { a.amount = num(v); save(); })),
      td('num approx', usd(toUsd(a.amount, a.ccy))),
      td('c', xBtn(() => { s.accounts.splice(s.accounts.indexOf(a), 1); save(); })))));
    t.append(h('tr', { class: 'subtotal' }, td('', h('button', { class: 'link', onclick: () => { s.accounts.push({ id: uid(), name: '', ccy: kind === 'cash' ? 'KZT' : 'USD', amount: 0, kind }); save(); } }, '＋ ' + addLabel)), td(), td(), td('num', usd(accUsd(list))), td()));
  };
  group('bank', '💳 Карты и счета', 'карта или счёт');
  group('cash', '💵 Наличные', 'наличные');
  t.append(h('tr', { class: 'total' }, td('', 'Всего денег'), td(), td(), td('num', usd(accountsUsd())), td()));
  card.append(h('div', { class: 'tw' }, t), h('div', { class: 'swipe' }, '← таблицу можно листать вбок →'));
  return card;
}

// таблица месяца
function materialize(key) { const m = (S.months[key] = S.months[key] || {}); if (!m.rows) m.rows = virtualRows().map((r) => ({ ...r, id: uid(), virtual: undefined })); return m; }
function monthTable() {
  const { rows, cur, goal } = model;
  const r = rows.find((x) => x.key === mKey) || rows[cur]; mKey = r.key;
  const key = r.key, idx = r.i, s = S.settings;
  const status = key === todayKey() ? h('span', { class: 'pill now' }, 'сейчас') : idx < cur ? h('span', { class: 'pill ' + (r.hasFact ? 'ok' : '') }, r.hasFact ? '✓ посчитан' : 'уже прошёл') : h('span', { class: 'pill' }, 'будет');
  const card = h('div', { class: 'card', id: 'month' }, h('div', { class: 'sect' }, '2. Что было в месяце: пришло и ушло'),
    h('div', { class: 'chead' },
      h('div', { class: 'r' }, h('div', { class: 'mnav' }, h('button', { onclick: () => { if (idx > 0) { mKey = rows[idx - 1].key; render(false); } } }, '‹'), h('button', { onclick: () => { if (idx < rows.length - 1) { mKey = rows[idx + 1].key; render(false); } } }, '›')), h('h2', {}, monthTitle(key)), status),
      h('div', { class: 'r' }, h('button', { class: 'btn small in', onclick: () => { materialize(key).rows.push({ id: uid(), kind: 'in', name: '', amount: 0, plan: 0, done: false, date: '' }); save(); } }, '＋ Пришли деньги'), h('button', { class: 'btn small out', onclick: () => { materialize(key).rows.push({ id: uid(), kind: 'out', name: '', amount: 0, plan: 0, done: false, date: '' }); save(); } }, '＋ Потратили'))));
  const t = h('table', { class: 't' }, h('tr', {}, th('Было', 'c'), th('Что это'), th('Пришло, $', 'num w-amt'), th('Ушло, ₸', 'num w-amt'), th('≈ $', 'num w-eq eqc'), th('Когда', 'w-date'), th('', 'w-x')));
  const list = [...r.rs.filter((x) => x.kind === 'in'), ...r.rs.filter((x) => x.kind === 'out')];
  const real = () => materialize(key).rows;
  const find = (x) => real().find((y) => y.id === x.id) || (real().find((y) => y.name === x.name && y.kind === x.kind && y.amount === x.amount));
  list.forEach((x) => {
    const upd = (f) => { const y = find(x); if (y) f(y); save(); };
    const isIn = x.kind === 'in';
    const amt = numCell(x.amount, (v) => upd((y) => { y.amount = num(v); }), isIn ? 'in' : 'out');
    const amtCell = td('num', amt, x.done && x.plan && Math.abs(x.plan - x.amount) >= 1 ? h('span', { class: 'planhint' }, `хотели ${isIn ? usd(x.plan) : kzt(x.plan)}`) : null);
    t.append(h('tr', { class: x.done ? 'done' : 'plan' },
      td('c', h('input', { class: 'chk', type: 'checkbox', title: isIn ? 'Деньги пришли' : 'Оплачено', checked: x.done ? 'checked' : false, onchange: (e) => upd((y) => { y.done = e.target.checked; if (y.done && !y.date && key === todayKey()) y.date = todayISO(); }) })),
      td('', cell(x.name, (v) => upd((y) => { y.name = v; }), '', isIn ? 'Откуда' : 'На что')),
      isIn ? amtCell : td('num'), isIn ? td('num') : amtCell,
      td('num approx eqc', isIn ? '' : usd(num(x.amount) / r.rate)),
      td('', dateCell(x.date, (v) => upd((y) => { y.date = v; }))),
      td('c', xBtn(() => { const a = real(); const y = find(x); if (y) a.splice(a.indexOf(y), 1); save(); }))));
  });
  if (list.length) {
    t.append(h('tr', { class: 'subtotal' }, td('', { colspan: 2 }, 'уже случилось'), td('num pos', usd(r.incDone)), td('num neg', kzt(r.expDone)), td('num eqc', usd(r.expDone / r.rate)), td('', { colspan: 2 })));
    t.append(h('tr', { class: 'total' }, td('', { colspan: 2 }, 'Итого'), td('num pos', usd(r.inc)), td('num neg', kzt(r.expKzt)), td('num eqc', usd(r.expUsd)), td('', { colspan: 2 })));
  }
  if (r.virtual) t.append(h('tr', {}, td('', { colspan: 7 }, h('span', { class: 'hint' }, list.length ? 'Это обычный месяц: цифры взяты из настроек. Поправьте любую — и месяц станет своим.' : 'Пока пусто. Нажмите «Пришли деньги» или «Потратили», или заполните обычный месяц в настройках.'))));
  card.append(h('div', { class: 'tw' }, t), h('div', { class: 'swipe' }, '← таблицу можно листать вбок →'));
  const m = S.months[key] || {};
  const foot = h('div', { class: 'foot' },
    h('div', {}, h('div', { class: 'kv' }, h('span', {}, 'Было в начале месяца'), h('b', {}, usd(r.start))),
      h('div', { class: 'kv' }, h('span', {}, 'Пришло минус ушло'), h('b', { class: r.inc - r.expUsd >= 0 ? 'pos' : 'neg' }, (r.inc - r.expUsd >= 0 ? '+' : '') + usd(r.inc - r.expUsd))),
      h('div', { class: 'kv' }, h('span', {}, 'Будет в конце месяца'), h('b', { class: 'big' }, usd(r.planned))),
      h('div', { class: 'kv' }, h('span', {}, 'Это от дома'), h('b', {}, Math.round((r.end / goal) * 100) + '%'))),
    h('div', {},
      h('div', { class: 'kv' }, h('span', {}, 'Сколько осталось на самом деле, $'), h('input', { type: 'number', inputmode: 'decimal', value: r.hasFact ? m.actual : '', placeholder: 'впишите 1-го числа', onchange: (e) => { const mm = (S.months[key] = S.months[key] || {}); if (e.target.value === '') delete mm.actual; else mm.actual = num(e.target.value); save(); } })),
      h('div', { class: 'hint', style: 'text-align:right' }, h('button', { class: 'link', onclick: () => { const mm = (S.months[key] = S.months[key] || {}); mm.actual = Math.round(accountsUsd()); save(); toast('Взято из «Сколько денег сейчас»'); } }, `взять из «Сколько денег сейчас»: ${usd(accountsUsd())}`), r.hasFact ? ` · по нашим цифрам было бы ${usd(r.planned)}` : ''),
      h('div', { class: 'kv', style: 'margin-top:8px' }, h('span', {}, 'Курс месяца, ₸ за $'), h('input', { type: 'number', step: '0.01', value: m.rate || '', placeholder: String(s.rate), onchange: (e) => { const mm = (S.months[key] = S.months[key] || {}); if (e.target.value === '') delete mm.rate; else mm.rate = num(e.target.value); save(); } })),
      h('textarea', { class: 'note', rows: 2, placeholder: 'Заметка: что было важного в этом месяце', onchange: (e) => { (S.months[key] = S.months[key] || {}).note = e.target.value; scheduleSave(); } }, m.note || '')));
  card.append(foot);
  const prev = idx > 0 ? rows[idx - 1] : null;
  card.append(h('div', { class: 'tools' },
    prev && !prev.virtual ? h('button', { class: 'btn small', onclick: () => { const mm = (S.months[key] = S.months[key] || {}); mm.rows = prev.rs.map((x) => ({ ...x, id: uid(), done: false, date: '', amount: x.plan || x.amount })); save(); toast('Скопировано из прошлого месяца'); } }, '⧉ Скопировать прошлый месяц') : null,
    !r.virtual ? h('button', { class: 'btn small', onclick: () => { if (confirm('Сделать этот месяц обычным (цифры из настроек)? Введённые строки удалятся.')) { delete S.months[key].rows; save(); } } }, 'Сделать обычным месяцем') : null,
    h('span', { class: 'hint', style: 'align-self:center' }, 'Галочка «Уже было» — деньги пришли или оплачено. Сумма другая — просто исправьте число.')));
  return card;
}

// все месяцы
function allMonths() {
  const { rows, cur, goal, eta } = model;
  const n = Math.min(rows.length, Math.max(12, eta >= 0 ? eta + 3 : 24) + showMonths);
  const card = h('div', { class: 'card' }, h('div', { class: 'chead' }, h('h2', {}, '3. Что будет дальше'), h('span', { class: 'hint' }, 'нажмите на строку, чтобы открыть месяц')));
  const t = h('table', { class: 't auto' }, h('tr', {}, th('Месяц'), th('Пришло, $', 'num'), th('Ушло, ₸', 'num'), th('≈ $', 'num'), th('Будет денег, $', 'num'), th('От дома', 'num')));
  rows.slice(0, n).forEach((r) => {
    const cls = ['click', r.i === cur ? 'cur' : '', r.end >= goal ? 'reached' : '', r.key === mKey ? 'sel' : ''].join(' ');
    t.append(h('tr', { class: cls, onclick: () => { mKey = r.key; render(false); $('#month').scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
      td('', monthTitle(r.key), r.hasFact ? ' ✓' : r.virtual ? '' : ' ·', r.i === eta ? ' 🏠' : ''), td('num pos', usd(r.inc)), td('num neg', kzt(r.expKzt)), td('num approx', usd(r.expUsd)), td('num', h('b', {}, usd(r.end))), td('num', Math.round((r.end / goal) * 100) + '%')));
  });
  card.append(h('div', { class: 'tw' }, t));
  card.append(h('div', { class: 'tools' }, n < rows.length ? h('button', { class: 'btn small', onclick: () => { showMonths += 12; render(false); } }, 'Показать ещё 12 месяцев') : null, h('span', { class: 'hint', style: 'align-self:center' }, '✓ — месяц посчитан · точка — есть свои записи · 🏠 — здесь уже хватает на дом')));
  return card;
}

// настройки
function settings() {
  const s = S.settings;
  const d = h('details', { class: 'settings card', id: 'settings' }, h('summary', {}, 'Настройки: цель, курс, обычный месяц'));
  const g = h('div', { class: 'sgrid' });
  g.append(h('label', { class: 'field' }, 'Сколько стоит дом, $', h('input', { type: 'number', value: s.goal, onchange: (e) => { s.goal = num(e.target.value) || 1; save(); } })),
    h('label', { class: 'field' }, `Сколько было в самом начале (${monthTitle(s.startMonth)}), $`, h('input', { type: 'number', value: s.startBalance, onchange: (e) => { s.startBalance = num(e.target.value); save(); } })));
  const rate = h('div', { class: 'field' }, 'Курс доллара',
    h('div', { class: 'seg' }, h('button', { class: s.rateMode === 'auto' ? 'on' : '', onclick: () => { s.rateMode = 'auto'; save(); refreshRate(); } }, 'Сам, по Нацбанку'), h('button', { class: s.rateMode === 'manual' ? 'on' : '', onclick: () => { s.rateMode = 'manual'; save(); } }, 'Вручную')),
    s.rateMode === 'manual' ? [h('input', { type: 'number', step: '0.01', value: s.rate, placeholder: '₸ за $', onchange: (e) => { s.rate = num(e.target.value) || s.rate; save(); } }), h('input', { type: 'number', step: '0.01', value: s.rateEur || '', placeholder: '₸ за €', onchange: (e) => { s.rateEur = num(e.target.value); save(); } })]
      : h('input', { type: 'number', step: '0.01', value: s.rateSpread || '', placeholder: 'поправка обменника, ₸ (например −3)', onchange: (e) => { s.rateSpread = num(e.target.value); if (s.rateBase) s.rate = r2(s.rateBase + s.rateSpread); save(); } }));
  g.append(rate);
  const tmpl = (title, arr, field, unit, ph) => {
    const box = h('div', {}, h('div', { class: 'h4' }, title));
    const t = h('table', { class: 't narrow' }, h('tr', { style: 'display:none' }, th(''), th('', 'w-amt'), th('', 'w-x')));
    arr.forEach((x) => t.append(h('tr', {}, td('', cell(x.name, (v) => { x.name = v; save(); }, '', ph)), td('num w-amt', numCell(x[field], (v) => { x[field] = num(v); save(); })), td('c', xBtn(() => { arr.splice(arr.indexOf(x), 1); save(); })))));
    t.append(h('tr', { class: 'subtotal' }, td('', h('button', { class: 'link', onclick: () => { arr.push({ id: uid(), name: '', [field]: 0 }); save(); } }, '＋ строка')), td('num', unit === '$' ? usd(sum(arr, field)) : kzt(sum(arr, field))), td()));
    box.append(t);
    return box;
  };
  g.append(tmpl('Обычно приходит в месяц, $', s.incomeTemplate, 'usd', '$', 'Откуда'), tmpl('Обычно уходит в месяц, ₸', s.recurring, 'kzt', '₸', 'Например: еда, аренда…'));
  d.append(g, h('div', { class: 'hint', style: 'margin-top:12px' }, 'Эти цифры подставляются во все будущие месяцы, пока вы их не поправите. По ним сайт считает, когда будет дом.'));
  return d;
}

// ───────── старт ─────────
async function start() {
  if (!(await load())) return showLogin();
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  render(true);
  if (S.settings.rateMode === 'auto') refreshRate(false);
}
setInterval(() => { if (S && !document.hidden && S.settings.rateMode === 'auto' && !$('#app').classList.contains('hidden')) refreshRate(false); }, 20 * 60 * 1000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || dirty || !S) return;
  try {
    const r = await fetch('/api/data'); if (!r.ok) return;
    const { data } = await r.json();
    if (data && (data.updatedAt || 0) > lastSaved) { S = migrate(data); lastSaved = data.updatedAt; render(false); toast('Данные обновлены'); }
  } catch {}
});
start();
