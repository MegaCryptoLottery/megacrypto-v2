import { describe, expect, it } from 'vitest';
import { FreshnessRegistry } from './freshness';

describe('freshness registry', () => {
  it('rejects a late response from an older generation', () => {
    const registry = new FreshnessRegistry();
    const first = registry.begin('arbitrum', 1); const second = registry.begin('arbitrum', 2);
    expect(registry.success('arbitrum', first, 10, 3)).toBe(false);
    expect(registry.success('arbitrum', second, 11, 4)).toBe(true);
    expect(registry.get('arbitrum')).toMatchObject({ status: 'live', blockNumber: 11, lastSuccessfulUpdate: 4 });
  });
  it('marks a failed refresh stale only when a previous successful value exists', () => {
    const registry = new FreshnessRegistry(); const one = registry.begin('base', 1); registry.success('base', one, 100, 2);
    const two = registry.begin('base', 3); registry.failure('base', two, 'timeout', 4);
    expect(registry.get('base')).toMatchObject({ status: 'stale', lastSuccessfulUpdate: 2, error: 'timeout' });
  });
});
