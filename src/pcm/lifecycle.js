export class Lifecycle {
  constructor() {
    this.disposed = false;
    this.cleanups = [];
  }

  timeout(callback, delay) {
    const id = setTimeout(() => {
      if (!this.disposed) callback();
    }, delay);
    this.add(() => clearTimeout(id));
    return id;
  }

  interval(callback, delay) {
    const id = setInterval(() => {
      if (!this.disposed) callback();
    }, delay);
    this.add(() => clearInterval(id));
    return id;
  }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
    return listener;
  }

  add(cleanup) {
    if (this.disposed) {
      cleanup();
      return () => {};
    }
    this.cleanups.push(cleanup);
    return cleanup;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      try { cleanup(); } catch (error) { console.error('[PCM] Cleanup failed', error); }
    }
  }
}
