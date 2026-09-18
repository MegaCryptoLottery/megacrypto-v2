import { ethers } from 'ethers';
import { AMOY, assertDryRun, candidateArtifact, frozen, hash, mockArtifact } from './amoy-config.mjs';

assertDryRun();
const mock = mockArtifact(); const lottery = candidateArtifact();
const mockFactory = new ethers.ContractFactory(mock.abi, mock.evm.bytecode.object);
const lotteryFactory = new ethers.ContractFactory(lottery.abi, lottery.evm.bytecode.object);
const mockDeployment = await mockFactory.getDeployTransaction();
const output = { mode: 'DRY_RUN_ONLY', network: AMOY, mockUsdtDeploymentData: mockDeployment.data, lotteryDeployment: 'PENDING: MockUSDT address, subscription ID, ticket price, round duration, and emergency authority must be decided before calldata can be generated.', frozenHashes: frozen, candidateArtifactHashes: { abi: hash(JSON.stringify(lottery.abi)), creation: hash(lottery.evm.bytecode.object), runtime: hash(lottery.evm.deployedBytecode.object) } };
console.log(JSON.stringify(output, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));

