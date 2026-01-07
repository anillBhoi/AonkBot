import { Context } from 'grammy';

export type CommandHandler = (ctx: Context) => Promise<void>;
