import { Contract, type TransactionRequest } from 'ethers';
import { ERC20_ABI, LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig } from '../types';
export interface TransactionReview { kind: 'approval' | 'ticket'; network: string; contract: string; token: string; decimals: number; amount: bigint; gas?: bigint; request: TransactionRequest }
export async function prepareTicketPurchase(chain: ChainConfig, provider: ReturnType<NonNullable<import('./wallet').WalletController['getProvider']>>, numbers: number[]): Promise<TransactionReview> {
  if (!provider || !chain.contracts.lottery || chain.contracts.status !== 'verified') throw new Error('This lottery deployment is unavailable until it is verified.');
  if (numbers.length !== 15 || new Set(numbers).size !== 15 || numbers.some(n => !Number.isInteger(n) || n < 1 || n > 25)) throw new Error('Select exactly 15 unique numbers from 1 to 25.');
  const signer = await provider.getSigner(); const lottery = new Contract(chain.contracts.lottery, LOTTERY_ABI, signer); const token = new Contract(chain.contracts.token!, ERC20_ABI, signer);
  const address = await signer.getAddress(); const amount: bigint = await lottery.precoBilhete(); const allowance: bigint = await token.allowance(address, chain.contracts.lottery);
  const approvalNeeded = allowance < amount;
  const request = approvalNeeded ? await token.approve.populateTransaction(chain.contracts.lottery, amount) : await lottery.comprarBilhete.populateTransaction([...numbers].sort((a,b) => a-b));
  const gas = await signer.estimateGas(request);
  return { kind: approvalNeeded ? 'approval' : 'ticket', network: chain.name, contract: approvalNeeded ? chain.contracts.token! : chain.contracts.lottery, token: chain.contracts.tokenSymbol, decimals: chain.contracts.tokenDecimals, amount, gas, request };
}
export async function submitReviewed(provider: NonNullable<ReturnType<import('./wallet').WalletController['getProvider']>>, request: TransactionRequest) { const tx = await (await provider.getSigner()).sendTransaction(request); return tx.wait(); }
export const friendlyError = (error: unknown) => { const message = error instanceof Error ? error.message : 'Unknown wallet error'; if (/user rejected|denied/i.test(message)) return 'Transaction cancelled in wallet.'; if (/insufficient funds/i.test(message)) return 'Insufficient funds for this transaction and network fee.'; if (/wrong network|chain/i.test(message)) return 'Please switch to the selected supported network.'; return message; };
