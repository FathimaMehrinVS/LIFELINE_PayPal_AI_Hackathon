// Owner: Member 1. A small in-memory cache with an expiry and a size cap. Enough for one API instance;
// a restart simply empties it. Never use it as the only copy of anything.

export class TtlCache<K, V> {
  private readonly entries = new Map<K, { value: V; expires: number }>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 500) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
