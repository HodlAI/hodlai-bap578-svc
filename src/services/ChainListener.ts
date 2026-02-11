import { ethers } from 'ethers';
import { config } from '../config';
import HodlAILogicABI from '../abis/HodlAILogic.json';
import logger from '../utils/logger';

export interface ComputeRequestEvent {
  agentContract: string;
  tokenId: bigint;
  owner: string;
  data: string;
  estimatedCredits: bigint;
  timestamp: bigint;
  blockNumber: number;
  txHash: string;
}

export class ChainListener {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private isRunning = false;
  private callback?: (event: ComputeRequestEvent) => void;

  constructor() {
    this.provider = new ethers.WebSocketProvider(config.bscWsUrl);
    
    if (!config.contracts.hodlaiLogic) {
      throw new Error('HODLAI_LOGIC address not configured');
    }
    
    this.contract = new ethers.Contract(
      config.contracts.hodlaiLogic,
      HodlAILogicABI,
      this.provider
    );
  }

  async start(onComputeRequest: (event: ComputeRequestEvent) => void): Promise<void> {
    if (this.isRunning) {
      logger.warn('ChainListener already running');
      return;
    }

    this.callback = onComputeRequest;
    this.isRunning = true;

    logger.info('🔍 Starting BAP-578 event listener...');
    logger.info(`   Contract: ${config.contracts.hodlaiLogic}`);
    logger.info(`   RPC: ${config.bscWsUrl}`);

    // Listen for AgentComputeRequest events
    this.contract.on(
      'AgentComputeRequest',
      (
        agentContract: string,
        tokenId: bigint,
        owner: string,
        data: string,
        estimatedCredits: bigint,
        timestamp: bigint,
        event: ethers.EventLog
      ) => {
        const computeEvent: ComputeRequestEvent = {
          agentContract,
          tokenId,
          owner,
          data,
          estimatedCredits,
          timestamp,
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
        };

        logger.info({
          event: 'AgentComputeRequest',
          agent: agentContract,
          tokenId: tokenId.toString(),
          estimatedCredits: estimatedCredits.toString(),
          txHash: event.transactionHash,
        });

        this.callback?.(computeEvent);
      }
    );

    // Handle reconnections
    this.provider.on('error', (error) => {
      logger.error({ error }, 'WebSocket error');
    });

    this.provider.on('close', () => {
      logger.warn('WebSocket closed, attempting reconnect...');
      this.reconnect();
    });
  }

  private async reconnect(): Promise<void> {
    if (!this.isRunning) return;
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      this.provider = new ethers.WebSocketProvider(config.bscWsUrl);
      this.contract = new ethers.Contract(
        config.contracts.hodlaiLogic,
        HodlAILogicABI,
        this.provider
      );
      
      if (this.callback) {
        await this.start(this.callback);
      }
      
      logger.info('✅ Reconnected to BSC');
    } catch (error) {
      logger.error({ error }, 'Reconnection failed');
      this.reconnect();
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.provider.destroy();
    logger.info('ChainListener stopped');
  }

  getContract(): ethers.Contract {
    return this.contract;
  }
}