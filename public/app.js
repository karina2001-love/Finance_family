'use strict';
// ───────── helpers ─────────
const $ = (s) => document.querySelector(s);
const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const usd = (n) => (n < 0 ? '−' : '') + '$' + nf.format(Math.abs(Math.round(n)));
const kzt = (n) => (n < 0 ? '−' : '') + nf.format(Math.abs(Math.round(n))) + ' ₸';
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const sum = (arr, f) => (arr || []).reduce((a, x) => a + num(typeof f === 'function' ? f(x) : x[f]), 0);
const r2 = (n) => Math.round(n * 100) / 100;
const hasV = (x) => x !== undefined && x !== null && x !== '';
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const monthOf = (iso) => { const [y, m] = iso.split('-').map(Number); return `${MN[m - 1]} ${y}`; };
const MP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
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
const FROM_EXCEL = () => [
  { id: uid(), date: '2026-10-06', have: 26496, incomes: [{ id: uid(), name: '', usd: 5600 }],
    expenses: [{ id: uid(), name: 'Адиль', kzt: 500000, fact: 500000 }, { id: uid(), name: 'Машина', kzt: 280000, fact: 300000 }, { id: uid(), name: 'Каско', kzt: 700000, fact: null }, { id: uid(), name: 'Тайланд', kzt: 1500000, fact: 2000000 }], note: '' },
  { id: uid(), date: '2026-11-02', have: 20500, incomes: [{ id: uid(), name: '', usd: 8126 }, { id: uid(), name: '', usd: 5600 }],
    expenses: [{ id: uid(), name: 'Каско', kzt: 700000, fact: null }, { id: uid(), name: 'Адиль', kzt: 200000, fact: null }, { id: uid(), name: 'Подарок маме', kzt: 100000, fact: null }], note: '' },
];
function seed() {
  return { v: 7, settings: { goal: 200000, rateMode: 'auto', rate: 450.79, rateBase: 0, rateSource: '', rateUpdated: 0, rateSpread: 0 }, entries: FROM_EXCEL() };
}
// перенос из прошлых версий сайта: цели и курс сохраняем, записи берём из таблицы
function migrate(d) {
  if (!d) return seed();
  if (d.v === 7) return d;
  const S7 = seed(), s = d.settings || {};
  for (const k of ['goal', 'rateMode', 'rate', 'rateBase', 'rateSource', 'rateUpdated', 'rateSpread']) if (s[k] !== undefined) S7.settings[k] = s[k];
  return S7;
}
let S = null, dirty = false, lastSaved = 0, open = null;

// ───────── расчёт одной записи ─────────
const rateOf = (e) => (num(e.rate) > 0 ? num(e.rate) : num(S.settings.rate) || 1);
function calcEntry(e) {
  const rate = rateOf(e), inc = sum(e.incomes, 'usd');
  const expPlan = sum(e.expenses, 'kzt'), expKzt = sum(e.expenses, (x) => (hasV(x.fact) ? x.fact : x.kzt));
  const anyFact = e.expenses.some((x) => hasV(x.fact));
  const expUsd = expKzt / rate, after = num(e.have) + inc - expUsd;
  return { rate, inc, expPlan, expKzt, anyFact, expUsd, after };
}
const sortedEntries = () => [...S.entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
function forecast() {
  const list = sortedEntries(); if (!list.length) return null;
  const latest = list[0], c = calcEntry(latest), goal = num(S.settings.goal) || 1;
  const nets = list.map((e) => calcEntry(e).after - num(e.have));
  const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
  const left = Math.max(0, goal - num(latest.have));
  if (num(latest.have) >= goal) return { done: true, avg, left: 0, n: nets.length };
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
  if (!data || data.v !== 7) scheduleSave();
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
    if (s.rateMode === 'auto') s.rate = r2(j.rate + num(s.rateSpread));
    scheduleSave(); if (manual) toast(`${j.source}: ${j.rate} ₸ за $`);
  } catch { if (manual) toast('Не удалось получить курс'); }
  chip.classList.remove('spin'); render();
}
function paintRate() {
  const s = S.settings;
  $('#rateChip').innerHTML = `$1 = <b>${s.rate} ₸</b><small>${s.rateMode === 'auto' && s.rateSource ? s.rateSource : 'вручную'}</small>`;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400); }

// ───────── ячейки ─────────
const txt = (val, on, ph = '') => h('input', { class: 'cell', value: val || '', placeholder: ph, onchange: (e) => on(e.target.value) });
const numc = (val, on, ph = '') => h('input', { class: 'cell num', type: 'number', inputmode: 'decimal', value: hasV(val) ? val : '', placeholder: ph, onchange: (e) => on(e.target.value) });
const xBtn = (on) => h('button', { class: 'x', title: 'Удалить', onclick: on }, '×');

// ───────── фото нашего дома ─────────
const PHOTOS = [
  { n: 1, cap: 'Гостиная' }, { n: 2, cap: 'Прихожая и лестница' }, { n: 3, cap: 'Большие окна в сад' }, { n: 4, cap: 'Сад и бассейн' }, { n: 5, cap: 'Ужины при свечах' },
].map((p) => ({ ...p, full: `photos/${p.n}.jpg`, thumb: `photos/${p.n}-s.jpg` }));
function lightbox(p) {
  const lb = h('div', { class: 'lb', onclick: () => lb.remove() }, h('img', { src: p.full, alt: p.cap }), h('div', { class: 'lbcap' }, p.cap));
  document.body.append(lb);
  const esc = (e) => { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}
function galleryCard() {
  return h('div', { class: 'card gallery' },
    h('div', { class: 'gal' }, ...PHOTOS.map((p) => h('img', { src: p.thumb, alt: p.cap, title: p.cap, loading: 'lazy', onclick: () => lightbox(p) }))),
    h('div', { class: 'hint' }, 'Таким мы видим наш дом · нажмите на фото, чтобы рассмотреть'));
}

// ───────── страница ─────────
function render() {
  paintRate();
  $('#subtitle').textContent = 'Записываем раз в месяц, как в таблице';
  const list = sortedEntries();
  if (open == null && list.length) open = list[0].id;
  const v = $('#view'); v.innerHTML = '';
  v.append(goalCard(list[0]), historyCard(list));
  v.append(h('div', { class: 'addrow' }, h('button', { class: 'btn primary', onclick: () => {
    const prev = list[0], after = prev ? Math.round(calcEntry(prev).after) : 0;
    const e = { id: uid(), date: todayISO(), have: after, incomes: [], expenses: [], note: '' };
    S.entries.push(e); open = e.id; save();
  } }, '＋ Новая запись')));
  const cur = list.find((e) => e.id === open) || list[0];
  if (cur) v.append(entryCard(cur, list));
  v.append(galleryCard(), settingsCard());
}

function goalCard(latest) {
  const s = S.settings, have = latest ? num(latest.have) : 0, goal = num(s.goal) || 1, pct = Math.max(0, Math.min(1, have / goal));
  return h('div', { class: 'card goal' },
    h('div', { class: 'photo-head' }, h('img', { src: PHOTOS[0].full, alt: 'Наш дом' }), h('div', { class: 'photo-cap' }, 'Наш дом')),
    h('div', { class: 'goal-body' },
    h('div', { class: 'grow' },
      h('div', { class: 'gl' }, h('span', {}, '🏠 Цель'), h('span', { class: 'ginp' }, numc(s.goal, (v) => { s.goal = num(v) || 1; save(); }), ' $')),
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
  box.append(h('div', { class: 'wl' }, h('span', {}, `В среднем за месяц (по ${f.n} ${f.n === 1 ? 'записи' : f.n < 5 ? 'записям' : 'записям'})`), h('b', { class: f.avg > 0 ? 'pos' : 'neg' }, (f.avg > 0 ? '+' : '') + usd(f.avg))));
  if (f.when) box.append(h('div', { class: 'wb' }, `🏠 Накопим примерно в ${f.when}`), h('div', { class: 'hint' }, `это через ${f.months} мес., если дальше будет как в среднем · чем больше записей, тем точнее`));
  else box.append(h('div', { class: 'wb neg' }, 'Пока не копится: уходит больше, чем приходит'), h('div', { class: 'hint' }, 'как только месяцы станут в плюсе — здесь появится дата'));
  return box;
}

// история по числам
function historyCard(list) {
  const asc = [...list].reverse(), goal = num(S.settings.goal) || 1;
  const card = h('div', { class: 'card hist' }, h('div', { class: 'ht' }, 'Как было по числам'), h('div', { class: 'hint', style: 'margin-bottom:8px' }, 'каждая строка — одна запись · нажмите, чтобы открыть'));
  const t = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Дата'), h('th', { class: 'num' }, 'Было'), h('th', { class: 'num' }, 'Пришло'), h('th', { class: 'num' }, 'Ушло'), h('th', { class: 'num' }, 'Стало')));
  asc.forEach((e, i) => {
    const c = calcEntry(e), last = i === asc.length - 1;
    t.append(h('tr', { class: (e.id === open ? 'sel ' : '') + (last ? 'last' : ''), onclick: () => { open = e.id; render(); const el = $('.entry'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
      h('td', {}, h('b', { class: 'dfull' }, fmtDate(e.date)), h('b', { class: 'dshort' }, fmtDate(e.date).slice(0, 5)), h('span', { class: 'hint' }, ' ' + monthOf(e.date).split(' ')[0].toLowerCase())),
      h('td', { class: 'num' }, usd(e.have)), h('td', { class: 'num pos' }, '+' + usd(c.inc)), h('td', { class: 'num neg' }, '−' + usd(c.expUsd), h('span', { class: 'sub2' }, kzt(c.expKzt))), h('td', { class: 'num' }, h('b', {}, usd(c.after)))));
  });
  t.append(h('tr', { class: 'goalrow' }, h('td', {}, '🏠 Цель'), h('td'), h('td'), h('td'), h('td', { class: 'num' }, h('b', {}, usd(goal)))));
  card.append(h('div', { class: 'tw' }, t));
  return card;
}

function entrySummary(e) {
  const c = calcEntry(e);
  return h('div', { class: 'card sum', onclick: () => { open = e.id; render(); } },
    h('div', { class: 'srow' }, h('b', {}, fmtDate(e.date)), h('span', { class: 'hint' }, monthOf(e.date))),
    h('div', { class: 'srow hint' }, `Сейчас есть ${usd(e.have)} · доход ${usd(c.inc)} · расход ${kzt(c.expKzt)} · будет ${usd(c.after)}`));
}

function entryCard(e, list) {
  const c = calcEntry(e), s = S.settings;
  const card = h('div', { class: 'card entry' });
  card.append(h('div', { class: 'ehead' },
    h('div', { class: 'edate' }, h('input', { class: 'cell date', type: 'date', value: e.date, onchange: (ev) => { e.date = ev.target.value || e.date; save(); } }), h('span', { class: 'hint' }, monthOf(e.date))),
    h('div', { class: 'r' }, h('button', { class: 'link danger', onclick: () => { if (confirm('Удалить запись от ' + fmtDate(e.date) + '?')) { S.entries = S.entries.filter((x) => x.id !== e.id); open = null; save(); } } }, 'Удалить'))));

  // Сейчас есть
  card.append(h('div', { class: 'line big' }, h('span', { class: 'lbl' }, 'Сейчас есть'), h('span', { class: 'val' }, numc(e.have, (v) => { e.have = num(v); save(); }), h('u', {}, '$'))));

  // Доход
  const inc = h('div', { class: 'block' }, h('div', { class: 'lbl' }, 'Доход'));
  e.incomes.forEach((x) => inc.append(h('div', { class: 'row inc' }, txt(x.name, (v) => { x.name = v; save(); }, 'откуда (можно не писать)'), numc(x.usd, (v) => { x.usd = num(v); save(); }, '$'), xBtn(() => { e.incomes.splice(e.incomes.indexOf(x), 1); save(); }))));
  inc.append(h('div', { class: 'row inc foot' }, h('button', { class: 'link', onclick: () => { e.incomes.push({ id: uid(), name: '', usd: 0 }); save(); } }, '＋ ещё'), h('b', { class: 'pos' }, usd(c.inc)), h('span')));
  card.append(inc);

  // Расход
  const exp = h('div', { class: 'block' }, h('div', { class: 'lbl' }, 'Расход'), h('div', { class: 'row exp head' }, h('span'), h('span', {}, 'сколько, ₸'), h('span', {}, 'по факту'), h('span')));
  e.expenses.forEach((x) => exp.append(h('div', { class: 'row exp' }, txt(x.name, (v) => { x.name = v; save(); }, 'на что'), numc(x.kzt, (v) => { x.kzt = num(v); save(); }, '₸'), numc(x.fact, (v) => { x.fact = v === '' ? null : num(v); save(); }, '—'), xBtn(() => { e.expenses.splice(e.expenses.indexOf(x), 1); save(); }))));
  exp.append(h('div', { class: 'row exp foot' }, h('button', { class: 'link', onclick: () => { e.expenses.push({ id: uid(), name: '', kzt: 0, fact: null }); save(); } }, '＋ ещё'), h('b', { class: 'neg' }, kzt(c.expPlan)), h('b', { class: 'neg' }, c.anyFact ? kzt(c.expKzt) : ''), h('span')));
  exp.append(h('div', { class: 'hint right' }, `${c.anyFact ? 'по факту ' : ''}${kzt(c.expKzt)} ≈ ${usd(c.expUsd)} по курсу ${c.rate}`));
  card.append(exp);

  // Итог
  card.append(h('div', { class: 'line total' }, h('span', { class: 'lbl' }, 'Будет после всего'), h('b', {}, usd(c.after))),
    h('div', { class: 'hint right' }, `${usd(e.have)} + ${usd(c.inc)} − ${usd(c.expUsd)}`),
    h('textarea', { class: 'note', rows: 2, placeholder: 'Заметка (необязательно)', onchange: (ev) => { e.note = ev.target.value; scheduleSave(); } }, e.note || ''));
  return card;
}

function settingsCard() {
  const s = S.settings;
  const d = h('details', { class: 'card settings' }, h('summary', {}, 'Курс доллара'));
  d.append(h('div', { class: 'seg' }, h('button', { class: s.rateMode === 'auto' ? 'on' : '', onclick: () => { s.rateMode = 'auto'; save(); refreshRate(); } }, 'Сам, по Нацбанку'), h('button', { class: s.rateMode === 'manual' ? 'on' : '', onclick: () => { s.rateMode = 'manual'; save(); } }, 'Вручную')));
  d.append(s.rateMode === 'manual' ? h('label', { class: 'field' }, '₸ за $', h('input', { type: 'number', step: '0.01', value: s.rate, onchange: (e) => { s.rate = num(e.target.value) || s.rate; save(); } }))
    : h('label', { class: 'field' }, 'Поправка обменника, ₸ (если меняете не по курсу Нацбанка)', h('input', { type: 'number', step: '0.01', value: s.rateSpread || '', placeholder: 'например −3', onchange: (e) => { s.rateSpread = num(e.target.value); if (s.rateBase) s.rate = r2(s.rateBase + s.rateSpread); save(); } })));
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
