import { ChainListener, ComputeRequestEvent } from './services/ChainListener';
import { AIProvider } from './services/AIProvider';
import { CallbackManager } from './services/CallbackManager';
import { config } from './config';
import logger from './utils/logger';
import { ethers } from 'ethers';

class BAP578Service {
  private listener: ChainListener;
  private aiProvider: AIProvider;
  private callbackManager: CallbackManager;
  private isRunning = false;
  private requestQueue: Map<string, boolean> = new Map();

  constructor() {
    this.listener = new ChainListener();
    this.aiProvider = new AIProvider();
    this.callbackManager = new CallbackManager();
  }

  async start(): Promise<void> {
    logger.info('🚀 Starting HodlAI BAP-578 Service...');
    logger.info(`   Gateway: ${config.contracts.hodlaiLogic}`);
    logger.info(`   Gas Wallet: ${this.callbackManager.getAddress()}`);

    // Check gas wallet balance on startup
    const hasGas = await this.callbackManager.checkGasBalance();
    if (!hasGas) {
      logger.warn('⚠️ Gas wallet has insufficient balance. Callbacks will fail.');
    }

    // Start listening for events
    await this.listener.start(this.handleComputeRequest.bind(this));
    this.isRunning = true;

    logger.info('✅ Service is running. Waiting for BAP-578 compute requests...');
  }

  private async handleComputeRequest(event: ComputeRequestEvent): Promise<void> {
    // Deduplication
    if (this.requestQueue.has(event.txHash)) {
      logger.warn({ txHash: event.txHash }, 'Duplicate request, skipping');
      return;
    }
    this.requestQueue.set(event.txHash, true);

    // Clean up old entries periodically
    if (this.requestQueue.size > 1000) {
      const keys = Array.from(this.requestQueue.keys()).slice(0, 500);
      keys.forEach(k => this.requestQueue.delete(k));
    }

    try {
      // Decode the prompt
      const prompt = this.decodePrompt(event.data);
      logger.info({
        agent: event.agentContract,
        tokenId: event.tokenId.toString(),
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      }, 'Processing compute request');

      // Call AI provider
      const startTime = Date.now();
      const aiResponse = await this.aiProvider.generate({
        prompt,
        model: config.aiProvider.defaultModel,
      });
      const duration = Date.now() - startTime;

      logger.info({
        model: aiResponse.model,
        duration: `${duration}ms`,
        tokens: aiResponse.usage?.total_tokens,
      }, 'AI response generated');

      // Send callback to chain
      const requestId = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'uint256', 'bytes', 'uint256', 'uint256'],
          [
            event.agentContract,
            event.tokenId,
            event.data,
            event.timestamp,
            event.blockNumber,
          ]
        )
      );

      await this.callbackManager.sendCallback({
        agentContract: event.agentContract,
        tokenId: event.tokenId,
        requestId,
        result: aiResponse.content,
      });

    } catch (error: any) {
      logger.error({
        error: error.message,
        agent: event.agentContract,
        tokenId: event.tokenId.toString(),
      }, 'Failed to process compute request');
    }
  }

  private decodePrompt(data: string): string {
    try {
      const bytes = ethers.getBytes(data);
      return new TextDecoder().decode(bytes);
    } catch {
      return data;
    }
  }

  async stop(): Promise<void> {
    logger.info('Shutting down...');
    this.isRunning = false;
    await this.listener.stop();
    process.exit(0);
  }
}

// Main
const service = new BAP578Service();

// Handle graceful shutdown
process.on('SIGINT', () => service.stop());
process.on('SIGTERM', () => service.stop());

// Start
service.start().catch((error) => {
  logger.error({ error }, 'Failed to start service');
  process.exit(1);
});