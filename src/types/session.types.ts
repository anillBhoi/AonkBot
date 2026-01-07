export type SessionState =
  | 'IDLE'
  | 'PROCESSING';

export interface UserSession {
  telegramId: number;
  username?: string;
  state: SessionState;
  createdAt: number;
  lastActiveAt: number;
}
