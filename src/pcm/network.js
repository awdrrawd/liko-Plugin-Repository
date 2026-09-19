import {NETWORK_TIMEOUT_MS} from './config.js';
import {downloads} from './download-queue.js';

export class NetworkTimeoutError extends Error {
  constructor(url, timeoutMs) {
    super(`Timeout after ${timeoutMs}ms: ${url}`);
    this.name = 'NetworkTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export function fetchText(url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {
  return downloads.run(() => receiveText(url, options, timeoutMs), options.signal);
}

async function receiveText(url, options, timeoutMs) {
  const controller = new AbortController();
  let timer, timeoutError, reader;
  const arm = (delay, stage) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timeoutError = new NetworkTimeoutError(url, delay);
      timeoutError.message = `No download progress (${stage}) for ${delay}ms: ${url}`;
      controller.abort(timeoutError);
    }, delay);
  };
  const abort = () => controller.abort(options.signal.reason);
  options.signal?.addEventListener('abort', abort, {once: true});
  if (options.signal?.aborted) abort();
  arm(Math.max(45000, timeoutMs), 'first byte');
  try {
    const response = await fetch(url, {priority: 'low', ...options, signal: controller.signal});
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    // Native script/module requests are handled separately; opaque responses
    // cannot safely be executed as fetched JavaScript.
    if (!response.body?.getReader) throw new Error('Readable response body unavailable');
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parts = [];
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      if (value.byteLength) {
        arm(timeoutMs, 'body');
        parts.push(decoder.decode(value, {stream: true}));
      }
    }
    parts.push(decoder.decode());
    const text = parts.join('');
    return {response, text, url};
  } catch (error) {
    if (timeoutError) throw timeoutError;
    throw error;
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
    options.signal?.removeEventListener('abort', abort);
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
