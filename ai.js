/**
 * ai.js — универсальный AI-слой
 * Провайдеры: Google Gemini (бесплатно), Groq (бесплатно), Claude (платно)
 */
const https = require('https');

// Last error message, readable by enricher for logging
let lastError = '';
function getLastError() { return lastError; }

function postJson(hostname, path, headers, bodyObj) {
  const body = JSON.stringify(bodyObj);
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout: 45000
    }, (res) => {
      let d = '';
      res.setEncoding?.('utf8');   // иначе русская буква на стыке кусков ломается
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(d); } catch {}
        resolve({ status: res.statusCode, body: parsed, raw: d });
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: null, raw: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: null, raw: 'timeout' }); });
    req.write(body); req.end();
  });
}

// ─── Google Gemini ──────────────────────────────────────────────────────────
// Бесплатно: aistudio.google.com/apikey. Пробуем модели по очереди.
// Модели 2.5 по умолчанию «думают», и скрытые токены размышления тратят лимит
// ответа — длинный перевод обрезался или приходил пустым. Для перевода
// размышление отключаем (thinkingBudget: 0), а лимит ответа поднимаем.
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

function geminiBody(prompt, model, withThinkingOff) {
  const generationConfig = { temperature: 0.3, maxOutputTokens: 4096 };
  if (withThinkingOff && /2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  return { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig };
}

function geminiText(body) {
  const parts = body?.candidates?.[0]?.content?.parts || [];
  // Пропускаем служебные «мысли», склеиваем все текстовые части
  return parts.filter((p) => p && p.text && !p.thought).map((p) => p.text).join('').trim();
}

async function geminiChat(prompt, apiKey) {
  lastError = '';
  for (const model of GEMINI_MODELS) {
    let res = await postJson(
      'generativelanguage.googleapis.com',
      `/v1beta/models/${model}:generateContent`,
      { 'x-goog-api-key': apiKey },
      geminiBody(prompt, model, true)
    );
    // Если модель не поддерживает thinkingConfig — повторяем без него
    if (res.status === 400 && /thinking/i.test(res.body?.error?.message || '')) {
      res = await postJson('generativelanguage.googleapis.com', `/v1beta/models/${model}:generateContent`,
        { 'x-goog-api-key': apiKey }, geminiBody(prompt, model, false));
    }
    if (res.status === 200) {
      const text = geminiText(res.body);
      const finish = res.body?.candidates?.[0]?.finishReason;
      if (text && finish !== 'MAX_TOKENS') return text;
      if (text) return text; // обрезано, но лучше, чем ничего
      lastError = finish === 'SAFETY' ? 'ответ заблокирован фильтром' : 'пустой ответ от ' + model;
      continue;
    }
    const msg = res.body?.error?.message || res.raw || ('HTTP ' + res.status);
    if (res.status === 401 || res.status === 403 || /API key/i.test(msg)) {
      lastError = 'ключ отклонён (' + msg.slice(0, 80) + ')';
      return null; // неверный ключ — другие модели не помогут
    }
    if (res.status === 404 || res.status === 400) { lastError = 'модель ' + model + ' недоступна'; continue; }
    if (res.status === 429) { lastError = 'превышен бесплатный лимит запросов, попробуйте позже'; return null; }
    if (res.status === 0) { lastError = 'нет связи (' + String(res.raw).slice(0, 40) + ')'; return null; }
    lastError = 'HTTP ' + res.status + ': ' + msg.slice(0, 60);
  }
  return null;
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

async function groqChat(prompt, apiKey) {
  lastError = '';
  for (const model of GROQ_MODELS) {
    const res = await postJson(
      'api.groq.com',
      '/openai/v1/chat/completions',
      { Authorization: `Bearer ${apiKey}` },
      { model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 4096 }
    );
    if (res.status === 200) {
      const text = res.body?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      lastError = 'пустой ответ';
      continue;
    }
    const msg = res.body?.error?.message || res.raw || ('HTTP ' + res.status);
    if (res.status === 401) { lastError = 'неверный ключ'; return null; }
    if (res.status === 404 || res.status === 400) { lastError = 'модель ' + model + ' недоступна'; continue; }
    if (res.status === 429) { lastError = 'превышен лимит'; return null; }
    lastError = 'HTTP ' + res.status + ': ' + msg.slice(0, 60);
  }
  return null;
}

// ─── Claude ───────────────────────────────────────────────────────────────────
async function claudeChat(prompt, apiKey) {
  lastError = '';
  const res = await postJson(
    'api.anthropic.com',
    '/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }
  );
  if (res.status === 200) {
    const text = res.body?.content?.[0]?.text?.trim();
    if (text) return text;
    lastError = 'пустой ответ';
    return null;
  }
  const msg = res.body?.error?.message || res.raw || ('HTTP ' + res.status);
  lastError = 'HTTP ' + res.status + ': ' + msg.slice(0, 60);
  return null;
}

async function aiChat(prompt, settings) {
  const provider = settings.aiProvider || 'none';
  if (provider === 'gemini' && settings.geminiKey) return geminiChat(prompt, settings.geminiKey);
  if (provider === 'groq' && settings.groqKey) return groqChat(prompt, settings.groqKey);
  if (provider === 'claude' && settings.claudeKey) return claudeChat(prompt, settings.claudeKey);
  return null;
}

function aiAvailable(settings) {
  const p = settings.aiProvider || 'none';
  if (p === 'gemini') return !!settings.geminiKey;
  if (p === 'groq') return !!settings.groqKey;
  if (p === 'claude') return !!settings.claudeKey;
  return false;
}

// ─── Tasks ──────────────────────────────────────────────────────────────────
async function normalizeName(rawName, settings) {
  if (!aiAvailable(settings)) return null;
  const prompt = `Extract the clean video game title from this EXE/folder name for database search.
Input: "${rawName}"
Remove version numbers, x64/x86, underscores, "launcher", "retail", "GOTY", file extensions. Fix obvious typos.
Respond with ONLY the clean title. No quotes, no explanation.`;
  const out = await aiChat(prompt, settings);
  if (!out) return null;
  const title = out.split('\n')[0].replace(/^["']|["']$/g, '').trim();
  return title ? { title } : null;
}

async function translateToRussian(text, settings) {
  if (!aiAvailable(settings) || !text) return null;
  const prompt = `Переведи это описание видеоигры на русский язык. Сохрани все детали, переведи полностью и естественно (можно несколько абзацев). Верни ТОЛЬКО переведённый русский текст — без кавычек, без пояснений, без английского:

${text.slice(0, 2000)}`;
  const out = await aiChat(prompt, settings);
  return out ? out.replace(/^["']|["']$/g, '').trim() : null;
}

// Quick connectivity test for a provider — returns {ok, message}
async function testProvider(settings) {
  if (!aiAvailable(settings)) return { ok: false, message: 'Ключ не задан' };
  const out = await aiChat('Reply with exactly: OK', settings);
  if (out) return { ok: true, message: 'Работает ✓ (ответ: ' + out.slice(0, 30) + ')' };
  return { ok: false, message: lastError || 'нет ответа' };
}

module.exports = { aiChat, aiAvailable, normalizeName, translateToRussian, testProvider, getLastError, geminiChat, groqChat, claudeChat };
