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
    const count = Number(await lottery.getApostasCount());
    const start = Math.max(0, count - CURRENT_BET_SCAN_LIMIT);
    const bets = await Promise.all(Array.from({ length: count - start }, (_, offset) => lottery.apostasDaSemana(start + offset)));
    const normalizedWallet = wallet?.toLowerCase();
    const tickets = bets.map((bet, offset) => ({ index: start + offset, wallet: bet.jogador as string, mask: bet.mask as bigint, numbers: maskToNumbers(bet.mask as bigint) })).filter((ticket) => !normalizedWallet || ticket.wallet.toLowerCase() === normalizedWallet);
    const currentPlayers = new Set(bets.map((bet) => (bet.jogador as string).toLowerCase())).size;
    const claimable = wallet ? await lottery.premiosParaSacar(wallet) as bigint : undefined;
    return { currentBets: count, scannedBets: bets.length, currentPlayers, tickets, claimable };
  });
}

export async function readWinnerHistory(chain: ChainConfig): Promise<{ total: number; scanned: number; winners: WinnerRecord[] }> {
  if (!chain.contracts.lottery || chain.contracts.status !== 'verified') throw new Error(`${chain.name} is not verified.`);
  return new RpcManager(chain).request(async (provider) => {
    const lottery = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const total = Number(await lottery.getHistoricoCount());
    const start = Math.max(0, total - WINNER_HISTORY_LIMIT);
    const rows = await Promise.all(Array.from({ length: total - start }, (_, offset) => lottery.ultimosGanhadores(start + offset)));
    return { total, scanned: rows.length, winners: rows.map((row, offset) => ({ index: start + offset, wallet: row.carteira as string, amount: row.valor as bigint, timestamp: row.data as bigint, type: row.tipo as string, chain })) };
  });
}
