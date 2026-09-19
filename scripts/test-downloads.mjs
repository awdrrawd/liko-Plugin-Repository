import test from 'node:test';
import assert from 'node:assert/strict';
import {DownloadQueue} from '../src/pcm/download-queue.js';
import {fetchText} from '../src/pcm/network.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('queue fills a free slot without waiting for the other two; failures release slots', async () => {
  const queue = new DownloadQueue(3), started = [], release = [];
  const jobs = Array.from({length: 6}, (_, id) => queue.run(() => {
    started.push(id);
    return new Promise((resolve, reject) => { release[id] = id === 1 ? () => reject(Error('offline')) : resolve; });
  }));
  const settled = Promise.allSettled(jobs);
  await flush();
  assert.deepEqual(started, [0, 1, 2]);
  release[1](); await flush();
  assert.deepEqual(started, [0, 1, 2, 3]);
  assert.equal(queue.active, 3);
  release[3](); await flush(); release[4](); await flush();
  release[0](); release[2](); release[5]();
  assert.equal((await settled).filter(result => result.status === 'rejected').length, 1);
});

test('queued cancellation never starts a request', async () => {
  const queue = new DownloadQueue(1);
  let release;
  const first = queue.run(() => new Promise(resolve => { release = resolve; }));
  const controller = new AbortController();
  const second = queue.run(() => assert.fail('cancelled job ran'), controller.signal);
  controller.abort();
  await assert.rejects(second, {name: 'AbortError'});
  await flush(); release(); await first;
});

test('slow streamed UTF-8 download continues beyond 60 seconds; idle body aborts', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let stream, signal;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    signal = options.signal;
    assert.equal(options.priority, 'low');
    return new Response(new ReadableStream({start(controller) {
      stream = controller;
      signal.addEventListener('abort', () => controller.error(signal.reason), {once: true});
    }}));
  });
  const request = fetchText('https://example.test/slow');
  await flush();
  const bytes = new TextEncoder().encode('中文');
  for (const value of bytes) {
    t.mock.timers.tick(20000);
    stream.enqueue(new Uint8Array([value]));
    await flush();
    assert.equal(signal.aborted, false);
  }
  stream.close();
  assert.equal((await request).text, '中文');
  const stalled = fetchText('https://example.test/stalled');
  const rejection = assert.rejects(stalled, /No download progress/);
  await flush(); stream.enqueue(new Uint8Array([65])); await flush();
  t.mock.timers.tick(30000); await rejection;
  assert.equal(signal.aborted, true);
});

test('first-byte timeout and HTTP errors reject with their real cause', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  t.mock.method(globalThis, 'fetch', (_url, {signal}) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {once: true});
  }));
  const pending = fetchText('https://example.test/no-response');
  const rejection = assert.rejects(pending, /first byte/);
  await flush(); t.mock.timers.tick(45000); await rejection;
  t.mock.method(globalThis, 'fetch', async () => new Response('missing', {status: 404}));
  await assert.rejects(fetchText('https://example.test/404'), /HTTP 404/);
});
