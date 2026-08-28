export class RuntimeStore {
  constructor(logLimit = 300) {
    this.states = new Map();
    this.logs = [];
    this.logLimit = logLimit;
    this.listeners = new Set();
  }

  update(id, patch) {
    const previous = this.states.get(id) || {status: 'idle'};
    const next = {...previous, ...patch};
    const now = Date.now();
    if (patch.status === 'loading') {
      next.startedAt = patch.startedAt || now;
      next.settledAt = null;
      next.durationMs = null;
    }
    if (['loaded', 'cached', 'failed'].includes(patch.status) && next.settledAt == null) {
      next.settledAt = now;
      if (next.startedAt) next.durationMs = now - next.startedAt;
    }
    this.states.set(id, next);
    if (patch.status && patch.status !== previous.status) {
      this.log(patch.status === 'failed' ? 'ERROR' : 'INFO', `Plugin ${id}: ${previous.status} -> ${patch.status}`, {
        source: next.source,
        loadType: next.loadType,
        durationMs: next.durationMs,
        error: next.error,
      });
    }
    this.emit(id, next);
    return {...next};
  }

  get(id) {
    return {...(this.states.get(id) || {status: 'idle'})};
  }

  entries() {
    return [...this.states].map(([id, state]) => ({id, ...state}));
  }

  log(level, message, data = null) {
    this.logs.push({time: Date.now(), level, message, ...(data ? {data} : {})});
    if (this.logs.length > this.logLimit) this.logs.splice(0, this.logs.length - this.logLimit);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(id, state) {
    for (const listener of this.listeners) {
      try { listener(id, {...state}); } catch (error) { console.error('[PCM] Runtime listener failed', error); }
    }
  }
}
