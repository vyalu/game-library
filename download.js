/**
 * download.js — общий сетевой слой: JSON-запросы и надёжное скачивание обложек.
 * Проверяет код ответа и тип содержимого, следует редиректам (в т.ч. относительным),
 * не пересылает ключ авторизации на чужой домен, пишет во временный файл и
 * переименовывает только после успешной загрузки.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GameLibrary/1.1';

function isHttpUrl(u) {
  try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:'; }
  catch { return false; }
}

// Открывает ответ, следуя редиректам. Возвращает { res } либо { error }.
function openResponse(url, headers = {}, timeout = 15000, redirects = 0) {
  return new Promise((resolve) => {
    if (redirects > 6) return resolve({ error: 'слишком много редиректов' });
    if (!isHttpUrl(url)) return resolve({ error: 'неверная ссылка' });
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': UA, ...headers }, timeout }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).href;
        // Ключ авторизации не отправляем на другой домен (например, CDN)
        const sameHost = new URL(next).host === new URL(url).host;
        const nextHeaders = { ...headers };
        if (!sameHost) delete nextHeaders.Authorization;
        return openResponse(next, nextHeaders, timeout, redirects + 1).then(resolve);
      }
      resolve({ res });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'таймаут' }); });
  });
}

// В установленной программе запросы идут через сетевой стек Chromium (как браузер: системный прокси, VPN,
// сертификаты Windows); в тестах без Electron — через обычный https
let electronNet = null;
try { const e = require('electron'); if (e?.net?.fetch && process.type === 'browser') electronNet = e.net; } catch {}
async function fetchJson(url, headers = {}, timeout = 12000) {
  if (electronNet && isHttpUrl(url)) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout);
      const r = await electronNet.fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
      const text = await r.text(); clearTimeout(t);
      let body = null; try { body = JSON.parse(text); } catch {}
      return { status: r.status, body };
    } catch { /* ниже — запасной путь через https */ }
  }
  const { res, error } = await openResponse(url, headers, timeout);
  if (error) return { status: 0, body: null, error };
  return new Promise((resolve) => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', (d) => { data += d; });
    res.on('end', () => {
      let body = null;
      try { body = JSON.parse(data); } catch {}
      resolve({ status: res.statusCode, body });
    });
    res.on('error', () => resolve({ status: 0, body: null }));
  });
}

// Произвольный запрос (GET/POST) с ответом текстом — для сайтов без официального API (HowLongToBeat)
async function fetchRaw(url, { method = 'GET', headers = {}, body = null, timeout = 12000 } = {}) {
  if (!electronNet || !isHttpUrl(url)) return { status: 0, text: '' };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await electronNet.fetch(url, { method, headers: { 'User-Agent': UA, ...headers }, body, signal: ctrl.signal });
    const text = await r.text();
    return { status: r.status, text };
  } catch { return { status: 0, text: '' }; } finally { clearTimeout(t); }
}

// Скачивает картинку в dest. Возвращает dest или null.
async function downloadImage(url, dest, headers = {}) {
  const { res, error } = await openResponse(url, headers, 20000);
  if (error || !res) return null;
  const type = String(res.headers['content-type'] || '').toLowerCase();
  const okType = type.startsWith('image/') || type.startsWith('application/octet-stream') || type === '';
  if (res.statusCode !== 200 || !okType) { res.resume(); return null; }
  const part = dest + '.part';
  return new Promise((resolve) => {
    const file = fs.createWriteStream(part);
    let failed = false;
    const fail = () => {
      if (failed) return; failed = true;
      file.destroy();
      try { fs.unlinkSync(part); } catch {}
      resolve(null);
    };
    res.on('error', fail);
    file.on('error', fail);
    res.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        if (failed) return;
        try {
          if (fs.statSync(part).size < 200) return fail(); // пустышка/ошибка вместо картинки
          fs.renameSync(part, dest);
          resolve(dest);
        } catch { fail(); }
      });
    });
  });
}

function extFromUrl(url, fallback = 'jpg') {
  const m = String(url).match(/\.(png|webp|gif|jpe?g)(\?|#|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : fallback;
}

function toFileUrl(p) { return pathToFileURL(p).href; }

// file:// URL (в т.ч. старого формата "file://C:\..." и с ?v=) → путь на диске
function coverUrlToPath(u) {
  if (!u || !String(u).startsWith('file:')) return null;
  const clean = String(u).split('?')[0].split('#')[0];
  try { return fileURLToPath(clean); }
  catch {
    try { return fileURLToPath(new URL(clean).href); } catch {}
    return decodeURIComponent(clean.replace(/^file:\/*/, process.platform === 'win32' ? '' : '/'));
  }
}

// Удаляет все файлы обложек игры, кроме keep
function removeOldCovers(coversDir, gameId, keep) {
  try {
    for (const f of fs.readdirSync(coversDir)) {
      const isOwn = f.startsWith(gameId + '.') || f.startsWith(gameId + '-');
      if (isOwn && path.join(coversDir, f) !== keep && !f.endsWith('.part')) {
        try { fs.unlinkSync(path.join(coversDir, f)); } catch {}
      }
    }
  } catch {}
}

// Скачивает обложку под новым именем (чтобы не было старой картинки из кэша);
// старые файлы удаляются только после успешной загрузки.
async function storeCoverFromUrl(coversDir, gameId, url, headers = {}) {
  if (!isHttpUrl(url)) return null;
  const dest = path.join(coversDir, `${gameId}-${Date.now()}.${extFromUrl(url)}`);
  const ok = await downloadImage(url, dest, headers);
  if (!ok) return null;
  removeOldCovers(coversDir, gameId, dest);
  return toFileUrl(dest);
}

function storeCoverFromFile(coversDir, gameId, srcPath) {
  const ext = (path.extname(srcPath).slice(1) || 'jpg').toLowerCase();
  const dest = path.join(coversDir, `${gameId}-${Date.now()}.${ext}`);
  fs.copyFileSync(srcPath, dest);
  removeOldCovers(coversDir, gameId, dest);
  return toFileUrl(dest);
}

module.exports = {
  fetchRaw,
  isHttpUrl, fetchJson, downloadImage, extFromUrl, toFileUrl, coverUrlToPath,
  removeOldCovers, storeCoverFromUrl, storeCoverFromFile,
};
