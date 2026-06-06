// ai-client.js — AI chat via Cloudflare Worker proxy + shared system prompt

// Cloudflare Worker proxy (hides API key server-side)
const WORKER_URL = 'https://crimson-waterfall-c16b.laijianxun123.workers.dev';

// Local dev: check if .env.js exists via fetch (no dynamic import — avoids iOS Safari crash)
let LOCAL_API_KEY = '';
let USE_LOCAL = false;
const _envReady = fetch('./.env.js', { method: 'HEAD' }).then(r => {
  if (r.ok) return fetch('./.env.js').then(r => r.text()).then(txt => {
    const m = txt.match(/['"]([^'"]{10,})['"]/);
    if (m) { LOCAL_API_KEY = m[1]; USE_LOCAL = true; }
  });
}).catch(() => {});

/**
 * Build the shared system prompt for all AI responses.
 * @param {Array} contentData - full content.json array
 * @param {Object} registry - focusOverlay._wallItemRegistry (key → meta)
 */
export function buildSystemPrompt(contentData, registry, lang) {
  const items = contentData.map(e => {
    const sections = (e.focus?.article?.sections || [])
      .filter(s => s.type === 'text' || s.type === 'subtitle')
      .map(s => s.text).join('\n');
    return {
      key: e.title,
      title: e.title,
      category: e.category,
      body: e.body || '',
      full_article: sections,
    };
  });

  return `You are JesseOS, Jesse Lai's personal website. You speak AS Jesse — warm, confident, first-person ("I", "my work"). You are introducing yourself to a visitor.

Here are all the items on JesseOS (each has a "key" you can reference):
${JSON.stringify(items, null, 2)}

BEHAVIOR:
- You are talking TO the visitor, introducing Jesse's story based on what they ask
- Keep your own text MINIMAL — 1-2 short sentences per item, then immediately show the atom
- Let the items speak for themselves — your job is to connect them with brief context
- Every item you mention MUST be followed by its [[atom:KEY]] so the visitor can explore it
- NEVER reference the same atom more than once — each [[atom:KEY]] should appear only once in your response
- Aim for at least 3-4 atom references per response

FORMAT:
- Use ## for section headings — make them expressive and warm, like conversation starters (e.g. "Here's what I've been working on", "When I'm not designing...", "This one's close to my heart")
- After briefly mentioning a project/topic, write [[atom:KEY]] on its own line
- Do NOT write long paragraphs — be punchy and concise
- Reply in the SAME language the user writes in — if they ask in Chinese, answer in Chinese; if they ask in English, answer in English
- Total text (excluding atom markers) should be under 150 words`;
}

/**
 * Stream a chat completion from Azure OpenAI.
 */
export async function streamChat(messages, onToken, onDone, signal) {
  await _envReady;

  // Track user question via Umami
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg && typeof umami !== 'undefined') {
    try { umami.track('user-question', { question: lastUserMsg.content.slice(0, 400), source: 'website' }); } catch(e) {}
  }

  // Choose endpoint: local dev (direct Azure) or production (Cloudflare Worker)
  const url = USE_LOCAL
    ? 'https://jesseai.openai.azure.com/openai/deployments/gpt-5.4-mini/chat/completions?api-version=2025-04-01-preview'
    : WORKER_URL;

  const headers = { 'Content-Type': 'application/json' };
  if (USE_LOCAL) headers['api-key'] = LOCAL_API_KEY;

  let resp;
  try {
    resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      stream: true,
      max_completion_tokens: 2000,
      temperature: 0.7,
    }),
    signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') { onDone(); return; }
    console.error('Network error:', e);
    onToken('Network error — please try again.');
    onDone();
    return;
  }

  if (!resp.ok) {
    const err = await resp.text();
    console.error('Azure OpenAI error:', resp.status, err);
    onToken('Sorry, something went wrong. Please try again.');
    onDone();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') { onDone(); return; }
      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content;
        if (token) onToken(token);
      } catch {}
    }
  }
  onDone();
}

/**
 * Non-streaming chat: returns full response as a string.
 */
export async function chatSync(messages) {
  let text = '';
  await streamChat(messages, t => { text += t; }, () => {});
  return text.trim();
}
