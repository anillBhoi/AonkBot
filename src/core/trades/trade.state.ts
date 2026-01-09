export enum TradeState{
    INIT = 'INIT', 
    VALIDATED = 'VALIDATED', 
    QUOTED =  'QUOTED', 
    SIMULATED = 'SIMULATED', 
    SENT = 'SENT', 
    CONFIRMED = 'CONFIRMED',
    FAILED = 'FAILED'
}

export const TERMINAL_STATES = [
    TradeState.CONFIRMED, 
    TradeState.FAILED
]