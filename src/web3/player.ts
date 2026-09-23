import { Contract } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig } from '../types';
import { RpcManager } from './rpc';

export const CURRENT_BET_SCAN_LIMIT = 500;
export const WINNER_HISTORY_LIMIT = 100;

export type CurrentTicket = { index: number; wallet: string; mask: bigint; numbers: number[] };
export type WinnerRecord = { index: number; wallet: string; amount: bigint; timestamp: bigint; type: string; chain: ChainConfig };
export type SelectedNetworkState = { currentBets: number; scannedBets: number; currentPlayers: number; tickets: CurrentTicket[]; claimable?: bigint; error?: string };

/** Verified source uses `mask |= 1 << num`, so bits 1–25 represent numbers 1–25. */
export const maskToNumbers = (mask: bigint) => Array.from({ length: 25 }, (_, index) => index + 1).filter((number) => (mask & (1n << BigInt(number))) !== 0n);

export async function readSelectedNetworkState(chain: ChainConfig, wallet?: string): Promise<SelectedNetworkState> {
  if (!chain.contracts.lottery || chain.contracts.status !== 'verified') throw new Error(`${chain.name} is not verified.`);
  return new RpcManager(chain).request(async (provider) => {
    const lottery = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const roundId = await lottery.currentRoundId() as bigint;
    const [round, nextTicketIndex] = await Promise.all([lottery.rounds(roundId), lottery.nextTicketIndex() as Promise<bigint>]);
    const count = Number(round.ticketCount);
    const ticketStart = Number(round.ticketStart) || Number(nextTicketIndex - BigInt(count));
    const start = Math.max(0, count - CURRENT_BET_SCAN_LIMIT);
    const bets = await Promise.all(Array.from({ length: count - start }, (_, offset) => lottery.tickets(ticketStart + start + offset)));
    const normalizedWallet = wallet?.toLowerCase();
    const tickets = bets.map((bet, offset) => ({ index: ticketStart + start + offset, wallet: bet.player as string, mask: bet.mask as bigint, numbers: maskToNumbers(bet.mask as bigint) })).filter((ticket) => !normalizedWallet || ticket.wallet.toLowerCase() === normalizedWallet);
    const currentPlayers = new Set(bets.map((bet) => (bet.player as string).toLowerCase())).size;
    const claimable = wallet ? (await Promise.all(tickets.map(async (ticket) => (await lottery.ticketEntitlement(roundId, ticket.index - ticketStart)).amount as bigint))).reduce((sum, amount) => sum + amount, 0n) : undefined;
    return { currentBets: count, scannedBets: bets.length, currentPlayers, tickets, claimable };
  });
}

export async function readWinnerHistory(chain: ChainConfig): Promise<{ total: number; scanned: number; winners: WinnerRecord[] }> {
  if (!chain.contracts.lottery || chain.contracts.status !== 'verified') throw new Error(`${chain.name} is not verified.`);
  // V2 has no lifetime winner-array getter. Historical records are shown only after an audited event start block is configured.
  return { total: 0, scanned: 0, winners: [] };
}
