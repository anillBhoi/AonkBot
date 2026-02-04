type WithdrawState = {
    step: 'awaiting_address' | 'awaiting_amount' | 'confirming';
    amount?: number;
    destination?: string;
}

const withdrawStates = new Map<number, WithdrawState>();

export function setWithdrawState(userId: number, state: WithdrawState){
    withdrawStates.set(userId, state);
}

export function getWithdrawState(userId: number) {
    return withdrawStates.get(userId);
}

export function clearWithdrawState(userId: number) {
    withdrawStates.delete(userId);
}