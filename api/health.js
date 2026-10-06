const L = require('./_lib');

// Открытая проверка: какое хранилище активно и задан ли пароль (без самих значений)
module.exports = (req, res) => L.send(res, 200, { ok: true, storage: L.storageKind(), passwordSet: !!process.env.APP_PASSWORD });
