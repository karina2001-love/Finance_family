const L = require('./_lib');

module.exports = (req, res) => L.send(res, 200, { ok: true }, { 'Set-Cookie': L.cookieHeader(req, '', 0) });
