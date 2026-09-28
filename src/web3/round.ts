export type RoundLifecycle = { label: string; detail: string };

/** The contract state and its latest checkUpkeep action are authoritative. */
export function roundLifecycle(state: number | undefined, cutoff: Date | undefined, upkeepAction: string | undefined, now = Date.now()): RoundLifecycle {
  if (state === undefined) return { label: 'LOADING', detail: 'Checking live contract state' };
  if (state === 0 && cutoff && cutoff.getTime() > now) return { label: 'AVAILABLE TO PLAY', detail: 'Ticket sales are open' };
  if (state === 0) return { label: 'DRAW PROCESSING', detail: upkeepAction ? `Waiting for ${upkeepAction}` : 'Ticket sales are closed' };
  if (state === 1) return { label: 'DRAW PROCESSING', detail: upkeepAction === 'REQUEST' ? 'Waiting for randomness request' : 'Round is closed' };
  if (state === 2) return { label: 'WAITING FOR RANDOMNESS', detail: 'Randomness request is pending' };
  if (state === 3 || state === 4) return { label: 'CALCULATING WINNERS', detail: upkeepAction ? `Waiting for ${upkeepAction}` : 'Settlement is in progress' };
  if (state === 5) return { label: 'NEXT ROUND OPENING', detail: upkeepAction ? `Waiting for ${upkeepAction}` : 'Round is complete' };
  return { label: 'UNAVAILABLE', detail: 'This round is not accepting tickets' };
}

export function cutoffCountdown(cutoff?: Date, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor(((cutoff?.getTime() ?? now) - now) / 1000));
  const values = [Math.floor(seconds / 86_400), Math.floor(seconds / 3_600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  return values.map((value) => String(value).padStart(2, '0')).join(' : ');
}
