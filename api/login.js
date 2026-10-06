const L = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
  let body;
  try { body = await L.readBody(req); } catch { return L.send(res, 400, { error: 'bad json' }); }
  if (!L.checkPassword(body.password || '')) {
    await new Promise((r) => setTimeout(r, 900)); // замедляем подбор
    return L.send(res, 401, { error: 'wrong' });
  }
  L.send(res, 200, { ok: true }, { 'Set-Cookie': L.cookieHeader(req, L.makeToken(), L.MAX_AGE) });
};
