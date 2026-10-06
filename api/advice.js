const L = require('./_lib');

const SYSTEM = `Ты — спокойный, честный финансовый советник семьи из Казахстана. Цель — как можно быстрее накопить на дом (сумма в $) плюс подушка безопасности. Финансы зарабатывает муж Адиль (зарплата в $), жена — Карина.
В данных: план и факт по месяцам (доходы, расходы, остаток), деньги на счетах и наличных, подушка, прогноз даты цели. Семья делает сверки 1-го и 15-го числа и вносит реальные цифры сама. Сравни план и факт, найди слабые места и закономерности.
Не советуй инвестиционные продукты и не обещай доходность — только бюджет, расходы, доходы, подушку, порядок трат. Отвечай по-русски, коротко, конкретно, с цифрами из данных, без воды.
Верни ТОЛЬКО JSON без markdown:
{"verdict":"2-3 предложения: где семья сейчас и когда реально купят дом",
 "strong":["сильная сторона с цифрой", ...2-3],
 "weak":["слабое место с цифрой", ...2-3],
 "income":["идея, как поднять доход семьи, конкретно", ...2-3],
 "actions":[{"title":"короткое действие","effect":"эффект","detail":"как сделать"}, ...3-4],
 "questions":[]}`;

module.exports = async (req, res) => {
  if (!L.isAuthed(req)) return L.send(res, 401, { error: 'auth' });
  if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return L.send(res, 503, { error: 'no_key' });
  try {
    const body = await L.readBody(req);
    const payload = JSON.stringify(body.summary || {}).slice(0, 30000);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ADVICE_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{ role: 'user', content: 'Данные семьи (JSON):\n' + payload }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return L.send(res, 502, { error: (j.error && j.error.message) || 'api error' });
    const text = (j.content || []).map((c) => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return L.send(res, 502, { error: 'bad answer' });
    L.send(res, 200, { advice: { ...JSON.parse(m[0]), at: Date.now() } });
  } catch (e) {
    L.send(res, 500, { error: String(e.message || e) });
  }
};
