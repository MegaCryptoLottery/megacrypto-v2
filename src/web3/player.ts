import { Contract } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig } from '../types';
import { RpcManager } from './rpc';

export const CURRENT_BET_SCAN_LIMIT = 500;
export const WINNER_HISTORY_LIMIT = 100;

export type CurrentTicket = { roundId: bigint; offset: number; index: number; wallet: string; mask: bigint; numbers: number[]; state: number; winningMask: bigint; winningNumbers: number[]; score: number; finalist: boolean; amount: bigint; claimed: boolean };
export type WinnerRecord = { index: number; wallet: string; amount: bigint; timestamp: bigint; type: string; chain: ChainConfig };
export type ClaimableTicket = CurrentTicket;
export type SelectedNetworkState = { currentBets: number; scannedBets: number; currentPlayers: number; tickets: CurrentTicket[]; claimable?: bigint; claimableTickets: ClaimableTicket[]; error?: string };

/** Verified source uses `mask |= 1 << num`, so bits 1–25 represent numbers 1–25. */
export const maskToNumbers = (mask: bigint) => Array.from({ length: 25 }, (_, index) => index + 1).filter((number) => (mask & (1n << BigInt(number))) !== 0n);

export async function readSelectedNetworkState(chain: ChainConfig, wallet?: string): Promise<SelectedNetworkState> {
  if (!chain.contracts.lottery || chain.contracts.status !== 'verified') throw new Error(`${chain.name} is not verified.`);
  return new RpcManager(chain).request(async (provider) => {
    const lottery = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const roundId = await lottery.currentRoundId() as bigint;
    const [currentRound, nextTicketIndex] = await Promise.all([lottery.rounds(roundId), lottery.nextTicketIndex() as Promise<bigint>]);
    const count = Number(currentRound.ticketCount);
    const ticketStart = Number(currentRound.ticketStart) || Number(nextTicketIndex - BigInt(count));
    const start = Math.max(0, count - CURRENT_BET_SCAN_LIMIT);
    const bets = await Promise.all(Array.from({ length: count - start }, (_, offset) => lottery.tickets(ticketStart + start + offset)));
    const normalizedWallet = wallet?.toLowerCase();
    const currentTickets = bets.map((bet, offset) => ({ index: ticketStart + start + offset, wallet: bet.player as string, mask: bet.mask as bigint })).filter((ticket) => !normalizedWallet || ticket.wallet.toLowerCase() === normalizedWallet);
    const currentPlayers = new Set(bets.map((bet) => (bet.player as string).toLowerCase())).size;
    const firstRound = wallet ? (roundId > BigInt(WINNER_HISTORY_LIMIT) ? roundId - BigInt(WINNER_HISTORY_LIMIT) + 1n : 1n) : roundId;
    const historicalRoundIds = Array.from({ length: Number(roundId - firstRound + 1n) }, (_, index) => firstRound + BigInt(index));
    const rounds = await Promise.all(historicalRoundIds.map(async (id) => [id, id === roundId ? currentRound : await lottery.rounds(id)] as const));
    const historicalTickets = wallet ? (await Promise.all(rounds.map(async ([id, round]) => {
      const ticketCount = Number(round.ticketCount);
      const roundStart = Number(round.ticketStart);
      const scanStart = Math.max(0, ticketCount - CURRENT_BET_SCAN_LIMIT);
      const values = await Promise.all(Array.from({ length: ticketCount - scanStart }, async (_, offset) => {
        const ticketOffset = scanStart + offset;
        const ticket = await lottery.tickets(roundStart + ticketOffset);
        if ((ticket.player as string).toLowerCase() !== normalizedWallet) return undefined;
        const [entitlement, claimed] = await Promise.all([lottery.ticketEntitlement(id, ticketOffset), lottery.ticketClaimed(id, ticketOffset) as Promise<boolean>]);
        const mask = ticket.mask as bigint;
        const winningMask = round.winningMask as bigint;
        return { roundId: id, offset: ticketOffset, index: roundStart + ticketOffset, wallet: ticket.player as string, mask, numbers: maskToNumbers(mask), state: Number(round.state), winningMask, winningNumbers: maskToNumbers(winningMask), score: Number(entitlement.score), finalist: entitlement.winner as boolean, amount: entitlement.amount as bigint, claimed: (entitlement.claimed as boolean) || claimed };
      }));
      return values.filter((ticket): ticket is CurrentTicket => ticket !== undefined);
    }))).flat() : currentTickets.map((ticket) => ({ roundId, offset: ticket.index - ticketStart, ...ticket, numbers: maskToNumbers(ticket.mask), state: Number(currentRound.state), winningMask: currentRound.winningMask as bigint, winningNumbers: maskToNumbers(currentRound.winningMask as bigint), score: 0, finalist: false, amount: 0n, claimed: false }));
    const tickets = historicalTickets.sort((left, right) => Number(right.roundId - left.roundId) || left.offset - right.offset);
    const claimableTickets = tickets.filter((ticket): ticket is ClaimableTicket => ticket.finalist && ticket.amount > 0n && !ticket.claimed);
    const claimable = wallet ? claimableTickets.reduce((sum, ticket) => sum + ticket.amount, 0n) : undefined;
    return { currentBets: count, scannedBets: wallet ? tickets.length : bets.length, currentPlayers, tickets, claimable, claimableTickets };
  });
}

export async function readWinnerHistory(chain: ChainConfig): Promise<{ total: number; scanned: number; winners: WinnerRecord[] }> {
  if (!chain.contracts.lottery || chain.contracts.status !== 'verified') throw new Error(`${chain.name} is not verified.`);
  // V2 has no lifetime winner-array getter. Historical records are shown only after an audited event start block is configured.
  return { total: 0, scanned: 0, winners: [] };
}
