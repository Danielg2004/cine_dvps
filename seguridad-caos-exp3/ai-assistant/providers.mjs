#!/usr/bin/env node
/**
 * Proveedores LLM configurables para el lab aislado.
 * No asume credenciales ni presupuesto.
 *
 * CINE_AI_PROVIDER=
 *   none     → error explícito (no inventa respuestas)
 *   ollama   → http://127.0.0.1:11434/api/chat (local)
 *   openai   → API compatible OpenAI (requiere CINE_AI_BASE_URL + CINE_AI_API_KEY)
 *   fixture  → solo tests de cableado HTTP; NO es un modelo real
 */

/**
 * @typedef {{
 *   role: 'system' | 'user' | 'assistant',
 *   content: string
 * }} ChatMessage
 *
 * @typedef {{
 *   provider: string,
 *   model: string,
 *   content: string,
 *   raw?: unknown,
 *   simulated: boolean
 * }} LlmCompletion
 */

export function resolveProviderName() {
  return (process.env.CINE_AI_PROVIDER || 'none').trim().toLowerCase();
}

export function resolveModelName() {
  return process.env.CINE_AI_MODEL?.trim()
    || (resolveProviderName() === 'ollama' ? 'llama3.2' : 'gpt-4o-mini');
}

/**
 * @param {ChatMessage[]} messages
 * @param {{ provider?: string, model?: string, timeoutMs?: number, fixtureReply?: string }} [opts]
 * @returns {Promise<LlmCompletion>}
 */
export async function completeChat(messages, opts = {}) {
  const provider = (opts.provider || resolveProviderName()).toLowerCase();
  const model = opts.model || resolveModelName();
  const timeoutMs = opts.timeoutMs ?? 60_000;

  if (provider === 'none' || provider === '') {
    const err = new Error(
      'CINE_AI_PROVIDER=none: no hay modelo configurado. Use ollama|openai tras instalar/configurar el proveedor.',
    );
    err.code = 'AI_PROVIDER_NONE';
    throw err;
  }

  if (provider === 'fixture') {
    if (!opts.fixtureReply) {
      throw Object.assign(new Error('fixtureReply requerido para provider=fixture'), { code: 'AI_FIXTURE' });
    }
    return {
      provider: 'fixture',
      model: model || 'fixture',
      content: opts.fixtureReply,
      simulated: true,
    };
  }

  if (provider === 'ollama') {
    return completeOllama(messages, model, timeoutMs);
  }

  if (provider === 'openai') {
    return completeOpenAiCompatible(messages, model, timeoutMs);
  }

  throw Object.assign(new Error(`Proveedor no soportado: ${provider}`), { code: 'AI_PROVIDER_UNKNOWN' });
}

/**
 * @param {ChatMessage[]} messages
 * @param {string} model
 * @param {number} timeoutMs
 */
async function completeOllama(messages, model, timeoutMs) {
  const base = (process.env.CINE_AI_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options: { temperature: 0 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`), { code: 'AI_OLLAMA_HTTP' });
    }
    const raw = await res.json();
    const content = raw?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw Object.assign(new Error('Respuesta Ollama vacía o inesperada'), { code: 'AI_OLLAMA_EMPTY' });
    }
    return {
      provider: 'ollama',
      model,
      content,
      raw,
      simulated: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {ChatMessage[]} messages
 * @param {string} model
 * @param {number} timeoutMs
 */
async function completeOpenAiCompatible(messages, model, timeoutMs) {
  const base = (process.env.CINE_AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const key = process.env.CINE_AI_API_KEY?.trim();
  if (!key) {
    throw Object.assign(new Error('CINE_AI_API_KEY requerido para provider=openai'), { code: 'AI_OPENAI_KEY' });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`OpenAI-compatible HTTP ${res.status}: ${text.slice(0, 200)}`), { code: 'AI_OPENAI_HTTP' });
    }
    const raw = await res.json();
    const content = raw?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw Object.assign(new Error('Respuesta OpenAI-compatible vacía'), { code: 'AI_OPENAI_EMPTY' });
    }
    return {
      provider: 'openai',
      model,
      content,
      raw,
      simulated: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Sondeo no destructivo: ¿hay Ollama local? */
export async function probeOllama(timeoutMs = 1500) {
  const base = (process.env.CINE_AI_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
