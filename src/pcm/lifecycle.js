export class Lifecycle {
  constructor() {
    this.disposed = false;
    this.cleanups = new Set();
    this.timeouts = new Set();
    this.intervals = new Set();
  }

  timeout(callback, delay = 0) {
    if (this.disposed) return null;
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      if (!this.disposed) callback();
    }, delay);
    this.timeouts.add(id);
    return id;
  }

  interval(callback, delay) {
    if (this.disposed) return null;
    const id = setInterval(() => {
      if (!this.disposed) callback();
    }, delay);
    this.intervals.add(id);
    return id;
  }

  listen(target, type, listener, options) {
    if (this.disposed) return listener;
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
    return listener;
  }

  add(cleanup) {
    if (this.disposed) {
      cleanup();
      return () => {};
    }
    this.cleanups.add(cleanup);
    return cleanup;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of this.timeouts) clearTimeout(id);
    for (const id of this.intervals) clearInterval(id);
    this.timeouts.clear();
    this.intervals.clear();
    const cleanups = [...this.cleanups].reverse();
    this.cleanups.clear();
    for (const cleanup of cleanups) {
      try { cleanup(); } catch (error) { console.error('[PCM] Cleanup failed', error); }
    }
  }

  clearTimeout(id) {
    clearTimeout(id);
    this.timeouts.delete(id);
  }

  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  sleep(delay) {
    if (this.disposed) return Promise.resolve(false);
    return new Promise(resolve => {
      const cancelled = () => resolve(false);
      this.add(cancelled);
      this.timeout(() => { this.cleanups.delete(cancelled); resolve(true); }, delay);
    });
  }
}
