// ai-client.js — Azure OpenAI streaming client + shared system prompt
import { AZURE_API_KEY } from './.env.js';

const AZURE_ENDPOINT = 'https://jesseai.openai.azure.com';
const DEPLOYMENT = 'gpt-5.4-mini';
const API_VERSION = '2025-04-01-preview';
const API_KEY = AZURE_API_KEY;

const URL = `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

/**
 * Build the shared system prompt for all AI responses.
 * @param {Array} contentData - full content.json array
 * @param {Object} registry - focusOverlay._wallItemRegistry (key → meta)
 */
export function buildSystemPrompt(contentData, registry) {
  const items = contentData.map(e => {
    const sections = (e.focus?.article?.sections || [])
      .filter(s => s.type === 'text' || s.type === 'subtitle')
      .map(s => s.text).join('\n');
    return {
      key: e.cover_image || e.title,
      title: e.title,
      category: e.category,
      body: e.body || '',
      full_article: sections,
    };
  });

  return `You are Jesse Lai's portfolio website. You speak AS Jesse — warm, confident, first-person ("I", "my work"). You are introducing yourself to a visitor.

Here are all the portfolio items (each has a "key" you can reference):
${JSON.stringify(items, null, 2)}

BEHAVIOR:
- You are talking TO the visitor, introducing Jesse's story based on what they ask
- Keep your own text MINIMAL — 1-2 short sentences per item, then immediately show the atom
- Let the portfolio items speak for themselves — your job is to connect them with brief context
- Every item you mention MUST be followed by its [[atom:KEY]] so the visitor can explore it
- Aim for at least 3-4 atom references per response

FORMAT:
- Use ## for section headings — make them expressive and warm, like conversation starters (e.g. "Here's what I've been working on", "When I'm not designing...", "This one's close to my heart")
- After briefly mentioning a project/topic, write [[atom:KEY]] on its own line
- Do NOT write long paragraphs — be punchy and concise
- Write in the same language the user uses
- Total text (excluding atom markers) should be under 150 words`;
}

/**
 * Stream a chat completion from Azure OpenAI.
 */
export async function streamChat(messages, onToken, onDone, signal) {
  let resp;
  try {
    resp = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': API_KEY,
    },
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
