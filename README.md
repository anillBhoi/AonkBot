# 🚀 AonkBot  
### Self-Custodial Solana Telegram Trading Infrastructure

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)]()
[![Solana](https://img.shields.io/badge/Solana-Web3.js-purple)]()
[![Redis](https://img.shields.io/badge/Redis-State_Management-red)]()
[![Telegram](https://img.shields.io/badge/Telegram-Grammy_API-blue)]()
[![Architecture](https://img.shields.io/badge/Architecture-Event_Driven-orange)]()

> A production-oriented backend-focused Solana trading bot running on Telegram.  
> Demonstrates DeFi infrastructure design, transaction signing, off-chain order execution, Redis locking, and background worker systems.

👉 **Live Bot:** https://t.me/aonkkbot  

---

## 🧠 Backend Architecture Overview

AonkBot is architected as an **event-driven DeFi backend system**, not just a chat bot.

It integrates:

- Telegram Bot API (via Grammy)
- Jupiter DEX Aggregator
- Solana RPC
- Redis for state & locking
- Background execution workers
- Encrypted wallet storage

---

## 🔄 High-Level Data Flow

```
User (Telegram)
      ↓
Webhook/API Layer
      ↓
Message Router
      ↓
Core Services (Swap / Orders / Alerts)
      ↓
Jupiter API (Quote + Swap)
      ↓
Solana RPC
      ↓
On-chain Execution
```

---

## ⚙ System Components

### 1️⃣ API / Interaction Layer

- Webhook-based deployment
- Centralized message router
- Callback query router
- Redis-backed conversation state
- Stateless request handling

---

### 2️⃣ Core Trading Engine

#### Swap Engine

1. Fetch route from Jupiter Quote API  
2. Fetch serialized transaction from Jupiter Swap API  
3. Decrypt user keypair in memory  
4. Sign transaction  
5. Submit to Solana RPC  
6. Return transaction signature  

**Design Principle:**  
Private keys are encrypted at rest and only decrypted in memory during signing.

---

### 3️⃣ Off-Chain Order System

Limit Orders and DCA are implemented off-chain:

- Orders stored in Redis
- Workers poll price feeds
- Condition engine evaluates:
  - Price thresholds
  - Percentage triggers
  - Trailing stop logic
- Atomic execution using Redis locks

This mimics centralized exchange behavior while executing trades fully on-chain.

---

### 4️⃣ Background Worker Architecture

Workers handle:

- DCA scheduling
- Limit / Take Profit / Stop Loss
- Trailing Stop logic
- Price alerts

Each worker:

- Uses Redis locking (`SET NX EX`)
- Prevents race conditions
- Ensures idempotent execution

---

## 🔐 Security Architecture

- AES encryption for wallet keypairs
- ENV-based encryption secret
- TOTP (2FA) required for seed export
- No plaintext key storage
- Memory-only key exposure during signing
- Redis locks prevent duplicate execution

---

## 💰 DeFi Engineering Highlights

This project demonstrates:

- Jupiter aggregator integration
- Serialized transaction handling
- SPL token interactions
- Off-chain limit order execution
- Trailing stop logic
- Multi-wallet abstraction
- Referral volume tracking
- Slippage configuration per user

---

## 🏗 Design Patterns Used

- Event-driven architecture
- Separation of concerns (API / Core / Workers)
- Stateless API + Stateful Redis
- Background polling workers
- Modular service structure
- Defensive input validation
- Explicit blockchain error handling

---

## 📊 Redis Usage

Redis stores:

- User sessions
- Order drafts
- Active DCA orders
- Active limit orders
- Referral mappings
- Wallet naming state
- Slippage settings
- Lock keys for atomic execution

Locking pattern:

```
SET key value NX EX 30
```

Prevents duplicate order execution.

---

## 💼 Recruiter Summary

AonkBot demonstrates:

- Blockchain transaction signing
- Aggregator-based DEX routing
- Off-chain order engine
- Background job processing
- Redis-based distributed locking
- Secure key management
- Webhook-based serverless deployment

This is a stateful, transaction-aware DeFi backend system — not a CRUD app.

---

## 🛠 Tech Stack

| Layer | Technology |
|--------|------------|
| Language | TypeScript |
| Runtime | Node.js |
| Telegram | Grammy |
| Blockchain | Solana web3.js |
| DEX Aggregator | Jupiter |
| State Management | Redis |
| Hosting | Vercel (Webhook mode) |

---

## 📦 Environment Variables

```
BOT_TOKEN=
REDIS_URL=
SOLANA_RPC_URL=
ENCRYPTION_SECRET=
```

---

## ⚠ Disclaimer

This is an educational / portfolio project.  
Not audited. Use at your own risk.

---

## 🔗 Try the Bot

👉 https://t.me/aonkkbot
