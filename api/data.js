const L = require('./_lib');

module.exports = async (req, res) => {
  if (!L.isAuthed(req)) return L.send(res, 401, { error: 'auth' });
  try {
    if (req.method === 'GET') return L.send(res, 200, { data: await L.loadData() });
    if (req.method === 'PUT') {
      const body = await L.readBody(req);
      if (!body.data || typeof body.data !== 'object') return L.send(res, 400, { error: 'bad data' });
      body.data.updatedAt = Date.now();
      await L.saveData(body.data);
      return L.send(res, 200, { ok: true, updatedAt: body.data.updatedAt });
    }
    L.send(res, 405, { error: 'method' });
  } catch (e) {
    L.send(res, 500, { error: String(e.message || e) });
  }
};
