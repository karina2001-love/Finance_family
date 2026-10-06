// Локальный запуск: node server.js  (на Vercel используются файлы из api/ и public/)
const http = require('http');
const fs = require('fs');
const path = require('path');

try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const routes = { '/api/login': require('./api/login'), '/api/logout': require('./api/logout'), '/api/data': require('./api/data'), '/api/advice': require('./api/advice'), '/api/rate': require('./api/rate') };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (routes[url]) return routes[url](req, res);
  const file = path.join(__dirname, 'public', url === '/' ? 'index.html' : url);
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(buf);
  });
}).listen(process.env.PORT || 3456, () => console.log('http://localhost:' + (process.env.PORT || 3456)));
