export class TradeError extends Error{
    constructor(
        message: string, 
        public readonly code: string
    ) {
        super(message)
    }
}

export const TradeErrors = {
    LOCKED: 'USER_TRADE_LOCKED', 
    INVALID_TOKEN: 'INVALID_TOKEN',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
    QUOTE_FAILED: 'QUOTE_FAILED', 
    SIMULATION_FAILED: 'SIMULATION_FAILED', 
    TX_FAILED: 'TX_FAILED'

}