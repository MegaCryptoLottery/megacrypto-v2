export type Freshness = { lastAttempt: number; lastSuccessfulUpdate?: number; blockNumber?: number; status: 'loading' | 'live' | 'stale' | 'error'; error?: string };

/** Per-key state prevents a failed or older response from being presented as live. */
export class FreshnessRegistry {
  private readonly entries = new Map<string, Freshness>();
  private readonly generations = new Map<string, number>();
  begin(key: string, now = Date.now()) { const generation = (this.generations.get(key) ?? 0) + 1; this.generations.set(key, generation); this.entries.set(key, { ...this.entries.get(key), lastAttempt: now, status: 'loading' }); return generation; }
  success(key: string, generation: number, blockNumber?: number, now = Date.now()) { if (this.generations.get(key) !== generation) return false; this.entries.set(key, { lastAttempt: now, lastSuccessfulUpdate: now, blockNumber, status: 'live' }); return true; }
  failure(key: string, generation: number, error: string, now = Date.now()) { if (this.generations.get(key) !== generation) return false; const previous = this.entries.get(key); this.entries.set(key, { lastAttempt: now, lastSuccessfulUpdate: previous?.lastSuccessfulUpdate, blockNumber: previous?.blockNumber, status: previous?.lastSuccessfulUpdate ? 'stale' : 'error', error }); return true; }
  get(key: string) { return this.entries.get(key); }
}
