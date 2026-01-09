import Queue from 'bull'

export const tradeQueue = new Queue('trades')