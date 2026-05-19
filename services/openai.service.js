import { LIMITS } from '../shared/limits.js';
import { sanitizeErrorMessage } from '../shared/sanitize.js';
import { assertNonEmptyString, isPlainObject } from '../shared/validators.js';
import { recordOpenAiCall } from './request-guard.service.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * @param {{ apiKey: string, model: string, systemPrompt: string, userContent: string, maxOutputTokens?: number, onCallComplete?: () => void }} params
 * @returns {Promise<object>}
 */
export async function chatJsonCompletion(params) {
  const apiKey = assertNonEmptyString(params.apiKey, 'apiKey');
  const model = assertNonEmptyString(params.model, 'model');
  const systemPrompt = truncate(
    assertNonEmptyString(params.systemPrompt, 'systemPrompt'),
    LIMITS.MAX_SYSTEM_PROMPT_CHARS
  );
  const userContent = truncate(
    assertNonEmptyString(params.userContent, 'userContent'),
    LIMITS.MAX_USER_MESSAGE_CHARS
  );
  const maxTokens =
    params.maxOutputTokens ?? LIMITS.MAX_OUTPUT_TOKENS_REVIEW;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    LIMITS.OPENAI_TIMEOUT_MS
  );

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        sanitizeErrorMessage(`OpenAI ${response.status}: ${errText}`)
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Resposta vazia da OpenAI');
    }

    recordOpenAiCall();
    params.onCallComplete?.();

    return parseJsonStrict(content);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `OpenAI: tempo esgotado (${LIMITS.OPENAI_TIMEOUT_MS / 1000}s)`
      );
    }
    throw new Error(sanitizeErrorMessage(err instanceof Error ? err.message : err));
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @param {string} raw
 * @returns {object}
 */
function parseJsonStrict(raw) {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (!isPlainObject(parsed)) {
      throw new Error('JSON deve ser um objeto');
    }
    return parsed;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (!isPlainObject(parsed)) {
          throw new Error('JSON extraído inválido');
        }
        return parsed;
      } catch {
        throw new Error('Não foi possível interpretar JSON da OpenAI');
      }
    }
    throw new Error('Não foi possível interpretar JSON da OpenAI');
  }
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n[…conteúdo truncado por limite de tokens]`;
}
