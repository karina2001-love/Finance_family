const L = require('./_lib');

let cache = { at: 0 };

// Основной источник — официальный курс Национального банка РК, запасной — рыночный
async function fromNBK() {
  const d = new Date(Date.now() + 5 * 3600e3); // Астана UTC+5
  const f = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
  const t = await (await fetch('https://nationalbank.kz/rss/get_rates.cfm?fdate=' + f, { signal: AbortSignal.timeout(6000) })).text();
  const m = t.match(/<title>USD<\/title>[\s\S]*?<description>([\d.]+)<\/description>/);
  if (!m) throw new Error('nbk parse');
  return { rate: parseFloat(m[1]), source: 'Нацбанк РК', date: f };
}
async function fromMarket() {
  try {
    const j = await (await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) })).json();
    if (j.rates && j.rates.KZT) return { rate: j.rates.KZT, source: 'рынок (er-api)' };
  } catch {}
  const j = await (await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')).json();
  return { rate: j.usd.kzt, source: 'рынок (currency-api)' };
}

module.exports = async (req, res) => {
  if (!L.isAuthed(req)) return L.send(res, 401, { error: 'auth' });
  try {
    if (Date.now() - cache.at > 20 * 60 * 1000 || !cache.rate) {
      let r;
      try { r = await fromNBK(); } catch { r = await fromMarket(); }
      cache = { at: Date.now(), ...r };
    }
    L.send(res, 200, { rate: Math.round(cache.rate * 100) / 100, source: cache.source, date: cache.date || null, updatedAt: cache.at });
  } catch (e) {
    L.send(res, 502, { error: 'rate unavailable' });
  }
};
