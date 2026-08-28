import {NETWORK_TIMEOUT_MS} from './config.js';

export class NetworkTimeoutError extends Error {
  constructor(url, timeoutMs) {
    super(`Timeout after ${timeoutMs}ms: ${url}`);
    this.name = 'NetworkTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchText(url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {...options, signal: controller.signal});
    const text = await response.text();
    return {response, text, url};
  } catch (error) {
    if (error?.name === 'AbortError') throw new NetworkTimeoutError(url, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFirstText(urls, options = {}, validate = null) {
  const attempts = [];
  for (const url of [...new Set(urls.filter(Boolean))]) {
    const startedAt = Date.now();
    try {
      const result = await fetchText(url, options);
      if (!result.response.ok) throw new Error(`HTTP ${result.response.status}`);
      if (validate && !validate(result.text, result.response)) throw new Error('Invalid response content');
      return {...result, attempts};
    } catch (error) {
      attempts.push({url, durationMs: Date.now() - startedAt, error: String(error?.message || error)});
    }
  }
  const error = new AggregateError(attempts.map(a => new Error(`${a.url}: ${a.error}`)), 'All sources failed');
  error.attempts = attempts;
  throw error;
}

export function isJavaScriptText(text) {
  return typeof text === 'string' && text.trim().length > 0 && !text.trimStart().startsWith('<');
}
