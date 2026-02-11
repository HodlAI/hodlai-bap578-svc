import { ethers } from 'ethers';
import { config } from '../config';
import HodlAILogicABI from '../abis/HodlAILogic.json';
import logger from '../utils/logger';

export interface CallbackData {
  agentContract: string;
  tokenId: bigint;
  requestId: string;
  result: string;
}

export class CallbackManager {
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private nonce: number | null = null;

  constructor() {
    if (!config.gasWallet.privateKey) {
      throw new Error('GAS_WALLET_PK not configured');
    }

    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    this.wallet = new ethers.Wallet(config.gasWallet.privateKey, provider);
    
    if (!config.contracts.hodlaiLogic) {
      throw new Error('HODLAI_LOGIC address not configured');
    }
    
    this.contract = new ethers.Contract(
      config.contracts.hodlaiLogic,
      HodlAILogicABI,
      this.wallet
    );
  }

  async checkGasBalance(): Promise<boolean> {
    const balance = await this.wallet.provider!.getBalance(this.wallet.address);
    const minBalance = ethers.parseEther(config.gasWallet.minBalance);
    
    const hasEnough = balance >= minBalance;
    
    if (!hasEnough) {
      logger.error({
        address: this.wallet.address,
        balance: ethers.formatEther(balance),
        required: config.gasWallet.minBalance,
      }, '❌ Gas wallet balance too low');
    } else {
      logger.debug({
        address: this.wallet.address,
        balance: ethers.formatEther(balance),
      }, 'Gas wallet balance OK');
    }
    
    return hasEnough;
  }

  async sendCallback(data: CallbackData): Promise<string> {
    // Validate gas balance
    const hasGas = await this.checkGasBalance();
    if (!hasGas) {
      throw new Error('INSUFFICIENT_GAS');
    }

    // Encode result as bytes
    const resultBytes = ethers.toUtf8Bytes(data.result);

    logger.info({
      agent: data.agentContract,
      tokenId: data.tokenId.toString(),
      requestId: data.requestId,
    }, 'Sending callback to chain...');

    try {
      const tx = await this.contract.onActionExecuted(
        data.agentContract,
        data.tokenId,
        data.requestId,
        resultBytes,
        {
          gasLimit: 500000, // Adjust based on actual usage
        }
      );

      logger.info({ txHash: tx.hash }, 'Callback transaction sent');

      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        logger.info({
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        }, '✅ Callback confirmed');
        return receipt.hash;
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      logger.error({
        error: error.message,
        agent: data.agentContract,
        tokenId: data.tokenId.toString(),
      }, 'Callback failed');
      throw error;
    }
  }

  getAddress(): string {
    return this.wallet.address;
  }
}