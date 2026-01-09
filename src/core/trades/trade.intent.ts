import {v4 as uuid} from 'uuid';

export type TradeSide = 'BUY' | 'SELL'

export interface TradeIntent {
    tradeId: string
    userId: string
    side: TradeSide
    inputMint: string
    outputMint: string
    amountLamports: bigint
    slippageBps: number
    createdAt: number
}


export function createTradeIntent(params: Omit<TradeIntent, 'tradeId' | 'createdAt'>): TradeIntent {
    return {
        tradeId: uuid(), 
        createdAt: Date.now(),
        ...params
    }
}