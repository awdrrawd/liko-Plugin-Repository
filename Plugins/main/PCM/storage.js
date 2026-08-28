export class JsonStorage {
  constructor(backend = localStorage, onError = null) {
    this.backend = backend;
    this.onError = onError;
  }

  read(key, fallback = null) {
    try {
      const raw = this.backend.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      this.onError?.('read', key, error);
      return fallback;
    }
  }

  write(key, value) {
    try {
      this.backend.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      this.onError?.('write', key, error);
      return false;
    }
  }

  remove(key) {
    try {
      this.backend.removeItem(key);
      return true;
    } catch (error) {
      this.onError?.('remove', key, error);
      return false;
    }
  }

  consume(key, fallback = null) {
    const value = this.read(key, fallback);
    this.remove(key);
    return value;
  }
}

export class DebouncedDocumentStore {
  constructor(storage, key, delayMs = 100) {
    this.storage = storage;
    this.key = key;
    this.delayMs = delayMs;
    this.timer = null;
  }

  read(fallback = {}) {
    const value = this.storage.read(this.key, fallback);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  }

  write(value) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.storage.write(this.key, value), this.delayMs);
  }

  flush(value) {
    clearTimeout(this.timer);
    this.timer = null;
    return this.storage.write(this.key, value);
  }
}
