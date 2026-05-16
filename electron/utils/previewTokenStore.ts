/**
 * Bounded TTL store for media-preview tokens.
 *
 * Each entry maps a one-shot token to an absolute file path. Without bounds
 * the underlying Map grew unboundedly across a session (every preview call
 * inserted; only explicit revoke removed) and stale tokens served file bytes
 * forever — both a memory-DoS and a stale-disclosure surface.
 *
 * Bound: MAX_ENTRIES (evicts oldest). TTL: TTL_MS from last use; protocol
 * fetches refresh the timestamp.
 */
type PreviewEntry = {
  filePath: string;
  expiresAt: number;
  onEvict?: (filePath: string) => void;
};

export type PreviewTokenStoreOptions = {
  maxEntries?: number;
  ttlMs?: number;
};

export class PreviewTokenStore {
  private readonly entries = new Map<string, PreviewEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options: PreviewTokenStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? 64;
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000;
  }

  set(token: string, filePath: string, onEvict?: (filePath: string) => void): void {
    this.purgeExpired();
    if (this.entries.has(token)) this.entries.delete(token);
    this.entries.set(token, {
      filePath,
      expiresAt: Date.now() + this.ttlMs,
      onEvict,
    });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.evict(oldestKey);
    }
  }

  get(token: string): string | undefined {
    const entry = this.entries.get(token);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.evict(token);
      return undefined;
    }
    // Refresh TTL on use so an actively-watched preview is not yanked
    // mid-playback.
    entry.expiresAt = Date.now() + this.ttlMs;
    this.entries.delete(token);
    this.entries.set(token, entry);
    return entry.filePath;
  }

  delete(token: string): boolean {
    const entry = this.entries.get(token);
    if (!entry) return false;
    this.entries.delete(token);
    entry.onEvict?.(entry.filePath);
    return true;
  }

  clear(): void {
    for (const token of [...this.entries.keys()]) {
      this.evict(token);
    }
  }

  private evict(token: string): void {
    const entry = this.entries.get(token);
    if (!entry) return;
    this.entries.delete(token);
    entry.onEvict?.(entry.filePath);
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [token, entry] of this.entries) {
      if (entry.expiresAt <= now) this.evict(token);
    }
  }
}
