# HodlAI BAP-578 Gateway Service

Event listener and compute provider for BAP-578 Non-Fungible Agents (NFAs) on BNB Chain.

## Overview

This service listens for `AgentComputeRequest` events from BAP-578 agents via the HodlAILogic contract, processes AI computation requests, and writes results back to the blockchain.

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ BAP-578 NFA  │────▶│ hodlai-bap578-svc   │────▶│ AI Provider  │
│   Contract   │     │ (Event Listener)    │     │(Claude/GPT)  │
└──────────────┘     └─────────────────────┘     └──────────────┘
                              │                            │
                              ▼                            ▼
                       ┌──────────────┐           ┌──────────────┐
                       │   Callback   │◀──────────│    Result    │
                       │  (Gas Wallet)│           │              │
                       └──────────────┘           └──────────────┘
```

## Deployment

**Contract Addresses (BNB Chain Mainnet):**
- **HodlAILogic**: `0x6068279Cc74Fb170794012ED73363De6De818294`
- **HODLAI Token**: `0x987e6269c6b7ea6898221882f11ea16f87b97777`

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required configuration:
- `HODLAI_LOGIC`: Address of deployed HodlAILogic contract
- `GAS_WALLET_PK`: Private key of hot wallet for callback gas
- `UPSTREAM_KEY`: HodlAI API key for AI computation

### 3. Run the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Architecture

### ChainListener
- WebSocket connection to BNB Chain
- Listens for `AgentComputeRequest` events from HodlAILogic
- Automatic reconnection handling

### AIProvider
- Calls upstream AI provider (HodlAI Gateway or OpenAI-compatible)
- Decodes prompts from BAP-578 event data
- Handles rate limiting and retries

### CallbackManager
- Manages hot wallet for on-chain callbacks
- Sends `onActionExecuted` transactions
- Gas balance monitoring

## Cost Model

### Gas Costs
Each callback transaction costs ~0.0005-0.001 BNB in gas.

Example:
- 100 requests/day = ~0.05-0.1 BNB/day
- Monthly cost: ~1.5-3 BNB (at $600/BNB = $900-1800/month)

This cost is covered by the service operator (not deducted from agent).

### Service Economics
The service operator pays:
1. **AI compute**: Paid via `UPSTREAM_KEY` (HodlAI credits or OpenAI API)
2. **Gas fees**: BNB for callback transactions

Revenue should come from:
- Agent developers paying subscription
- % fee on agent transactions
- Treasury grants

## Request Flow

```
1. User calls BAP-578 Agent.executeAction(tokenId, promptData)
   ↓
2. HodlAILogic.executeAction()
   - Checks agent HODLAI balance
   - Emits AgentComputeRequest event
   ↓
3. This service detects event
   - Decode prompt from event.data
   - Call AI provider
   ↓
4. AI Provider returns result
   ↓
5. CallbackManager sends onActionExecuted()
   - encode result as bytes
   - submit transaction via gas wallet
   ↓
6. On-chain event ActionExecuted emitted
   - Agent can read final result
```

## BAP-578 Contract Addresses (BNB Chain)

| Contract | Address |
|----------|---------|
| BAP-578 NFA Factory | `0xf2954d349D7FF9E0d4322d750c7c2921b0445fdf` |
| ERC-8004 Registry | `0xBE6745f74DF1427a073154345040a37558059eBb` |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BSC_RPC_URL` | BNB Chain HTTP RPC | `https://bsc-rpc.publicnode.com` |
| `BSC_WS_URL` | BNB Chain WebSocket RPC | `wss://bsc-rpc.publicnode.com/wss` |
| `HODLAI_TOKEN` | HODLAI token address | `0x987e6269c6b7ea6898221882f11ea16f87b97777` |
| `HODLAI_LOGIC` | Deployed HodlAILogic contract | **Required** |
| `GAS_WALLET_PK` | Hot wallet private key | **Required** |
| `UPSTREAM_URL` | AI provider endpoint | `https://api.hodlai.fun/v1` |
| `UPSTREAM_KEY` | AI provider API key | **Required** |

## License

MIT