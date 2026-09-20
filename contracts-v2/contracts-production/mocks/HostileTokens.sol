// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILotteryAttack { function buyTicket(uint32) external; function claim(uint256,uint256) external; }
contract TokenBase {
    uint8 public immutable decimals; mapping(address=>uint256) public balanceOf; mapping(address=>mapping(address=>uint256)) public allowance;
    constructor(uint8 d){decimals=d;} function mint(address a,uint256 n) external {balanceOf[a]+=n;} function approve(address s,uint256 n) external returns(bool){allowance[msg.sender][s]=n;return true;}
    function _spend(address f,address t,uint256 n) internal {require(allowance[f][msg.sender]>=n&&balanceOf[f]>=n,"ALLOWANCE");allowance[f][msg.sender]-=n;balanceOf[f]-=n;balanceOf[t]+=n;}
    function transfer(address t,uint256 n) public virtual returns(bool){require(balanceOf[msg.sender]>=n,"BAL");balanceOf[msg.sender]-=n;balanceOf[t]+=n;return true;}
    function transferFrom(address f,address t,uint256 n) external virtual returns(bool){_spend(f,t,n);return true;}
}
contract FeeToken is TokenBase { constructor(uint8 d)TokenBase(d){} function transferFrom(address f,address t,uint256 n) external override returns(bool){require(allowance[f][msg.sender]>=n&&balanceOf[f]>=n,"ALLOWANCE");allowance[f][msg.sender]-=n;balanceOf[f]-=n;balanceOf[t]+=n-1;return true;} }
contract FalseFromToken is TokenBase { constructor(uint8 d)TokenBase(d){} function transferFrom(address,address,uint256) external pure override returns(bool){return false;} }
contract FalseTransferToken is TokenBase { constructor(uint8 d)TokenBase(d){} function transfer(address,uint256) public pure override returns(bool){return false;} }
contract ReentrantToken is TokenBase { address public target; uint32 public mask; bool public attackBuy; bool public attackClaim; bool private entered; constructor(uint8 d)TokenBase(d){} function arm(address t,uint32 m,bool b,bool c) external {target=t;mask=m;attackBuy=b;attackClaim=c;} function transferFrom(address f,address t,uint256 n) external override returns(bool){if(attackBuy&&!entered){entered=true;try ILotteryAttack(target).buyTicket(mask){}catch{} entered=false;} _spend(f,t,n);return true;} function transfer(address t,uint256 n) public override returns(bool){if(attackClaim&&!entered){entered=true;try ILotteryAttack(target).claim(1,0){}catch{} entered=false;} return super.transfer(t,n);} }
contract DeltaToken is TokenBase { constructor(uint8 d)TokenBase(d){} function transferFrom(address f,address t,uint256 n) external override returns(bool){_spend(f,t,n);balanceOf[t]+=1;return true;} }
contract RejectRecipientToken is TokenBase { address public rejected; constructor(uint8 d)TokenBase(d){} function setRejected(address x) external {rejected=x;} function transfer(address t,uint256 n) public override returns(bool){if(t==rejected)return false;return super.transfer(t,n);} }
