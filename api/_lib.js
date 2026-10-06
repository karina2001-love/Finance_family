// Общая логика: сессия по паролю + хранилище (файл локально, Upstash Redis на Vercel)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PASSWORD = () => process.env.APP_PASSWORD || '';
const SECRET = () => process.env.SESSION_SECRET || crypto.createHash('sha256').update('fs:' + PASSWORD()).digest('hex');
const COOKIE = 'fs_session';
const MAX_AGE = 60 * 60 * 24 * 30;

const sign = (v) => crypto.createHmac('sha256', SECRET()).update(v).digest('hex');

function makeToken() {
  const exp = Date.now() + MAX_AGE * 1000;
  return `${exp}.${sign(String(exp))}`;
}

function isAuthed(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
}

function cookieHeader(req, token, maxAge) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function checkPassword(input) {
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(PASSWORD()).digest();
  return PASSWORD() !== '' && crypto.timingSafeEqual(a, b);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const txt = Buffer.concat(chunks).toString() || '{}';
  return JSON.parse(txt);
}

function send(res, status, obj, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}

// ---- хранилище ----
const KEY = 'family-finance-v1';
const REST_URL = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const FILE = path.join(__dirname, '..', 'data', 'db.json');

async function redis(cmd) {
  const r = await fetch(REST_URL(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('storage error ' + r.status);
  return (await r.json()).result;
}

async function loadData() {
  if (REST_URL() && REST_TOKEN()) {
    const v = await redis(['GET', KEY]);
    return v ? JSON.parse(v) : null;
  }
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; }
}

async function saveData(data) {
  if (REST_URL() && REST_TOKEN()) return redis(['SET', KEY, JSON.stringify(data)]);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data));
}

module.exports = { isAuthed, makeToken, cookieHeader, checkPassword, readBody, send, loadData, saveData, MAX_AGE };
