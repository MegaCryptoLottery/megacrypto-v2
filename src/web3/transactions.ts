import { Contract, formatUnits, type TransactionRequest } from 'ethers';
import { ERC20_ABI, LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig } from '../types';
import type { WalletController } from './wallet';

type WalletProvider = NonNullable<ReturnType<WalletController['getProvider']>>;

export interface TransactionReview {
  kind: 'approval' | 'ticket'; network: string; chainId: number; wallet: string; contract: string; lottery: string;
  token: string; tokenAddress: string; decimals: number; amount: bigint; balance: bigint; numbers: number[];
  allowance: bigint; gas: bigint; gasLimit: bigint; explorer: string; request: TransactionRequest;
}

export class InsufficientUsdtBalanceError extends Error {
  constructor(readonly network: string, readonly required: bigint, readonly available: bigint, readonly decimals: number) {
    super(`Insufficient USDT balance. Required: ${formatTokenAmount(required, decimals)} USDT. Available: ${formatTokenAmount(available, decimals)} USDT. Network: ${network}.`);
    this.name = 'InsufficientUsdtBalanceError';
  }
}

export const formatTokenAmount = (amount: bigint, decimals: number) => {
  const [whole, fraction = ''] = formatUnits(amount, decimals).split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
};

export const validateTicketNumbers = (numbers: number[]) => {
  if (numbers.length !== 15 || new Set(numbers).size !== 15 || numbers.some((number) => !Number.isInteger(number) || number < 1 || number > 25)) throw new Error('Select exactly 15 unique numbers from 1 to 25.');
  return [...numbers].sort((left, right) => left - right);
};

export const decidePurchaseAction = (amount: bigint, balance: bigint, allowance: bigint, chain: Pick<ChainConfig, 'name' | 'contracts'>) => {
  if (balance < amount) throw new InsufficientUsdtBalanceError(chain.name, amount, balance, chain.contracts.tokenDecimals);
  return allowance < amount ? 'approval' as const : 'ticket' as const;
};

export const assertPreparationNetwork = (connectedChainId: number, chain: Pick<ChainConfig, 'chainId' | 'name'>) => {
  if (connectedChainId !== chain.chainId) throw new Error(`Wallet network does not match ${chain.name}. Switch network, then review again.`);
};

/** Reads, simulates, and prepares a review only. It never signs or broadcasts. */
export async function prepareTicketPurchase(chain: ChainConfig, provider: WalletProvider | undefined, numbers: number[]): Promise<TransactionReview> {
  if (!provider || !chain.contracts.lottery || !chain.contracts.token || chain.contracts.status !== 'verified') throw new Error('This lottery deployment is unavailable until it is verified.');
  const normalizedNumbers = validateTicketNumbers(numbers);
  const connectedNetwork = await provider.getNetwork();
  assertPreparationNetwork(Number(connectedNetwork.chainId), chain);
  const signer = await provider.getSigner();
  const wallet = await signer.getAddress();
  if (!wallet) throw new Error('A connected wallet address is required before reviewing a ticket.');
  const lottery = new Contract(chain.contracts.lottery, LOTTERY_ABI, signer);
  const token = new Contract(chain.contracts.token, ERC20_ABI, signer);
  const [amount, balance, allowance] = await Promise.all([lottery.precoBilhete() as Promise<bigint>, token.balanceOf(wallet) as Promise<bigint>, token.allowance(wallet, chain.contracts.lottery) as Promise<bigint>]);
  const kind = decidePurchaseAction(amount, balance, allowance, chain);
  const request = kind === 'approval' ? await token.approve.populateTransaction(chain.contracts.lottery, amount) : await lottery.comprarBilhete.populateTransaction(normalizedNumbers);
  const gas = await signer.estimateGas(request);
  const gasLimit = gas + gas / 5n;
  return { kind, network: chain.name, chainId: chain.chainId, wallet, contract: kind === 'approval' ? chain.contracts.token : chain.contracts.lottery, lottery: chain.contracts.lottery, token: chain.contracts.tokenSymbol, tokenAddress: chain.contracts.token, decimals: chain.contracts.tokenDecimals, amount, balance, numbers: normalizedNumbers, allowance, gas, gasLimit, explorer: chain.explorer, request: { ...request, gasLimit } };
}

/** The only broadcast boundary, used only after the explicit review confirmation. */
export async function submitReviewed(provider: WalletProvider, review: TransactionReview) {
  const [network, signer] = await Promise.all([provider.getNetwork(), provider.getSigner()]);
  if (Number(network.chainId) !== review.chainId) throw new Error(`Wallet network changed. Switch to ${review.network} and review again.`);
  if ((await signer.getAddress()).toLowerCase() !== review.wallet.toLowerCase()) throw new Error('Wallet account changed. Review the transaction again.');
  const tx = await signer.sendTransaction(review.request);
  return tx.wait();
}

export const friendlyError = (error: unknown) => { if (error instanceof InsufficientUsdtBalanceError) return error.message; const message = error instanceof Error ? error.message : 'Unknown wallet error'; if (/user rejected|denied/i.test(message)) return 'Transaction cancelled in wallet.'; if (/insufficient funds/i.test(message)) return 'Insufficient funds for this transaction and network fee.'; if (/wrong network|chain|network does not match/i.test(message)) return 'Please switch to the selected supported network.'; return message; };
