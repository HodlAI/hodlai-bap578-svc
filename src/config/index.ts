import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // BNB Chain RPC
  bscRpcUrl: process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com',
  bscWsUrl: process.env.BSC_WS_URL || 'wss://bsc-rpc.publicnode.com/wss',
  
  // Contract Addresses
  contracts: {
    hodlaiToken: process.env.HODLAI_TOKEN || '0x987e6269c6b7ea6898221882f11ea16f87b97777',
    hodlaiLogic: process.env.HODLAI_LOGIC || '', // Fill after deployment
  },
  
  // Gas Wallet (for callbacks)
  gasWallet: {
    privateKey: process.env.GAS_WALLET_PK || '',
    minBalance: process.env.MIN_GAS_BALANCE || '0.01', // BNB
  },
  
  // AI Provider
  aiProvider: {
    upstreamUrl: process.env.UPSTREAM_URL || 'https://api.hodlai.fun/v1',
    apiKey: process.env.UPSTREAM_KEY || '',
    defaultModel: process.env.DEFAULT_MODEL || 'claude-3-5-sonnet',
    maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
  },
  
  // Rate Limiting
  rateLimit: {
    maxRequestsPerMinute: parseInt(process.env.MAX_RPM || '100'),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '10'),
  },
  
  // Quota Calculation
  quota: {
    // credits_per_token_per_hour = (1e18 * $1/day) / (24 hours * $price_per_token * token_amount)
    // At $0.0024/HODLAI: $10 = ~4167 tokens = $1/day = ~17 credits/hour
    creditsPerTokenPerHour: BigInt(process.env.CREDITS_RATE || '173000000000000'), // ~0.000173
  },
  
  // Service
  service: {
    logLevel: process.env.LOG_LEVEL || 'info',
    port: parseInt(process.env.PORT || '3002'),
  },
};

// Validation
if (!config.contracts.hodlaiLogic) {
  console.warn('⚠️ HODLAI_LOGIC address not set. Please deploy contract and update env.');
}

if (!config.gasWallet.privateKey) {
  console.warn('⚠️ GAS_WALLET_PK not set. Callbacks will fail.');
}