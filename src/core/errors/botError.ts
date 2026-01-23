/**
 * Custom error types for the bot
 */

export enum ErrorCode {
  // Validation errors
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNSUPPORTED_TOKEN = 'UNSUPPORTED_TOKEN',

  // Wallet errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  INVALID_KEYPAIR = 'INVALID_KEYPAIR',

  // Trading errors
  NO_ROUTE_FOUND = 'NO_ROUTE_FOUND',
  QUOTE_FAILED = 'QUOTE_FAILED',
  SWAP_FAILED = 'SWAP_FAILED',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  TX_SEND_FAILED = 'TX_SEND_FAILED',
  TX_CONFIRMATION_FAILED = 'TX_CONFIRMATION_FAILED',

  // RPC/Network errors
  RPC_ERROR = 'RPC_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Blockchain errors
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_PUBKEY = 'INVALID_PUBKEY',

  // General errors
  UNKNOWN = 'UNKNOWN',
  UNAVAILABLE = 'UNAVAILABLE'
}

export class BotError extends Error {
  code: ErrorCode
  statusCode: number
  details?: Record<string, any>

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    statusCode = 400,
    details?: Record<string, any>
  ) {
    super(message)
    this.name = 'BotError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case ErrorCode.INVALID_AMOUNT:
        return '❌ Invalid amount. Please provide a positive number.'

      case ErrorCode.INVALID_ADDRESS:
        return '❌ Invalid Solana address. Please check and try again.'

      case ErrorCode.INVALID_TOKEN:
      case ErrorCode.UNSUPPORTED_TOKEN:
        return '❌ Unsupported token. Please check the token name.'

      case ErrorCode.INSUFFICIENT_BALANCE:
        return '❌ Insufficient SOL balance. Please fund your wallet.'

      case ErrorCode.NO_ROUTE_FOUND:
        return '❌ No trading route found. Try adjusting the amount or slippage.'

      case ErrorCode.QUOTE_FAILED:
        return '❌ Failed to get price quote. Try again in a moment.'

      case ErrorCode.SWAP_FAILED:
        return '❌ Swap execution failed. Your SOL is safe. Try again.'

      case ErrorCode.SIMULATION_FAILED:
        return '❌ Transaction simulation failed. Try with a different amount.'

      case ErrorCode.TX_SEND_FAILED:
        return '❌ Failed to send transaction. Your SOL is safe. Try again.'

      case ErrorCode.TX_CONFIRMATION_FAILED:
        return '❌ Transaction timed out. Please check the explorer.'

      case ErrorCode.RATE_LIMITED:
        return '⏳ Too many requests. Please wait before trying again.'

      case ErrorCode.NETWORK_TIMEOUT:
        return '⏱️ Network timeout. The blockchain is congested. Try again.'

      case ErrorCode.RPC_ERROR:
        return '⚠️ RPC node error. Trying fallback endpoints...'

      case ErrorCode.UNKNOWN:
      case ErrorCode.UNAVAILABLE:
      default:
        return '❌ An unexpected error occurred. Please try again or contact support.'
    }
  }

  /**
   * Serialize error for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details
    }
  }
}

/**
 * Check if error is a BotError
 */
export function isBotError(err: any): err is BotError {
  return err instanceof BotError
}

/**
 * Convert any error to BotError
 */
export function asBotError(err: any): BotError {
  if (isBotError(err)) {
    return err
  }

  if (err instanceof Error) {
    // Try to infer error type from message
    if (err.message.includes('Insufficient')) {
      return new BotError(
        err.message,
        ErrorCode.INSUFFICIENT_BALANCE,
        400
      )
    }

    if (err.message.includes('timeout')) {
      return new BotError(
        err.message,
        ErrorCode.NETWORK_TIMEOUT,
        408
      )
    }

    if (err.message.includes('rate limit')) {
      return new BotError(
        err.message,
        ErrorCode.RATE_LIMITED,
        429
      )
    }

    return new BotError(
      err.message,
      ErrorCode.UNKNOWN,
      400
    )
  }

  return new BotError(
    String(err),
    ErrorCode.UNKNOWN,
    400
  )
}
