'use strict';
// ───────── helpers ─────────
const $ = (s) => document.querySelector(s);
const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const usd = (n) => (n < 0 ? '−' : '') + '$' + nf.format(Math.abs(Math.round(n)));
const kzt = (n) => (n < 0 ? '−' : '') + nf.format(Math.abs(Math.round(n))) + ' ₸';
const SYM = { USD: '$', EUR: '€', KZT: '₸' };
const money = (n, ccy) => (ccy === 'USD' ? usd(n) : ccy === 'EUR' ? (n < 0 ? '−' : '') + '€' + nf.format(Math.abs(Math.round(n))) : kzt(n));
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const sum = (arr, f) => (arr || []).reduce((a, x) => a + num(typeof f === 'function' ? f(x) : x[f]), 0);
const r2 = (n) => Math.round(n * 100) / 100;
const hasV = (x) => x !== undefined && x !== null && x !== '';
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const monthOf = (iso) => { const [y, m] = iso.split('-').map(Number); return `${MN[m - 1]} ${y}`; };
const addMonths = (iso, n) => { const [y, m] = iso.split('-').map(Number); const t = (y * 12 + (m - 1)) + n; return { y: Math.floor(t / 12), m: t % 12 }; };

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

// ───────── данные ─────────
// Цифры из таблицы Карины (Финансы.xlsx): октябрь и ноябрь 2026
const line = (name, amount, ccy, fact) => ({ id: uid(), name: name || '', amount, ccy, fact: fact === undefined ? null : fact });
const FROM_EXCEL = (rate, eur) => [
  { id: uid(), date: '2026-10-06', rate, rateEur: eur, haves: [line('', 26496, 'USD')], incomes: [line('', 5600, 'USD')],
    expenses: [line('Адиль', 500000, 'KZT', 500000), line('Машина', 280000, 'KZT', 300000), line('Каско', 700000, 'KZT'), line('Тайланд', 1500000, 'KZT', 2000000)], note: '' },
  { id: uid(), date: '2026-11-02', rate, rateEur: eur, haves: [line('', 20500, 'USD')], incomes: [line('', 8126, 'USD'), line('', 5600, 'USD')],
    expenses: [line('Каско', 700000, 'KZT'), line('Адиль', 200000, 'KZT'), line('Подарок маме', 100000, 'KZT')], note: '' },
];
function seed() {
  const s = { goal: 200000, rateMode: 'auto', rate: 450.79, rateEur: 0, rateBase: 0, rateSource: '', rateUpdated: 0, rateSpread: 0 };
  return { v: 8, settings: s, entries: FROM_EXCEL(s.rate, s.rateEur) };
}
// перенос из прошлых версий (ничего не теряем)
function migrate(d) {
  if (!d) return seed();
  if (d.v === 8) return d;
  const S8 = seed(), s = d.settings || {};
  for (const k of ['goal', 'rateMode', 'rate', 'rateEur', 'rateBase', 'rateSource', 'rateUpdated', 'rateSpread']) if (s[k] !== undefined) S8.settings[k] = s[k];
  if (d.v === 7 && Array.isArray(d.entries) && d.entries.length) {
    S8.entries = d.entries.map((e) => ({
      id: e.id || uid(), date: e.date, rate: num(e.rate) || S8.settings.rate, rateEur: S8.settings.rateEur, note: e.note || '',
      haves: [line('', num(e.have), 'USD')],
      incomes: (e.incomes || []).map((x) => line(x.name, num(x.usd), 'USD')),
      expenses: (e.expenses || []).map((x) => line(x.name, num(x.kzt), 'KZT', hasV(x.fact) ? num(x.fact) : null)),
    }));
  } else S8.entries = FROM_EXCEL(S8.settings.rate, S8.settings.rateEur);
  return S8;
}
let S = null, dirty = false, lastSaved = 0, open = null;

// ───────── курсы и пересчёт ─────────
const rateOf = (e) => (num(e.rate) > 0 ? num(e.rate) : num(S.settings.rate) || 1);                  // ₸ за $
const eurOf = (e) => (num(e.rateEur) > 0 ? num(e.rateEur) : num(S.settings.rateEur) || rateOf(e) * 1.1); // ₸ за €
const toUsd = (amt, ccy, e) => (ccy === 'USD' ? num(amt) : ccy === 'EUR' ? (num(amt) * eurOf(e)) / rateOf(e) : num(amt) / rateOf(e));
function calcEntry(e) {
  const rate = rateOf(e);
  const have = sum(e.haves, (x) => toUsd(x.amount, x.ccy, e));
  const inc = sum(e.incomes, (x) => toUsd(x.amount, x.ccy, e));
  const expPlan = sum(e.expenses, (x) => toUsd(x.amount, x.ccy, e));
  const expUsd = sum(e.expenses, (x) => toUsd(hasV(x.fact) ? x.fact : x.amount, x.ccy, e));
  const anyFact = e.expenses.some((x) => hasV(x.fact));
  return { rate, have, inc, expPlan, expUsd, expKzt: expUsd * rate, expPlanKzt: expPlan * rate, anyFact, after: have + inc - expUsd };
}
const sortedEntries = () => [...S.entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
function forecast() {
  const list = sortedEntries(); if (!list.length) return null;
  const latest = list[0], c = calcEntry(latest), goal = num(S.settings.goal) || 1;
  const nets = list.map((e) => { const k = calcEntry(e); return k.after - k.have; });
  const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
  const left = Math.max(0, goal - c.have);
  if (c.have >= goal) return { done: true, avg, left: 0, n: nets.length };
  if (avg <= 0) return { avg, left, n: nets.length };
  const months = Math.max(1, Math.ceil((goal - c.after) / avg) + 1);
  const when = addMonths(latest.date, months);
  return { avg, left, n: nets.length, months, when: `${MP[when.m]} ${when.y}` };
}

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
  if (!data || data.v !== 8) scheduleSave();
  return true;
}
const save = () => { scheduleSave(); render(); };

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
    scheduleSave(); if (manual) toast(`${j.source}: $1 = ${j.rate} ₸${j.eur ? ', €1 = ' + j.eur + ' ₸' : ''}`);
  } catch { if (manual) toast('Не удалось получить курс'); }
  chip.classList.remove('spin'); render();
}
function paintRate() {
  const s = S.settings;
  $('#rateChip').innerHTML = `$1 = <b>${s.rate} ₸</b>${s.rateEur ? ` · €1 = <b>${s.rateEur} ₸</b>` : ''}<small>${s.rateMode === 'auto' && s.rateSource ? s.rateSource : 'вручную'}</small>`;
}

// ───────── подсказки и «Вернуть» ─────────
let toastT = null;
function toast(msg, undoFn) {
  const t = $('#toast'); t.innerHTML = ''; t.append(h('span', {}, msg));
  if (undoFn) t.append(h('button', { class: 'undo', onclick: () => { undoFn(); t.classList.remove('on'); save(); } }, 'Вернуть'));
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), undoFn ? 7000 : 2400);
}

// ───────── ячейки ─────────
const txt = (val, on, ph = '', cls = '') => h('input', { class: 'cell ' + cls, value: val || '', placeholder: ph, onchange: (e) => on(e.target.value) });
// сумма: показывается с пробелами (1 500 000), при наборе — просто число
function amt(val, on, ph = '', cls = '') {
  const el = h('input', { class: 'cell num ' + cls, inputmode: 'decimal', value: hasV(val) && val !== 0 ? nf.format(val) : '', placeholder: ph,
    onfocus: (e) => { e.target.value = hasV(val) && val !== 0 ? String(val) : ''; e.target.select(); },
    onchange: (e) => on(e.target.value === '' ? '' : num(e.target.value)) });
  return el;
}
const ccySel = (val, on, cls = '') => h('select', { class: 'cell ccy ' + cls, title: 'Валюта', onchange: (e) => on(e.target.value) }, ...['USD', 'EUR', 'KZT'].map((c) => h('option', { value: c, selected: c === val ? 'selected' : false }, SYM[c])));
const xBtn = (on) => h('button', { class: 'x', title: 'Удалить строку', onclick: on }, '×');

// ───────── страница ─────────
function render() {
  paintRate();
  $('#subtitle').textContent = 'Записываем раз в месяц, как в таблице';
  const list = sortedEntries();
  if (open == null && list.length) open = list[0].id;
  const v = $('#view'); v.innerHTML = '';
  v.append(goalCard(list[0]), historyCard(list));
  v.append(h('div', { class: 'addrow' }, h('button', { class: 'btn primary', onclick: () => {
    const prev = list[0], s = S.settings, after = prev ? Math.round(calcEntry(prev).after) : 0;
    const e = { id: uid(), date: todayISO(), rate: s.rate, rateEur: s.rateEur, haves: [line('', after, 'USD')], incomes: [], expenses: [], note: '', auto: !!prev };
    S.entries.push(e); open = e.id; save();
    const el = $('.entry'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } }, '＋ Новая запись')));
  const cur = list.find((e) => e.id === open) || list[0];
  if (cur) v.append(entryCard(cur));
  v.append(galleryCard(), settingsCard());
}

// ───────── цель ─────────
function goalCard(latest) {
  const s = S.settings, have = latest ? calcEntry(latest).have : 0, goal = num(s.goal) || 1, pct = Math.max(0, Math.min(1, have / goal));
  return h('div', { class: 'card goal' },
    h('div', { class: 'photo-head' }, h('img', { src: PHOTOS[0].full, alt: 'Наш дом' }), h('div', { class: 'photo-cap' }, 'Наш дом')),
    h('div', { class: 'goal-body' },
      h('div', { class: 'grow' },
        h('div', { class: 'gl' }, h('span', {}, '🏠 Цель'), h('span', { class: 'ginp' }, amt(s.goal, (v) => { s.goal = num(v) || 1; save(); }), ' $')),
        h('div', { class: 'gl' }, h('span', {}, 'Сейчас есть'), h('b', {}, usd(have))),
        h('div', { class: 'gl' }, h('span', {}, 'Осталось'), h('b', {}, usd(Math.max(0, goal - have))))),
      h('div', { class: 'bar' }, h('i', { style: `width:${pct * 100}%` })),
      h('div', { class: 'hint' }, `${Math.round(pct * 100)}% пути к дому${latest ? ' · по записи от ' + fmtDate(latest.date) : ''}`),
      whenCard()));
}
function whenCard() {
  const f = forecast(); if (!f) return null;
  const box = h('div', { class: 'when' }, h('div', { class: 'wt' }, 'Когда накопим'));
  if (f.done) { box.append(h('div', { class: 'wb' }, '🎉 Уже накопили!')); return box; }
  box.append(h('div', { class: 'wl' }, h('span', {}, 'Осталось'), h('b', {}, usd(f.left))));
  box.append(h('div', { class: 'wl' }, h('span', {}, `В среднем за месяц (по ${f.n} ${f.n === 1 ? 'записи' : 'записям'})`), h('b', { class: f.avg > 0 ? 'pos' : 'neg' }, (f.avg > 0 ? '+' : '') + usd(f.avg))));
  if (f.when) box.append(h('div', { class: 'wb' }, `🏠 Накопим примерно в ${f.when}`), h('div', { class: 'hint' }, `это через ${f.months} мес., если дальше будет как в среднем · чем больше записей, тем точнее`));
  else box.append(h('div', { class: 'wb neg' }, 'Пока не копится: уходит больше, чем приходит'), h('div', { class: 'hint' }, 'как только месяцы станут в плюсе — здесь появится дата'));
  return box;
}

// ───────── история ─────────
function historyCard(list) {
  const asc = [...list].reverse(), goal = num(S.settings.goal) || 1;
  const card = h('div', { class: 'card hist' }, h('div', { class: 'ht' }, 'Как было по числам'), h('div', { class: 'hint', style: 'margin-bottom:8px' }, 'каждая строка — одна запись · нажмите, чтобы открыть и поправить'));
  const t = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Дата'), h('th', { class: 'num' }, 'Было'), h('th', { class: 'num' }, 'Пришло'), h('th', { class: 'num' }, 'Ушло'), h('th', { class: 'num' }, 'Стало')));
  if (!asc.length) t.append(h('tr', {}, h('td', { colspan: 5, class: 'hint' }, 'Записей пока нет — нажмите «Новая запись»')));
  asc.forEach((e, i) => {
    const c = calcEntry(e), last = i === asc.length - 1;
    t.append(h('tr', { class: (e.id === open ? 'sel ' : '') + (last ? 'last' : ''), onclick: () => { open = e.id; render(); const el = $('.entry'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
      h('td', {}, h('b', { class: 'dfull' }, fmtDate(e.date)), h('b', { class: 'dshort' }, fmtDate(e.date).slice(0, 5)), h('span', { class: 'hint' }, ' ' + monthOf(e.date).split(' ')[0].toLowerCase())),
      h('td', { class: 'num' }, usd(c.have)), h('td', { class: 'num pos' }, '+' + usd(c.inc)), h('td', { class: 'num neg' }, '−' + usd(c.expUsd), h('span', { class: 'sub2' }, kzt(c.expKzt))), h('td', { class: 'num' }, h('b', {}, usd(c.after)))));
  });
  t.append(h('tr', { class: 'goalrow' }, h('td', {}, '🏠 Цель'), h('td'), h('td'), h('td'), h('td', { class: 'num' }, h('b', {}, usd(goal)))));
  card.append(h('div', { class: 'tw' }, t));
  return card;
}

// ───────── одна запись ─────────
function entryCard(e) {
  const c = calcEntry(e), s = S.settings;
  const card = h('div', { class: 'card entry' });
  card.append(h('div', { class: 'ehead' },
    h('div', { class: 'edate' }, h('input', { class: 'cell date', type: 'date', value: e.date, onchange: (ev) => { e.date = ev.target.value || e.date; save(); } }), h('span', { class: 'hint' }, monthOf(e.date)))));

  // Сейчас есть — можно несколько строк и в разных валютах
  const hv = h('div', { class: 'block' }, h('div', { class: 'lbl big' }, 'Сейчас есть'));
  e.haves.forEach((x) => hv.append(h('div', { class: 'row have' },
    txt(x.name, (v) => { x.name = v; save(); }, e.haves.length > 1 ? 'где (карта, наличные…)' : 'где (можно не писать)', 'c-name'),
    amt(x.amount, (v) => { x.amount = num(v); e.auto = false; save(); }, 'сумма', 'c-amt'),
    ccySel(x.ccy, (v) => { x.ccy = v; save(); }, 'c-ccy'),
    xBtn(() => { if (e.haves.length === 1) { x.amount = 0; save(); return; } const i = e.haves.indexOf(x); e.haves.splice(i, 1); toast('Строка удалена', () => e.haves.splice(i, 0, x)); save(); }))));
  hv.append(h('div', { class: 'row have foot' }, h('button', { class: 'link', onclick: () => { e.haves.push(line('', 0, 'KZT')); save(); } }, '＋ ещё (другая карта или валюта)'), h('b', {}, usd(c.have)), h('span'), h('span')));
  if (e.auto) hv.append(h('div', { class: 'hint' }, 'Сумму подставили из прошлой записи («будет после всего»). Поправьте, если на самом деле другая.'));
  card.append(hv);

  // Доход
  const inc = h('div', { class: 'block' }, h('div', { class: 'lbl' }, 'Доход'));
  e.incomes.forEach((x) => inc.append(h('div', { class: 'row inc' },
    txt(x.name, (v) => { x.name = v; save(); }, 'откуда (можно не писать)', 'c-name'),
    amt(x.amount, (v) => { x.amount = num(v); save(); }, 'сумма', 'c-amt'),
    ccySel(x.ccy, (v) => { x.ccy = v; save(); }, 'c-ccy'),
    xBtn(() => { const i = e.incomes.indexOf(x); e.incomes.splice(i, 1); toast('Доход удалён', () => e.incomes.splice(i, 0, x)); save(); }))));
  inc.append(h('div', { class: 'row inc foot' }, h('button', { class: 'link', onclick: () => { e.incomes.push(line('', 0, 'USD')); save(); } }, e.incomes.length ? '＋ ещё' : '＋ добавить доход'), h('b', { class: 'pos' }, usd(c.inc)), h('span'), h('span')));
  card.append(inc);

  // Расход
  const exp = h('div', { class: 'block' }, h('div', { class: 'lbl' }, 'Расход'),
    h('div', { class: 'row exp head' }, h('span', { class: 'c-name' }), h('span', { class: 'c-amt' }, 'сколько'), h('span', { class: 'c-ccy' }), h('span', { class: 'c-fact' }, 'по факту'), h('span', { class: 'c-x' })));
  e.expenses.forEach((x) => exp.append(h('div', { class: 'row exp' },
    txt(x.name, (v) => { x.name = v; save(); }, 'на что', 'c-name'),
    amt(x.amount, (v) => { x.amount = num(v); save(); }, 'сколько', 'c-amt'),
    ccySel(x.ccy, (v) => { x.ccy = v; save(); }, 'c-ccy'),
    amt(x.fact, (v) => { x.fact = v === '' ? null : num(v); save(); }, 'по факту', 'c-fact fact'),
    xBtn(() => { const i = e.expenses.indexOf(x); e.expenses.splice(i, 1); toast('Расход удалён', () => e.expenses.splice(i, 0, x)); save(); }))));
  exp.append(h('div', { class: 'row exp foot' }, h('button', { class: 'link c-name', onclick: () => { e.expenses.push(line('', 0, 'KZT')); save(); } }, e.expenses.length ? '＋ ещё' : '＋ добавить расход'), h('b', { class: 'neg c-amt' }, kzt(c.expPlanKzt)), h('span', { class: 'c-ccy' }), h('b', { class: 'neg c-fact' }, c.anyFact ? kzt(c.expKzt) : ''), h('span', { class: 'c-x' })));
  exp.append(h('div', { class: 'hint right' }, `${c.anyFact ? 'по факту ' : ''}${kzt(c.expKzt)} ≈ ${usd(c.expUsd)}`));
  card.append(exp);

  // Итог
  card.append(h('div', { class: 'line total' }, h('span', { class: 'lbl' }, 'Будет после всего'), h('b', {}, usd(c.after))),
    h('div', { class: 'hint right' }, `${usd(c.have)} + ${usd(c.inc)} − ${usd(c.expUsd)}`),
    h('div', { class: 'ratel' }, 'Курс в этой записи: $1 = ', h('input', { class: 'cell mini', type: 'number', step: '0.01', value: e.rate || '', placeholder: String(s.rate), onchange: (ev) => { e.rate = num(ev.target.value) || s.rate; save(); } }), ' ₸ · €1 = ', h('input', { class: 'cell mini', type: 'number', step: '0.01', value: e.rateEur || '', placeholder: String(s.rateEur || ''), onchange: (ev) => { e.rateEur = num(ev.target.value) || s.rateEur; save(); } }), ' ₸'),
    h('textarea', { class: 'note', rows: 2, placeholder: 'Заметка (необязательно)', onchange: (ev) => { e.note = ev.target.value; scheduleSave(); } }, e.note || ''),
    h('div', { class: 'danger-row' }, h('button', { class: 'link danger', onclick: () => {
      if (!confirm('Удалить запись от ' + fmtDate(e.date) + '? Её можно будет вернуть сразу после удаления.')) return;
      const i = S.entries.indexOf(e); S.entries.splice(i, 1); open = null; toast('Запись удалена', () => { S.entries.splice(i, 0, e); open = e.id; }); save();
    } }, 'Удалить эту запись')));
  return card;
}

// ───────── фото нашего дома ─────────
const PHOTOS = [
  { n: 1, cap: 'Гостиная' }, { n: 2, cap: 'Прихожая и лестница' }, { n: 3, cap: 'Большие окна в сад' }, { n: 4, cap: 'Сад и бассейн' }, { n: 5, cap: 'Ужины при свечах' },
].map((p) => ({ ...p, full: `photos/${p.n}.jpg`, thumb: `photos/${p.n}-s.jpg` }));
function lightbox(p) {
  const lb = h('div', { class: 'lb', onclick: () => lb.remove() }, h('img', { src: p.full, alt: p.cap }), h('div', { class: 'lbcap' }, p.cap));
  document.body.append(lb);
  const esc = (ev) => { if (ev.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}
function galleryCard() {
  return h('div', { class: 'card gallery' },
    h('div', { class: 'gal' }, ...PHOTOS.map((p) => h('img', { src: p.thumb, alt: p.cap, title: p.cap, loading: 'lazy', onclick: () => lightbox(p) }))),
    h('div', { class: 'hint' }, 'Таким мы видим наш дом · нажмите на фото, чтобы рассмотреть'));
}

// ───────── настройки ─────────
function settingsCard() {
  const s = S.settings;
  const d = h('details', { class: 'card settings' }, h('summary', {}, 'Курс доллара и евро'));
  d.append(h('div', { class: 'seg' }, h('button', { class: s.rateMode === 'auto' ? 'on' : '', onclick: () => { s.rateMode = 'auto'; save(); refreshRate(); } }, 'Сам, по Нацбанку'), h('button', { class: s.rateMode === 'manual' ? 'on' : '', onclick: () => { s.rateMode = 'manual'; save(); } }, 'Вручную')));
  if (s.rateMode === 'manual') d.append(h('div', { class: 'two' }, h('label', { class: 'field' }, '₸ за $', h('input', { type: 'number', step: '0.01', value: s.rate, onchange: (e) => { s.rate = num(e.target.value) || s.rate; save(); } })), h('label', { class: 'field' }, '₸ за €', h('input', { type: 'number', step: '0.01', value: s.rateEur || '', onchange: (e) => { s.rateEur = num(e.target.value); save(); } }))));
  else d.append(h('label', { class: 'field' }, 'Поправка обменника, ₸ (если меняете не по курсу Нацбанка)', h('input', { type: 'number', step: '0.01', value: s.rateSpread || '', placeholder: 'например −3', onchange: (e) => { s.rateSpread = num(e.target.value); if (s.rateBase) s.rate = r2(s.rateBase + s.rateSpread); save(); } })));
  d.append(h('div', { class: 'hint', style: 'margin-top:10px' }, 'Новая запись запоминает курс на день создания — старые записи не меняются, когда курс плавает. В самой записи курс можно поправить.'));
  return d;
}

// ───────── старт ─────────
async function start() {
  if (!(await load())) return showLogin();
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  render();
  if (S.settings.rateMode === 'auto') refreshRate(false);
}
setInterval(() => { if (S && !document.hidden && S.settings.rateMode === 'auto' && !$('#app').classList.contains('hidden')) refreshRate(false); }, 20 * 60 * 1000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || dirty || !S) return;
  try {
    const r = await fetch('/api/data'); if (!r.ok) return;
    const { data } = await r.json();
    if (data && (data.updatedAt || 0) > lastSaved) { S = migrate(data); lastSaved = data.updatedAt; render(); toast('Данные обновлены'); }
  } catch {}
});
start();
