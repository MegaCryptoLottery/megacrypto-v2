// Minimal read/write surface. Replace only after matching it against the deployed, verified ABI.
export const LOTTERY_ABI = [
  'function comprarBilhete(uint8[] numeros) external', 'function jackpotAcumulado() view returns (uint256)', 'function poolSemanal() view returns (uint256)',
  'function precoBilhete() view returns (uint256)', 'function premiosParaSacar(address) view returns (uint256)', 'function reclamarPremio() external',
  'function getApostasCount() view returns (uint256)', 'function apostasDaSemana(uint256) view returns (address jogador,uint256 mask)',
  'function getHistoricoCount() view returns (uint256)', 'function ultimosGanhadores(uint256) view returns (address carteira,uint256 valor,uint256 data,string tipo)',
  'event SorteioSolicitado(uint256 indexed requestId)', 'event SorteioRealizado(uint256 indexed requestId,uint256 maskSorteada)', 'event BilheteComprado(address indexed jogador,uint256 quantidadeApostas)'
] as const;
export const ERC20_ABI = ['function approve(address spender,uint256 amount) returns (bool)', 'function allowance(address owner,address spender) view returns (uint256)', 'function balanceOf(address account) view returns (uint256)'] as const;
