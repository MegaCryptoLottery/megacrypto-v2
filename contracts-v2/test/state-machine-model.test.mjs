import assert from 'node:assert/strict';

// Fast model-level fuzzer: mirrors the permitted lifecycle edges and checks that
// random hostile action sequences never create an impossible transition.
const edges = {
  OPEN: new Set(['buy', 'close', 'pause']),
  CLOSED: new Set(['request', 'pause']),
  VRF_REQUESTED: new Set(['fulfill', 'manual', 'pause']),
  VRF_RECEIVED: new Set(['settle', 'pause']),
  SETTLEMENT: new Set(['settle', 'pause']),
  COMPLETED: new Set(['openNext', 'claim', 'proposeMigration', 'pause']),
  EMERGENCY: new Set(['settle', 'pause'])
};
const actions = ['buy', 'close', 'request', 'fulfill', 'manual', 'settle', 'openNext', 'claim', 'pause', 'unpause', 'proposeMigration', 'cancelMigration', 'executeMigration'];
describe('state-machine model fuzzer', () => {
  it('runs 1,000 randomized hostile sequences without illegal state edges', () => {
    let seed = 0xC0FFEE;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
    for (let run = 0; run < 1000; run++) {
      let state = 'OPEN'; let paused = false; let migrated = false; let requestId = 0; let ticketCount = 0;
      for (let step = 0; step < 80; step++) {
        const action = actions[random() % actions.length]; const before = state;
        if (action === 'unpause') { paused = false; continue; }
        if (action === 'pause') { paused = true; continue; }
        if (paused || migrated || !edges[state].has(action)) { assert.equal(state, before); continue; }
        if (action === 'buy') ticketCount++;
        if (action === 'close') { if (ticketCount) state = 'CLOSED'; else state = 'COMPLETED'; }
        if (action === 'request') { assert.equal(requestId, 0); requestId = 1; state = 'VRF_REQUESTED'; }
        if (action === 'fulfill' || action === 'manual') { assert.ok(requestId > 0); state = 'VRF_RECEIVED'; }
        if (action === 'settle') state = state === 'VRF_RECEIVED' ? 'SETTLEMENT' : 'COMPLETED';
        if (action === 'openNext') { assert.equal(state, 'COMPLETED'); state = 'OPEN'; ticketCount = 0; requestId = 0; }
        if (action === 'executeMigration' && state === 'COMPLETED') migrated = true;
        assert.ok(['OPEN', 'CLOSED', 'VRF_REQUESTED', 'VRF_RECEIVED', 'SETTLEMENT', 'COMPLETED', 'EMERGENCY'].includes(state));
      }
    }
  });
});

